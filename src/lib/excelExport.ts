/**
 * Events Tracker – Excel Export Engine
 * =====================================
 * Port of Streamlit excel_events_io.py V2.5.8 → TypeScript / ExcelJS
 * Version: 1.1.0  (Unified Workbook Format — S26 Korak 2)
 *
 * Format (unified 5-sheet workbook):
 *   Sheet 1 "Events":
 *     Section 1: ATTRIBUTE LEGEND  (row groups collapsed, 6 cols)
 *     Section 2: EVENT DATA        (autofilter, freeze at col H, SUBTOTAL)
 *   Sheet 2 "HelpEvents"
 *   Sheet 3 "Structure"       (optional, via addStructureSheetsTo)
 *   Sheet 4 "HelpStructure"   (optional)
 *   Sheet 5 "Filter"          (optional, via addFilterSheet)
 *
 * Fixed columns (EVENT DATA):
 *   A event_id        PINK  read-only
 *   B Area            PINK  read-only
 *   C Category_Path   PINK  read-only
 *   D event_date      BLUE  Excel DATE format YYYY-MM-DD
 *   E session_start   BLUE  text HH:MM
 *   F created_at      BLUE  text HH:mm:ss
 *   G leaf comment    BLUE  single column (no merge)
 *   H+                BLUE/ORANGE  attribute columns
 */

import ExcelJS from 'exceljs';
import type {
  ExportCategoriesDict,
  ExportAttrDef,
  ExportEvent,
} from './excelTypes';
import type { StructureNode } from '@/types/structure';
import { addStructureSheetsTo, type ExportStructureOptions } from './structureExcel';
import { type FilterSheetInfo, addFilterSheet } from './excelUtils';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PINK_FILL: ExcelJS.Fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6F0' } };
const BLUE_FILL: ExcelJS.Fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
const ORANGE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
const LEGEND_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
const SEPARATOR_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD0E0' } };

const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
const TITLE_FONT: Partial<ExcelJS.Font>  = { bold: true, size: 12 };

