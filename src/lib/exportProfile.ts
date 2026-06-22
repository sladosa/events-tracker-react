/**
 * Export Profile System
 * ====================
 * Saves/loads column visibility and order as reusable "recipes" for Excel export.
 *
 * Workflow:
 *   1. Export Preview (10 rows) → all columns visible
 *   2. User groups/collapses columns in Excel (Data > Group > Collapse)
 *   3. Import Profile → reads column grouping state → saves to area.settings
 *   4. Export with profile → applies grouping + order, profile name in Filter sheet + filename
 */

import ExcelJS from 'exceljs';
import { FIXED_COLUMNS, ATTR_COL_START, buildAttrMeta } from './excelExport';
import type { ExportAttrDef, ExportCategoriesDict } from './excelTypes';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExportProfileColumn {
  /** Column identifier: fixed column name (e.g. "event_id") or "attr:<attrDefId>" */
  key: string;
  /** 0 = normal, 1+ = grouped */
  outlineLevel: number;
  /** true = collapsed/hidden */
  hidden: boolean;
}

export interface ExportProfile {
  columns: ExportProfileColumn[];
  createdAt: string;
}

export type ExportProfiles = Record<string, ExportProfile>;

// ─────────────────────────────────────────────
// Read profile from an xlsx file
// ─────────────────────────────────────────────

/**
 * Read column grouping state from an exported xlsx.
 * Returns an ExportProfile with each column's visibility state.
 */
export function readProfileFromWorkbook(wb: ExcelJS.Workbook): ExportProfile | null {
  const ws = wb.getWorksheet('Events');
  if (!ws) return null;

  // Build a map from column index → attrDefId by reading the LEGEND section.
  // LEGEND format: row has col A = letter (e.g. "I"), col D = attribute name
  // We need to find the LEGEND, read it, then check column states.

  // Find LEGEND start
  let legendHeaderRow = -1;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (legendHeaderRow !== -1) return;
    const v = String(row.getCell(1).value ?? '');
    if (v.includes('ATTRIBUTE LEGEND')) legendHeaderRow = rowNumber + 1;
  });

  if (legendHeaderRow === -1) return null;

  // Read LEGEND rows to build colIndex → attrDefId mapping
  // We don't have attrDefId in the xlsx, so we use "area:categoryPath:attrName" as key
  // For import back, we'll match by col letter position
  const colLetterToLegendKey = new Map<string, string>();

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= legendHeaderRow) return;
    const letter = String(row.getCell(1).value ?? '').trim();
    if (!/^[A-Z]{1,3}$/.test(letter)) return;

    const area = String(row.getCell(2).value ?? '').trim();
    const catPath = String(row.getCell(3).value ?? '').trim();
    const attrName = String(row.getCell(4).value ?? '').trim();
    colLetterToLegendKey.set(letter, `${area}||${catPath}||${attrName}`);
  });

  const columns: ExportProfileColumn[] = [];

  // Fixed columns (A-H)
  for (let i = 0; i < FIXED_COLUMNS.length; i++) {
    const col = ws.getColumn(i + 1);
    columns.push({
      key: FIXED_COLUMNS[i],
      outlineLevel: col.outlineLevel ?? 0,
      hidden: col.hidden ?? false,
    });
  }

  // Attribute columns (I+)
  for (const [letter, legendKey] of colLetterToLegendKey) {
    const colIdx = colLetterToIndex(letter);
    if (colIdx < 1) continue;
    const col = ws.getColumn(colIdx);
    columns.push({
      key: `attr:${legendKey}`,
      outlineLevel: col.outlineLevel ?? 0,
      hidden: col.hidden ?? false,
    });
  }

  return {
    columns,
    createdAt: new Date().toISOString().split('T')[0],
  };
}

// ─────────────────────────────────────────────
// Apply profile to a workbook
// ─────────────────────────────────────────────

/**
 * Apply an ExportProfile to the Events worksheet — sets column grouping and collapse state.
 * Call this AFTER addActivitiesSheetsTo() has built the sheet.
 */
export function applyProfileToWorkbook(
  wb: ExcelJS.Workbook,
  profile: ExportProfile,
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
): void {
  const ws = wb.getWorksheet('Events');
  if (!ws) return;

  // Build lookup: key → profile column state
  const profileMap = new Map<string, ExportProfileColumn>();
  for (const pc of profile.columns) {
    profileMap.set(pc.key, pc);
  }

  // Apply to fixed columns
  for (let i = 0; i < FIXED_COLUMNS.length; i++) {
    const pc = profileMap.get(FIXED_COLUMNS[i]);
    if (pc) {
      const col = ws.getColumn(i + 1);
      col.outlineLevel = pc.outlineLevel;
      col.hidden = pc.hidden;
    }
  }

  // Apply to attribute columns — match by "attr:area||catPath||attrName"
  const { attrMeta, attrColumns } = buildAttrMeta(attrDefs, categoriesDict);
  for (let idx = 0; idx < attrColumns.length; idx++) {
    const ac = attrColumns[idx];
    const meta = attrMeta.get(ac.attrDefId)!;
    const legendKey = `attr:${meta.areaName}||${meta.categoryPath}||${ac.attrName}`;
    const pc = profileMap.get(legendKey);
    if (pc) {
      const colIdx = ATTR_COL_START + idx;
      const col = ws.getColumn(colIdx);
      col.outlineLevel = pc.outlineLevel;
      col.hidden = pc.hidden;
    }
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
 * Sanitize a profile name for use in filenames.
 */
export function sanitizeProfileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9À-ɏ _-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
}
