/**
 * Export Profile System
 * ====================
 * Saves/loads column visibility, order, and widths as reusable "recipes" for Excel export.
 *
 * Workflow:
 *   1. Export Preview (10 rows) → all columns visible, default order
 *   2. User rearranges columns, adjusts widths, groups/collapses in Excel
 *   3. Import Profile → reads column order, widths, grouping → saves to area.settings
 *   4. Export with profile → applies order + widths + grouping, profile name in Filter sheet + filename
 */

import ExcelJS from 'exceljs';
import { FIXED_COLUMNS, ATTR_COL_START } from './excelExport';
import type { ExportAttrDef, ExportCategoriesDict } from './excelTypes';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExportProfileColumn {
  /** Column identifier: fixed column name (e.g. "event_id") or "attr:Area||CatPath||AttrName" */
  key: string;
  /** 0 = normal, 1+ = grouped */
  outlineLevel: number;
  /** true = collapsed/hidden */
  hidden: boolean;
  /** Column width (Excel units) */
  width?: number;
}

export interface ProfileFilterState {
  periodKey?: string;
  sortOrder?: 'asc' | 'desc';
  commentSearch?: string;
  attrFilterRaw?: string;
}

export interface ExportProfile {
  columns: ExportProfileColumn[];
  createdAt: string;
  filterState?: ProfileFilterState;
}

export type ExportProfiles = Record<string, ExportProfile>;

// ─────────────────────────────────────────────
// Read profile from an xlsx file
// ─────────────────────────────────────────────

/**
 * Read column grouping state, order, and widths from an exported xlsx.
 * The order of LEGEND entries determines the attribute column order in exports.
 */