const THIN_BORDER = {
  top:    { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  left:   { style: 'thin' as const },
  right:  { style: 'thin' as const },
};

// Fixed columns – ORDER MATTERS (matches column indices A-H, used by excelImport)
export const FIXED_COLUMNS = [
  'event_id',
  'Area',
  'Category_Path',
  'event_date',
  'session_start',
  'created_at',
  'user_email',  // G — User column (collab: D7)
  'comment',
] as const;

// Display headers for the header row
const FIXED_DISPLAY_HEADERS = [
  'event_id',
  'Area',
  'Category_Path',
  'event_date',
  'session_start',
  'created_at',
  'User',
  'leaf comment',
] as const;

export const FIXED_COL_COUNT = FIXED_COLUMNS.length; // 8  (A–H)
export const PADDING_COLS    = 0;                     // no padding (comment is single col H)
export const ATTR_COL_START  = FIXED_COL_COUNT + PADDING_COLS + 1; // 9 → I

// LEGEND columns (6 cols: removed Default / Min / Max vs old 9-col version)
const LEGEND_COLS = ['Col', 'Area', 'Category_Path', 'Attribute', 'Type', 'Unit'];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Convert 1-based column index → Excel letter (1→A, 27→AA …) */
export function colLetter(colIndex: number): string {
  let letter = '';
  let n = colIndex;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** Extract HH:MM from ISO timestamp string */
function isoToHHMM(iso: string | null): string {
  if (!iso) return '09:00';
  try {
    const dt = new Date(iso);
    const h  = dt.getHours().toString().padStart(2, '0');
    const m  = dt.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '09:00';
  }
}

/** Extract HH:mm:ss from ISO timestamp string */
function isoToHHMMSS(iso: string | null): string {
  if (!iso) return '09:00:00';
  try {
    const dt = new Date(iso);
    const h  = dt.getHours().toString().padStart(2, '0');
    const m  = dt.getMinutes().toString().padStart(2, '0');
    const s  = dt.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return '09:00:00';
  }
}

/** Parse YYYY-MM-DD string → Excel-compatible Date object (UTC midnight)
 *  IMPORTANT: Must use UTC midnight, not local midnight.
 *  ExcelJS serialises Date via Math.floor((ts - epoch) / 86400000) using UTC.
 *  In CET (UTC+1), local midnight = previous day 23:00 UTC → Math.floor shifts
 *  the date one day back.  UTC midnight always produces an exact integer day. */
function parseEventDate(dateStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

/** Parse validation_rules JSON safely */
function parseValidation(rules: unknown): Record<string, string> {
  if (!rules) return {};
  if (typeof rules === 'object' && !Array.isArray(rules)) return rules as Record<string, string>;
  if (typeof rules === 'string') {
    try { return JSON.parse(rules) as Record<string, string>; } catch { return {}; }
  }
  return {};
}

// ─────────────────────────────────────────────
// Build attr metadata
// ─────────────────────────────────────────────

interface AttrMeta {
  id: string;
  name: string;
  categoryId: string;
  categoryPath: string;
  areaName: string;
  dataType: string;
  unit: string;
  defaultValue: string | number;
  min: string | number;
  max: string | number;
}

interface AttrColumn {
  categoryPath: string;
  attrName: string;
  attrDefId: string;
}

export function buildAttrMeta(
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
): { attrMeta: Map<string, AttrMeta>; attrColumns: AttrColumn[]; attrByCat: Map<string, Set<string>> } {
  const attrMeta    = new Map<string, AttrMeta>();
  const attrColumns: AttrColumn[] = [];
  const attrByCat   = new Map<string, Set<string>>();
  const seen        = new Set<string>();

  for (const def of attrDefs) {
    const catInfo     = categoriesDict[def.category_id] ?? {};
    const validation  = parseValidation(def.validation_rules);
    const dataType    = def.data_type ?? 'text';

    let defaultVal: string | number = def.default_value ?? '';
    let minVal: string | number     = (validation as Record<string,string>).min ?? '';
    let maxVal: string | number     = (validation as Record<string,string>).max ?? '';

    if (dataType === 'number') {
      if (defaultVal !== '') defaultVal = parseFloat(String(defaultVal)) || defaultVal;
      if (minVal     !== '') minVal     = parseFloat(String(minVal))     || minVal;
      if (maxVal     !== '') maxVal     = parseFloat(String(maxVal))     || maxVal;
    }

    attrMeta.set(def.id, {
      id:           def.id,
      name:         def.name,
      categoryId:   def.category_id,
      categoryPath: catInfo.full_path ?? 'Unknown',
      areaName:     catInfo.area_name ?? 'Unknown',
      dataType,
      unit:         def.unit ?? '',
      defaultValue: defaultVal,
      min:          minVal,
      max:          maxVal,
    });

    const key = `${catInfo.full_path ?? ''}||${def.name}||${def.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      attrColumns.push({ categoryPath: catInfo.full_path ?? 'Unknown', attrName: def.name, attrDefId: def.id });
    }

    if (!attrByCat.has(def.category_id)) attrByCat.set(def.category_id, new Set());
    attrByCat.get(def.category_id)!.add(def.id);
  }

  // Sort columns by Area → CategoryPath → attrName for consistent legend + EVENT DATA column order
  attrColumns.sort((a, b) => {
    const ma = attrMeta.get(a.attrDefId)!;
    const mb = attrMeta.get(b.attrDefId)!;
    if (ma.areaName     !== mb.areaName)     return ma.areaName.localeCompare(mb.areaName);
    if (ma.categoryPath !== mb.categoryPath) return ma.categoryPath.localeCompare(mb.categoryPath);
    return ma.name.localeCompare(mb.name);
  });

  return { attrMeta, attrColumns, attrByCat };
}

// ─────────────────────────────────────────────
// Internal sheet builder (Events + HelpEvents)
// ─────────────────────────────────────────────

/**
 * Adds the "Events" and "HelpEvents" sheets to an existing workbook.
 * Called by createEventsExcel; can also be called directly to compose
 * a multi-sheet unified workbook.
 */
export async function addActivitiesSheetsTo(
  wb: ExcelJS.Workbook,
  events: ExportEvent[],
  attrDefs: ExportAttrDef[],
  categoriesDict: ExportCategoriesDict,
  sortOrder: 'asc' | 'desc' = 'desc',
): Promise<void> {

  const { attrMeta, attrColumns, attrByCat } = buildAttrMeta(attrDefs, categoriesDict);

  const ws = wb.addWorksheet('Events');

  // Outline summary ABOVE groups (ExcelJS default is below; we set via worksheet properties)
  ws.properties.outlineLevelRow = 1;

  // ──────────────────────────────────────────
  // SECTION 1: ATTRIBUTE LEGEND
  // ──────────────────────────────────────────
  let row = 1;

  // Title row
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'ATTRIBUTE LEGEND:';
  titleCell.font  = TITLE_FONT;

  // C1: note pointing to Structure sheet
  const noteCell = ws.getCell(row, 3);
  noteCell.value = 'see Structure sheet for more details';
  noteCell.font  = { italic: true, color: { argb: 'FF666666' } };

  row++;

  // Legend header row (6 cols)
  for (let ci = 0; ci < LEGEND_COLS.length; ci++) {
    const cell = ws.getCell(row, ci + 1);
    cell.value     = LEGEND_COLS[ci];
    cell.fill      = LEGEND_HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  row++;

  const legendRows: number[] = [];

  for (let idx = 0; idx < attrColumns.length; idx++) {
    const { attrName, attrDefId } = attrColumns[idx];
    const meta    = attrMeta.get(attrDefId)!;
    const colIdx  = ATTR_COL_START + idx;
    const letter  = colLetter(colIdx);

    // 6 cols: Col, Area, Category_Path, Attribute, Type, Unit
    const rowData = [
      letter,
      meta.areaName,
      meta.categoryPath,
      attrName,
      meta.dataType,
      meta.unit,
    ];

    for (let ci = 0; ci < rowData.length; ci++) {
      const cell = ws.getCell(row, ci + 1);
      cell.value     = rowData[ci] === '' ? null : rowData[ci];
      cell.fill      = PINK_FILL;
      cell.border    = THIN_BORDER;
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    legendRows.push(row);
    row++;
  }

  // Row grouping (smart chunks of ~10) — same logic as before
  if (legendRows.length > 0) {
    const total     = legendRows.length;
    const numGroups = total <= 5 ? 1 : Math.max(1, Math.ceil(total / 10));
    const groupSize = Math.ceil(total / numGroups);

    for (let g = 0; g < numGroups; g++) {
      const startIdx = g * groupSize;
      const endIdx   = Math.min(startIdx + groupSize - 1, total - 1);
      if (startIdx > endIdx) continue;

      // First row of group = separator (bold + darker fill, NOT grouped)
      const separatorRowNum = legendRows[startIdx];
      for (let ci = 1; ci <= LEGEND_COLS.length; ci++) {
        const cell = ws.getCell(separatorRowNum, ci);
        cell.font = { bold: true };
        cell.fill = SEPARATOR_FILL;
      }

      // Group rows AFTER separator (hidden by default)
      if (endIdx > startIdx) {
        for (let i = startIdx + 1; i <= endIdx; i++) {
          const wsRow = ws.getRow(legendRows[i]);
          wsRow.outlineLevel = 1;
          wsRow.hidden       = true;
        }
      }
    }
  }

  // NOTE: No column grouping (old F-I grouping removed — Default/Min/Max no longer in legend)

  // ──────────────────────────────────────────
  // Empty row between sections
  // ──────────────────────────────────────────
  row++;

  // ──────────────────────────────────────────
  // SECTION 2: EVENT DATA
  // ──────────────────────────────────────────
  const eventTitleRow = row;

  ws.getCell(row, 1).value = 'EVENT DATA:';
  ws.getCell(row, 1).font  = TITLE_FONT;
  ws.getCell(row, 3).value = 'Summ (if relevant) ->';
  ws.getCell(row, 3).alignment = { horizontal: 'right' };
  row++;

  // Header row
  const eventHeaderRow = row;

  // Build header strings for attribute columns ("attr_name (CategoryShort)")
  const attrHeaderStrings = attrColumns.map(({ categoryPath, attrName }) => {
    const shortCat = categoryPath.includes(' > ')
      ? categoryPath.split(' > ').pop()!
      : categoryPath;
    return `${attrName} (${shortCat})`;
  });

  // Fixed display headers + attr headers (no padding cols)
  const allHeaders = [
    ...FIXED_DISPLAY_HEADERS,
    ...attrHeaderStrings,
  ];

  for (let ci = 0; ci < allHeaders.length; ci++) {
    const cell = ws.getCell(row, ci + 1);
    cell.value     = allHeaders[ci] || null;
    cell.fill      = HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  row++;

  const eventDataStart = row;

  // ──────────────────────────────────────────
  // EVENT DATA ROWS
  // ──────────────────────────────────────────
  // Sort events:
  //   1. event_date  – direction controlled by sortOrder (newest ↓ default)
  //   2. session_start – same direction
  //   3. created_at – always ASC (leaf events within a session in chronological order)
  const sortedEvents = [...events].sort((a, b) => {
    const dateCmp = a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
    if (dateCmp !== 0) return sortOrder === 'asc' ? dateCmp : -dateCmp;

    const ssA = a.session_start ?? '';
    const ssB = b.session_start ?? '';
    const ssCmp = ssA < ssB ? -1 : ssA > ssB ? 1 : 0;
    if (ssCmp !== 0) return sortOrder === 'asc' ? ssCmp : -ssCmp;

    // Tie-breaker: user_id ASC — isti redosljed kao useActivities (client-side sort)
    const uA = a.user_id ?? '';
    const uB = b.user_id ?? '';
    if (uA !== uB) return uA < uB ? -1 : 1;

    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    return a.created_at.localeCompare(b.created_at);
  });

  for (const event of sortedEvents) {
    const catInfo = categoriesDict[event.category_id] ?? {};

    // Build relevant attr ids for this event (walk up hierarchy)
    const relevantAttrIds = new Set<string>();
    let walkCatId: string | null = event.category_id;
    while (walkCatId) {
      const catAttrIds = attrByCat.get(walkCatId);
      if (catAttrIds) for (const aid of catAttrIds) relevantAttrIds.add(aid);
      walkCatId = (categoriesDict[walkCatId] as { parent_category_id?: string | null })?.parent_category_id ?? null;
    }

    // Build attr values map: attrDefId → value
    const attrValues = new Map<string, number | string | boolean | null>();
    for (const ea of event.event_attributes ?? []) {
      const defId = ea.attribute_definition_id;
      const meta  = attrMeta.get(defId);
      if (!meta) continue;

      let val: number | string | boolean | null = null;
      if (ea.value_number  != null) val = ea.value_number;
      else if (ea.value_boolean != null) val = ea.value_boolean;
      else if (ea.value_datetime)   val = ea.value_datetime;
      else if (ea.value_text)       val = ea.value_text;

      attrValues.set(defId, val);
    }

    // ---- Write fixed columns A-F ----
    const sessionTime  = isoToHHMM(event.session_start);
    const createdTime  = isoToHHMMSS(event.created_at ?? null);
    const eventDateObj = parseEventDate(event.event_date);

    const fixedData: (string | Date | null)[] = [
      event.id,
      catInfo.area_name   ?? '',
      catInfo.full_path   ?? '',
      eventDateObj,
      sessionTime,
      createdTime,
    ];

    for (let ci = 0; ci < fixedData.length; ci++) {
      const colNum = ci + 1;
      const cell   = ws.getCell(row, colNum);
      cell.value   = fixedData[ci];
      cell.border  = THIN_BORDER;
      cell.alignment = { horizontal: 'left', vertical: 'top' };

      if (colNum <= 3) {
        cell.fill = PINK_FILL;
      } else if (colNum === 4) {
        cell.fill   = BLUE_FILL;
        cell.numFmt = 'YYYY-MM-DD';
      } else {
        cell.fill   = BLUE_FILL;
        cell.numFmt = '@';
      }
    }

    // ---- Column G: User (email, read-only, grouped) ----
    const userCell = ws.getCell(row, 7); // col 7 = G
    userCell.value     = event.user_email ?? '';
    userCell.fill      = PINK_FILL;
    userCell.border    = THIN_BORDER;
    userCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // ---- Column H: leaf comment (single cell, no merge) ----
    const commentValue = event.comment ?? '';
    const commentCell  = ws.getCell(row, FIXED_COL_COUNT); // col 8 = H
    commentCell.value     = commentValue || null;
    commentCell.fill      = BLUE_FILL;
    commentCell.border    = THIN_BORDER;
    commentCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: false };

    // Row height
    ws.getRow(row).height = 20;
    if (commentValue && commentValue.length > 100) {
      commentCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      ws.getRow(row).height = 20 + Math.min(2, Math.floor(commentValue.length / 50)) * 15;
    }

    // ---- Attribute columns H+ ----
    for (let aidx = 0; aidx < attrColumns.length; aidx++) {
      const { attrDefId } = attrColumns[aidx];
      const colNum        = ATTR_COL_START + aidx;
      const cell          = ws.getCell(row, colNum);
      const value         = attrValues.get(attrDefId) ?? null;
      const meta          = attrMeta.get(attrDefId)!;

      cell.value  = value;
      cell.border = THIN_BORDER;

      // Color: BLUE if attr's category is in event's hierarchy, ORANGE otherwise
      const attrCatId     = meta.categoryId;
      let isRelevant      = false;
      let testCat: string | null = event.category_id;
      while (testCat) {
        if (attrCatId === testCat) { isRelevant = true; break; }
        testCat = (categoriesDict[testCat] as { parent_category_id?: string | null })?.parent_category_id ?? null;
      }

      cell.fill = isRelevant ? BLUE_FILL : ORANGE_FILL;

      if (meta.dataType === 'number') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof value === 'number') cell.numFmt = '0.##';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }

    row++;
  }

  const eventDataEnd = row - 1;

  // ──────────────────────────────────────────
  // SUBTOTAL formulas (in EVENT DATA title row)
  // ──────────────────────────────────────────
  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    const { attrDefId } = attrColumns[aidx];
    const meta          = attrMeta.get(attrDefId)!;
    if (meta.dataType !== 'number') continue;

    const colNum  = ATTR_COL_START + aidx;
    const letter  = colLetter(colNum);
    const cell    = ws.getCell(eventTitleRow, colNum);
    cell.value    = { formula: `SUBTOTAL(9,${letter}${eventDataStart}:${letter}${eventDataEnd})` };
    cell.alignment = { horizontal: 'right' };
  }

  // ──────────────────────────────────────────
  // AUTOFILTER
  // ──────────────────────────────────────────
  const lastDataCol = ATTR_COL_START + attrColumns.length - 1;
  ws.autoFilter = {
    from: { row: eventHeaderRow, column: 1 },
    to:   { row: eventDataEnd,   column: Math.max(lastDataCol, ATTR_COL_START - 1) },
  };

  // ──────────────────────────────────────────
  // FREEZE PANES  (below header, right of comment: col H = xSplit 7)
  // ──────────────────────────────────────────
  ws.views = [{
    state:  'frozen',
    xSplit: ATTR_COL_START - 1,    // 7 → freeze cols A-G, first scrollable = H
    ySplit: eventDataStart - 1,
  }];

  // ──────────────────────────────────────────
  // COLUMN WIDTHS
  // ──────────────────────────────────────────
  ws.getColumn('A').width = 10;   // event_id
  ws.getColumn('B').width = 12;   // Area
  ws.getColumn('C').width = 32;   // Category_Path
  ws.getColumn('D').width = 12;   // event_date
  ws.getColumn('E').width = 8;    // session_start
  ws.getColumn('F').width = 10;   // created_at
  ws.getColumn('G').width = 22;   // User (email)
  ws.getColumn('H').width = 30;   // leaf comment

  // Column G (User) is grouped so users can collapse it to save space
  ws.getColumn(7).outlineLevel = 1;

  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    ws.getColumn(ATTR_COL_START + aidx).width = 13;
  }

  // Legend column widths (6 cols: Col=A, Area=B, Category_Path=C, Attribute=D, Type=E, Unit=F)
  const legendWidths: Record<string, number> = { A: 6, B: 12, C: 32, D: 16, E: 10, F: 10 };
  for (const [letter, width] of Object.entries(legendWidths)) {
    const col = ws.getColumn(letter);
    if (!col.width || col.width < width) col.width = width;
  }

  // ──────────────────────────────────────────
  // HELP EVENTS SHEET
  // ──────────────────────────────────────────
  _createHelpEventsSheet(wb);
}

// ─────────────────────────────────────────────
// Public API — thin wrapper (unified workbook)
// ─────────────────────────────────────────────

/**
 * Create the full unified workbook and return as ArrayBuffer.
 *
 * @param events          Leaf events (already merged via mergeSessionEvents)
 * @param attrDefs        Attribute definitions for all relevant categories
 * @param categoriesDict  Category info keyed by category_id
 * @param sortOrder       Sort direction for event rows (default: newest first)
 * @param structureNodes    Optional: adds Structure + HelpStructure sheets
 * @param filterInfo        Optional: adds Filter sheet
 * @param structureOptions  Optional: filter scope for Structure sheet (same as event filter)
 */
export async function createEventsExcel(
  events:           ExportEvent[],
  attrDefs:         ExportAttrDef[],
  categoriesDict:   ExportCategoriesDict,
  sortOrder:        'asc' | 'desc' = 'desc',
  structureNodes?:  StructureNode[],
  filterInfo?:      FilterSheetInfo,
  structureOptions?: ExportStructureOptions,
): Promise<ArrayBuffer> {

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Events Tracker';
  wb.created = new Date();

  // Sheet 1 + 2: Events + HelpEvents
  await addActivitiesSheetsTo(wb, events, attrDefs, categoriesDict, sortOrder);

  // Sheet 3 + 4: Structure + HelpStructure (filtered same as events)
  if (structureNodes) {
    await addStructureSheetsTo(wb, structureNodes, structureOptions ?? {});
  }

  // Sheet 5: Filter (optional — Korak 5)
  if (filterInfo) {
    addFilterSheet(wb, filterInfo);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// ─────────────────────────────────────────────
// HelpEvents sheet
// ─────────────────────────────────────────────

function _createHelpEventsSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('HelpEvents');

  type HelpLine = { text: string; fill?: ExcelJS.Fill };

  const lines: HelpLine[] = [
    { text: 'EVENTS TRACKER — Excel Export/Import Help V1.2 (collab)' },
    { text: '' },
    { text: '🎯 IMPORTANT: ATTRIBUTE LEGEND = SOURCE OF TRUTH' },
    { text: '' },
    { text: 'The ATTRIBUTE LEGEND tells import which Excel column contains which attribute.' },
    { text: 'You MUST keep Legend synchronized with your column structure!' },
    { text: '' },
    { text: '═══════════════════════════════════════════════════════' },
    { text: '' },
    { text: '📋 FILE STRUCTURE:' },
    { text: '' },
    { text: '1. ATTRIBUTE LEGEND (top section)' },
    { text: '   Col: Column letter (H, I, J...) for this attribute in EVENT DATA' },
    { text: '   Area / Category_Path / Attribute: identify the attribute' },
    { text: '   Type / Unit: attribute properties' },
    { text: '   → Full details (default, min, max) available in the Structure sheet' },
    { text: '   Rows grouped (click +/- ABOVE group to expand/collapse)' },
    { text: '' },
    { text: '2. EVENT DATA (bottom section)' },
    { text: '   Fixed columns: event_id(A), Area(B), Category_Path(C),' },
    { text: '     event_date(D), session_start(E), created_at(F), User(G), leaf comment(H)' },
    { text: '   User column (G) is grouped — click [-] above column G to collapse it' },
    { text: '   Attribute columns start at I with "attr_name (Category)" headers' },
    { text: '   AutoFilter enabled, title row shows SUMs (respects filters)' },
    { text: '' },
    { text: '═══════════════════════════════════════════════════════' },
    { text: '' },
    { text: '🎨 COLOR CODING:' },
    { text: '' },
    { text: 'PINK = READ-ONLY',         fill: PINK_FILL },
    { text: '   event_id, Area, Category_Path' },
    { text: '' },
    { text: 'BLUE = EDITABLE',          fill: BLUE_FILL },
    { text: '   event_date  : date (YYYY-MM-DD)' },
    { text: '   session_start: time (HH:MM, e.g. 14:30)' },
    { text: '   created_at  : time with seconds (HH:mm:ss, e.g. 14:30:05)' },
    { text: '   leaf comment: notes for this activity' },
    { text: '   Relevant attributes for this category and parent categories' },
    { text: '' },
    { text: 'PINK (col G — User) = READ-ONLY', fill: PINK_FILL },
    { text: '   Email of the user who recorded the event.' },
    { text: '   Informational — not editable. On import: use Smart Import options.' },
    { text: '' },
    { text: '   ⚠️ Validation: created_at must be >= session_start.' },
    { text: '   If not, import will report a validation error for that row.' },
    { text: '' },
    { text: 'ORANGE = NOT RELEVANT',    fill: ORANGE_FILL },
    { text: '   Attribute belongs to different category branch – leave empty.' },
    { text: '' },
    { text: '═══════════════════════════════════════════════════════' },
    { text: '' },
    { text: '✏️ HOW TO EDIT:' },
    { text: '' },
    { text: 'UPDATE EXISTING EVENTS:' },
    { text: '  1. Find row with event_id filled (UUID in column A)' },
    { text: '  2. Change BLUE columns only' },
    { text: '  3. Save and import' },
    { text: '' },
    { text: 'CREATE NEW EVENTS:' },
    { text: '  1. Add row at bottom, leave event_id EMPTY' },
    { text: '  2. Fill Area, Category_Path (must exist in your structure)' },
    { text: '  3. Fill event_date (required, YYYY-MM-DD)' },
    { text: '  4. Fill session_start (optional, HH:MM, defaults to 09:00)' },
    { text: '  5. Fill created_at (optional, HH:mm:ss, defaults to session_start + 1s)' },
    { text: '  6. User (col G): leave as-is or set email for Smart Import' },
    { text: '  7. Fill relevant attribute values (blue cells)' },
    { text: '  8. Save and import' },
    { text: '' },
    { text: '═══════════════════════════════════════════════════════' },
    { text: '' },
    { text: '✂️ HOW TO REMOVE ATTRIBUTES:' },
    { text: '' },
    { text: 'OPTION 1 (SIMPLEST): Delete Legend rows' },
    { text: '  Delete unwanted rows from ATTRIBUTE LEGEND.' },
    { text: '  Do NOT touch EVENT DATA columns.' },
    { text: '  Save and import → attribute ignored ✅' },
    { text: '' },
    { text: 'OPTION 2: Delete columns + update Legend' },
    { text: '  Delete unwanted columns from EVENT DATA.' },
    { text: '  UPDATE "Col" letters in ATTRIBUTE LEGEND to match new positions.' },
    { text: '  Save and import ✅' },
    { text: '' },
    { text: '⚠️ If you delete columns without updating Legend, import will FAIL.' },
    { text: '' },
    { text: '═══════════════════════════════════════════════════════' },
    { text: '' },
    { text: '💡 TIPS:' },
    { text: '  - Use AutoFilter to show only specific categories/dates' },
    { text: '  - Collapse LEGEND groups to see more EVENT DATA' },
    { text: '  - SUM row updates automatically when you filter' },
    { text: '  - Orange cells can be left empty (not relevant)' },
    { text: '  - Do NOT change event_id values' },
    { text: '  - Empty cells = no value (not zero)' },
  ];

  for (let r = 0; r < lines.length; r++) {
    const { text, fill } = lines[r];
    const cell = ws.getCell(r + 1, 1);
    cell.value = text || null;
    if (fill) cell.fill = fill;
    if (r === 0) {
      cell.font = { bold: true, size: 14 };
    } else if (text && !text.startsWith(' ') && !text.startsWith('═') && text.endsWith(':')) {
      cell.font = { bold: true, size: 11 };
    }
  }

  ws.getColumn('A').width = 78;
}

// ─────────────────────────────────────────────
// Session merging (Option A: parent attrs merged into first leaf row)
// ─────────────────────────────────────────────
//
// Strategija (Opcija A):
//   1. Odvoji leaf evente od parent evenata
//   2. Grupiraj leaf evente po (session_start + leafCategoryId) → jedan lanac
//   3. Za svaki lanac: merge parent atribute u PRVI leaf red
//   4. Ostali leaf redovi lanca ostaju bez parent atributa
//   5. Parent eventi se NE exportaju kao zasebni redovi
//
// Rezultat: roundtrip Excel → Import čita parent atribute iz prvog leaf reda (P3 merge).

export function mergeSessionEvents(
  events:         ExportEvent[],
  categoriesDict: ExportCategoriesDict,
): ExportEvent[] {

  // Step 1: Identify leaf categories (not a parent of anyone)
  const parentCatIds = new Set(
    Object.values(categoriesDict)
      .map(c => (c as { parent_category_id?: string | null }).parent_category_id)
      .filter((id): id is string => !!id)
  );
  const isLeaf = (catId: string) => !parentCatIds.has(catId);

  // Step 2: Separate leaf vs parent events
  const leafEvents   = events.filter(e => isLeaf(e.category_id));
  const parentEvents = events.filter(e => !isLeaf(e.category_id));

  // Step 3: Build parent attrs lookup: "session_start__catId" → event_attributes[]
  const parentAttrsByKey = new Map<string, NonNullable<ExportEvent['event_attributes']>>();
  for (const pe of parentEvents) {
    const key = `${pe.session_start ?? ''}__${pe.category_id}`;
    parentAttrsByKey.set(key, pe.event_attributes ?? []);
  }

  // Step 4: Group leaf events by (session_start + leafCategoryId) = jedan lanac
  const leafGroups = new Map<string, ExportEvent[]>();
  for (const le of leafEvents) {
    const key = `${le.session_start ?? ''}__${le.category_id}`;
    if (!leafGroups.has(key)) leafGroups.set(key, []);
    leafGroups.get(key)!.push(le);
  }

  const result: ExportEvent[] = [];

  for (const groupLeafEvents of leafGroups.values()) {
    groupLeafEvents.sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0;
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return a.created_at.localeCompare(b.created_at);
    });

    const firstLeaf = groupLeafEvents[0];

    const allParentAttrs: NonNullable<ExportEvent['event_attributes']> = [];
    let walkCatId: string | null =
      (categoriesDict[firstLeaf.category_id] as { parent_category_id?: string | null })
        ?.parent_category_id ?? null;

    while (walkCatId) {
      const key         = `${firstLeaf.session_start ?? ''}__${walkCatId}`;
      const parentAttrs = parentAttrsByKey.get(key);
      if (parentAttrs) allParentAttrs.push(...parentAttrs);
      walkCatId =
        (categoriesDict[walkCatId] as { parent_category_id?: string | null })
          ?.parent_category_id ?? null;
    }

    result.push({
      ...firstLeaf,
      event_attributes: [...(firstLeaf.event_attributes ?? []), ...allParentAttrs],
    });

    for (let i = 1; i < groupLeafEvents.length; i++) {
      result.push(groupLeafEvents[i]);
    }
  }

  return result;
}