export function readProfileFromWorkbook(wb: ExcelJS.Workbook): ExportProfile | null {
  const ws = wb.getWorksheet('Events');
  if (!ws) return null;

  // Find LEGEND start
  let legendHeaderRow = -1;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (legendHeaderRow !== -1) return;
    const v = String(row.getCell(1).value ?? '');
    if (v.includes('ATTRIBUTE LEGEND')) legendHeaderRow = rowNumber + 1;
  });

  if (legendHeaderRow === -1) return null;

  // Read LEGEND rows — order in file = desired column order
  const legendEntries: { letter: string; legendKey: string }[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= legendHeaderRow) return;
    const letter = String(row.getCell(1).value ?? '').trim();
    if (!/^[A-Z]{1,3}$/.test(letter)) return;

    const area = String(row.getCell(2).value ?? '').trim();
    const catPath = String(row.getCell(3).value ?? '').trim();
    const attrName = String(row.getCell(4).value ?? '').trim();
    legendEntries.push({ letter, legendKey: `${area}||${catPath}||${attrName}` });
  });

  const columns: ExportProfileColumn[] = [];

  // Fixed columns (A-H)
  for (let i = 0; i < FIXED_COLUMNS.length; i++) {
    const col = ws.getColumn(i + 1);
    columns.push({
      key: FIXED_COLUMNS[i],
      outlineLevel: col.outlineLevel ?? 0,
      hidden: col.hidden ?? false,
      width: col.width ?? undefined,
    });
  }

  // Attribute columns — read in LEGEND order (= user's desired order)
  for (const { letter, legendKey } of legendEntries) {
    const colIdx = colLetterToIndex(letter);
    if (colIdx < 1) continue;
    const col = ws.getColumn(colIdx);
    columns.push({
      key: `attr:${legendKey}`,
      outlineLevel: col.outlineLevel ?? 0,
      hidden: col.hidden ?? false,
      width: col.width ?? undefined,
    });
  }

  return {
    columns,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

// ─────────────────────────────────────────────
// Get column reorder from profile
// ─────────────────────────────────────────────

/**
 * Given a profile and the default attr columns from buildAttrMeta,
 * return the indices that reorder attrColumns to match the profile's LEGEND order.
 * Attrs not in the profile are appended at the end.
 */
export function getProfileAttrOrder(
  profile: ExportProfile,
  attrColumns: { categoryPath: string; attrName: string; attrDefId: string }[],
  attrMeta: Map<string, { areaName: string; categoryPath: string }>,
): number[] {
  // Build a map: legendKey → profile position (among attr columns only)
  const profileOrder = new Map<string, number>();
  let attrIdx = 0;
  for (const pc of profile.columns) {
    if (pc.key.startsWith('attr:')) {
      profileOrder.set(pc.key, attrIdx++);
    }
  }

  // Build legendKey for each attrColumn
  const attrWithKeys = attrColumns.map((ac, idx) => {
    const meta = attrMeta.get(ac.attrDefId);
    const legendKey = meta
      ? `attr:${meta.areaName}||${meta.categoryPath}||${ac.attrName}`
      : `attr:||${ac.categoryPath}||${ac.attrName}`;
    const order = profileOrder.get(legendKey) ?? 999999 + idx;
    return { originalIdx: idx, order };
  });

  attrWithKeys.sort((a, b) => a.order - b.order);
  return attrWithKeys.map(a => a.originalIdx);
}

// ─────────────────────────────────────────────
// Apply profile to a workbook (grouping, widths)
// ─────────────────────────────────────────────

/**
 * Apply an ExportProfile to the Events worksheet — sets column grouping, collapse, and widths.
 * Column ORDER is applied BEFORE building the sheet (via getProfileAttrOrder + addActivitiesSheetsTo).
 * This function handles post-build styling: grouping + widths.
 * Attr columns are matched positionally (profile attr order = sheet column order).
 */
export function applyProfileToWorkbook(
  wb: ExcelJS.Workbook,
  profile: ExportProfile,
  _attrDefs: ExportAttrDef[],
  _categoriesDict: ExportCategoriesDict,
): void {
  const ws = wb.getWorksheet('Events');
  if (!ws) return;

  // Apply to fixed columns
  for (let i = 0; i < FIXED_COLUMNS.length; i++) {
    const pc = profile.columns.find(c => c.key === FIXED_COLUMNS[i]);
    if (pc) {
      const col = ws.getColumn(i + 1);
      col.outlineLevel = pc.outlineLevel;
      col.hidden = pc.hidden;
      if (pc.width) col.width = pc.width;
    }
  }

  // Apply to attribute columns — profile attr order = sheet column order
  const profileAttrCols = profile.columns.filter(c => c.key.startsWith('attr:'));
  for (let idx = 0; idx < profileAttrCols.length; idx++) {
    const pc = profileAttrCols[idx];
    const colIdx = ATTR_COL_START + idx;
    const col = ws.getColumn(colIdx);
    col.outlineLevel = pc.outlineLevel;
    col.hidden = pc.hidden;
    if (pc.width) col.width = pc.width;
  }

  // Set max outline level for column grouping
  const maxLevel = Math.max(0, ...profile.columns.map(c => c.outlineLevel));
  if (maxLevel > 0) {
    ws.properties.outlineLevelCol = maxLevel;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result;
}

/**
 * Read the profile name from the Filter sheet (if present).
 */
export function readProfileNameFromWorkbook(wb: ExcelJS.Workbook): string | null {
  const ws = wb.getWorksheet('Filter');
  if (!ws) return null;

  let profileName: string | null = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const key = String(row.getCell(1).value ?? '').trim();
    if (key === 'Export profile') {
      profileName = String(row.getCell(2).value ?? '').trim() || null;
    }
  });
  return profileName;
}

/**
 * Read filter settings from the Filter sheet of an exported xlsx.
 * Returns a ProfileFilterState that can be stored with the profile.
 */
export function readFilterFromWorkbook(wb: ExcelJS.Workbook): ProfileFilterState | null {
  const ws = wb.getWorksheet('Filter');
  if (!ws) return null;

  const kvs: Record<string, string> = {};
  ws.eachRow({ includeEmpty: false }, (row) => {
    const key = String(row.getCell(1).value ?? '').trim();
    const val = String(row.getCell(2).value ?? '').trim();
    if (key && val) kvs[key] = val;
  });

  if (Object.keys(kvs).length === 0) return null;

  const result: ProfileFilterState = {};

  if (kvs['Period key']) result.periodKey = kvs['Period key'];
  if (kvs['Sort order']) result.sortOrder = kvs['Sort order'] === 'Oldest first' ? 'asc' : 'desc';
  if (kvs['Comment filter']) result.commentSearch = kvs['Comment filter'];
  if (kvs['Attribute filter']) result.attrFilterRaw = kvs['Attribute filter'];

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Sanitize a profile name for use in filenames.
 */
export function sanitizeProfileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9À-ɏ _-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
}
