/**
 * Events Tracker – Excel Export Engine
 * =====================================
 * Port of Streamlit excel_events_io.py V2.5.8 → TypeScript / ExcelJS
 * Version: 1.0.0
 *
 * Format:
 *   Sheet "Events":
 *     Section 1: ATTRIBUTE LEGEND  (row groups collapsed, col groups F-I)
 *     Section 2: EVENT DATA        (autofilter, freeze at col K, SUBTOTAL)
 *   Sheet "Help"
 *
 * Fixed columns (EVENT DATA):
 *   A event_id        PINK  read-only
 *   B Area            PINK  read-only
 *   C Category_Path   PINK  read-only
 *   D event_date      BLUE  Excel DATE format YYYY-MM-DD
 *   E session_start   BLUE  text HH:MM
 *   F created_at      BLUE  text HH:mm:ss  (editable; validates >= session_start on import)
 *   G comment         BLUE  merged G:J
 *   H..J              BLUE  padding (part of comment merge)
 *   K+                BLUE/ORANGE  attribute columns
 */

import ExcelJS from 'exceljs';
import type {
  ExportCategoriesDict,
  ExportAttrDef,
  ExportEvent,
} from './excelTypes';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PINK_FILL: ExcelJS.Fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6F0' } };
const BLUE_FILL: ExcelJS.Fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
const ORANGE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
const LEGEND_HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
const SEPARATOR_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD0E0' } };

const HEADER_FONT: Partial<ExcelJS.Font>  = { color: { argb: 'FFFFFFFF' }, bold: true };
const TITLE_FONT: Partial<ExcelJS.Font>   = { bold: true, size: 12 };

const THIN_BORDER = {
  top:    { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  left:   { style: 'thin' as const },
  right:  { style: 'thin' as const },
};

// Fixed columns – ORDER MATTERS (matches column indices A-G)
export const FIXED_COLUMNS = [
  'event_id',
  'Area',
  'Category_Path',
  'event_date',
  'session_start',
  'created_at',
  'comment',
] as const;

export const FIXED_COL_COUNT = FIXED_COLUMNS.length; // 7
export const PADDING_COLS    = 3;                     // comment merged over G:J (3 padding cols)
export const ATTR_COL_START  = FIXED_COL_COUNT + PADDING_COLS + 1; // 11 → K

// LEGEND columns (rows, not event data)
const LEGEND_COLS = ['Col', 'Area', 'Category_Path', 'Attribute', 'Type', 'Default', 'Min', 'Max', 'Unit'];

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

/** Parse YYYY-MM-DD string → Excel-compatible Date object (local midnight) */
function parseEventDate(dateStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d);
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
// Main export function
// ─────────────────────────────────────────────

export async function createEventsExcel(
  events:          ExportEvent[],
  attrDefs:        ExportAttrDef[],
  categoriesDict:  ExportCategoriesDict,
): Promise<ArrayBuffer> {

  const { attrMeta, attrColumns, attrByCat } = buildAttrMeta(attrDefs, categoriesDict);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Events Tracker';
  wb.created  = new Date();

  const ws = wb.addWorksheet('Events');

  // Outline summary ABOVE groups (ExcelJS default is below; we set via worksheet properties)
  ws.properties.outlineLevelRow = 1;

  // ──────────────────────────────────────────
  // SECTION 1: ATTRIBUTE LEGEND
  // ──────────────────────────────────────────
  let row = 1;

  // Title
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'ATTRIBUTE LEGEND:';
  titleCell.font  = TITLE_FONT;
  row++;

  // Header
  for (let ci = 0; ci < LEGEND_COLS.length; ci++) {
    const cell = ws.getCell(row, ci + 1);
    cell.value     = LEGEND_COLS[ci];
    cell.fill      = LEGEND_HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  row++;

  // const legendDataStart = row;  // reserved for future grouping
  const legendRows: number[] = [];

  for (let idx = 0; idx < attrColumns.length; idx++) {
    const { attrName, attrDefId } = attrColumns[idx];
    const meta    = attrMeta.get(attrDefId)!;
    const colIdx  = ATTR_COL_START + idx;
    const letter  = colLetter(colIdx);

    const rowData = [
      letter,
      meta.areaName,
      meta.categoryPath,
      attrName,
      meta.dataType,
      meta.defaultValue,
      meta.min,
      meta.max,
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

  // const legendDataEnd = row - 1;  // reserved for future grouping

  // Row grouping (smart chunks of ~10)
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
      for (let ci = 1; ci <= 9; ci++) {
        const cell = ws.getCell(separatorRowNum, ci);
        cell.font = { bold: true };
        cell.fill = SEPARATOR_FILL;
      }

      // Group rows AFTER separator
      if (endIdx > startIdx) {
        for (let i = startIdx + 1; i <= endIdx; i++) {
          const wsRow = ws.getRow(legendRows[i]);
          wsRow.outlineLevel = 1;
          wsRow.hidden       = true;
        }
      }
    }
  }

  // Column grouping for LEGEND cols F-I (Default / Min / Max / Unit)
  // These are columns F, G, H, I of the LEGEND section (cols 6,7,8,9)
  for (const letter of ['F', 'G', 'H', 'I']) {
    ws.getColumn(letter).outlineLevel = 1;
  }

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
  // Subtotals filled in after data rows
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

  // Fixed headers + padding + attr headers
  const allHeaders = [
    ...FIXED_COLUMNS,
    ...Array(PADDING_COLS).fill(''),
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
  // B.1.1: Sort events by created_at ASC so rows appear in chronological order.
  // Nulls go last (events without created_at sort after timed events).
  const sortedEvents = [...events].sort((a, b) => {
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
      eventDateObj,        // Excel DATE cell (col D)
      sessionTime,         // text HH:MM (col E)
      createdTime,         // text HH:mm:ss (col F)
    ];

    for (let ci = 0; ci < fixedData.length; ci++) {
      const colNum = ci + 1;
      const cell   = ws.getCell(row, colNum);
      cell.value   = fixedData[ci];
      cell.border  = THIN_BORDER;
      cell.alignment = { horizontal: 'left', vertical: 'top' };

      if (colNum <= 3) {
        // A, B, C: PINK read-only
        cell.fill = PINK_FILL;
      } else if (colNum === 4) {
        // D: event_date – BLUE, Excel DATE format
        cell.fill     = BLUE_FILL;
        cell.numFmt   = 'YYYY-MM-DD';
      } else {
        // E, F: BLUE, text format
        cell.fill   = BLUE_FILL;
        cell.numFmt = '@';
      }
    }

    // ---- Column G: comment (merged G:J) ----
    const commentColStart = FIXED_COL_COUNT;                    // 7 → G
    const commentColEnd   = FIXED_COL_COUNT + PADDING_COLS;     // 10 → J
    const commentValue    = event.comment ?? '';

    ws.mergeCells(row, commentColStart, row, commentColEnd);
    const commentCell = ws.getCell(row, commentColStart);
    commentCell.value     = commentValue || null;
    commentCell.fill      = BLUE_FILL;
    commentCell.border    = THIN_BORDER;
    commentCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: false };

    // Apply border to all merged cells
    for (let ci = commentColStart; ci <= commentColEnd; ci++) {
      ws.getCell(row, ci).fill   = BLUE_FILL;
      ws.getCell(row, ci).border = THIN_BORDER;
    }

    // Row height
    ws.getRow(row).height = 20;
    if (commentValue && commentValue.length > 100) {
      commentCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      ws.getRow(row).height = 20 + Math.min(2, Math.floor(commentValue.length / 50)) * 15;
    }

    // ---- Attribute columns K+ ----
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
  // FREEZE PANES  (below header, right of comment: col K = xSplit 10)
  // ──────────────────────────────────────────
  ws.views = [{
    state:  'frozen',
    xSplit: ATTR_COL_START - 1,    // 10 → freeze cols A-J, first scrollable = K
    ySplit: eventDataStart - 1,    // freeze rows above data
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
  ws.getColumn('G').width = 30;   // comment (merged)
  ws.getColumn('H').width = 3;
  ws.getColumn('I').width = 3;
  ws.getColumn('J').width = 3;

  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    ws.getColumn(ATTR_COL_START + aidx).width = 13;
  }

  // Legend column widths (override if wider than event data columns)
  const legendWidths: Record<string, number> = { A: 6, B: 12, C: 32, D: 16, E: 10, F: 10, G: 8, H: 8, I: 10 };
  for (const [letter, width] of Object.entries(legendWidths)) {
    const col = ws.getColumn(letter);
    if (!col.width || col.width < width) col.width = width;
  }

  // ──────────────────────────────────────────
  // HELP SHEET
  // ──────────────────────────────────────────
  _createHelpSheet(wb);

  // Protect nothing – file should open directly in edit mode
  // (no workbook or worksheet protections)

  // ──────────────────────────────────────────
  // Write to buffer
  // ──────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────
// Help sheet
// ─────────────────────────────────────────────

function _createHelpSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Help');

  const lines = [
    ['EVENTS TRACKER - Excel Export/Import Help V1.0'],
    [''],
    ['🎯 IMPORTANT: ATTRIBUTE LEGEND = SOURCE OF TRUTH'],
    [''],
    ['The ATTRIBUTE LEGEND tells import which Excel column contains which attribute.'],
    ['You MUST keep Legend synchronized with your column structure!'],
    [''],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['📋 FILE STRUCTURE:'],
    [''],
    ['1. ATTRIBUTE LEGEND (top section)'],
    ['   Col: Column letter (K, L, M...) for this attribute in EVENT DATA'],
    ['   Area / Category_Path / Attribute: identify the attribute'],
    ['   Type / Default / Min / Max / Unit: attribute properties (cols F-I grouped)'],
    ['   Rows grouped (click +/- ABOVE group to expand/collapse)'],
    [''],
    ['2. EVENT DATA (bottom section)'],
    ['   Fixed columns: event_id(A), Area(B), Category_Path(C),'],
    ['     event_date(D), session_start(E), created_at(F), comment(G-J merged)'],
    ['   Attribute columns start at K with "attr_name (Category)" headers'],
    ['   AutoFilter enabled, title row shows SUMs (respects filters)'],
    [''],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['🎨 COLOR CODING:'],
    [''],
    ['🩷 PINK = READ-ONLY'],
    ['   event_id, Area, Category_Path'],
    [''],
    ['🔵 BLUE = EDITABLE'],
    ['   event_date  : date (YYYY-MM-DD)'],
    ['   session_start: time (HH:MM, e.g. 14:30)'],
    ['   created_at  : time with seconds (HH:mm:ss, e.g. 14:30:05)'],
    ['   comment     : notes'],
    ['   Relevant attributes for this category and parent categories'],
    [''],
    ['   ⚠️ Validation: created_at must be >= session_start.'],
    ['   If not, import will report a validation error for that row.'],
    [''],
    ['🟠 ORANGE = NOT RELEVANT'],
    ['   Attribute belongs to different category branch – leave empty.'],
    [''],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['✏️ HOW TO EDIT:'],
    [''],
    ['UPDATE EXISTING EVENTS:'],
    ['  1. Find row with event_id filled (UUID in column A)'],
    ['  2. Change BLUE columns only'],
    ['  3. Save and import'],
    [''],
    ['CREATE NEW EVENTS:'],
    ['  1. Add row at bottom, leave event_id EMPTY'],
    ['  2. Fill Area, Category_Path (must exist in your structure)'],
    ['  3. Fill event_date (required, YYYY-MM-DD)'],
    ['  4. Fill session_start (optional, HH:MM, defaults to 09:00)'],
    ['  5. Fill created_at (optional, HH:mm:ss, defaults to session_start + 1s)'],
    ['  6. Fill relevant attribute values (blue cells)'],
    ['  7. Save and import'],
    [''],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['✂️ HOW TO REMOVE ATTRIBUTES:'],
    [''],
    ['OPTION 1 (SIMPLEST): Delete Legend rows'],
    ['  Delete unwanted rows from ATTRIBUTE LEGEND.'],
    ['  Do NOT touch EVENT DATA columns.'],
    ['  Save and import → attribute ignored ✅'],
    [''],
    ['OPTION 2: Delete columns + update Legend'],
    ['  Delete unwanted columns from EVENT DATA.'],
    ['  UPDATE "Col" letters in ATTRIBUTE LEGEND to match new positions.'],
    ['  Save and import ✅'],
    [''],
    ['⚠️ If you delete columns without updating Legend, import will FAIL.'],
    [''],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['💡 TIPS:'],
    ['  - Use AutoFilter to show only specific categories/dates'],
    ['  - Collapse LEGEND groups to see more EVENT DATA'],
    ['  - SUM row updates automatically when you filter'],
    ['  - Orange cells can be left empty (not relevant)'],
    ['  - Do NOT change event_id values'],
    ['  - Empty cells = no value (not zero)'],
  ];

  for (let r = 0; r < lines.length; r++) {
    const cell = ws.getCell(r + 1, 1);
    cell.value = lines[r][0] || null;
    if (r === 0) {
      cell.font = { bold: true, size: 14 };
    } else if (lines[r][0] && !lines[r][0].startsWith(' ') && !lines[r][0].startsWith('═') && lines[r][0].endsWith(':')) {
      cell.font = { bold: true, size: 11 };
    }
  }

  ws.getColumn('A').width = 78;
}

// ─────────────────────────────────────────────
// Session merging (port of Python merge_session_events)
// ─────────────────────────────────────────────

export function mergeSessionEvents(
  events:         ExportEvent[],
  categoriesDict: ExportCategoriesDict,
): ExportEvent[] {
  // Group by (session_start, comment) – same as Python V2.5.6
  const sessions = new Map<string, ExportEvent[]>();

  for (const event of events) {
    const key = `${event.session_start ?? ''}||${event.comment ?? ''}`;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key)!.push(event);
  }

  const merged: ExportEvent[] = [];

  for (const sessionEvents of sessions.values()) {
    if (sessionEvents.length === 1) {
      merged.push(sessionEvents[0]);
      continue;
    }

    // Get levels for each event
    const withLevels = sessionEvents.map(e => ({
      event: e,
      level: (categoriesDict[e.category_id] as { level?: number })?.level ?? 0,
    })).sort((a, b) => a.level - b.level);

    const levels       = withLevels.map(x => x.level);
    const uniqueLevels = new Set(levels);

    if (uniqueLevels.size === levels.length && uniqueLevels.size > 1) {
      // Hierarchical chain → merge all attrs into leaf event
      const leaf: ExportEvent = { ...withLevels[withLevels.length - 1].event };
      leaf.event_attributes   = withLevels.flatMap(x => x.event.event_attributes ?? []);
      merged.push(leaf);
    } else {
      // Independent events at same level → export separately
      merged.push(...sessionEvents);
    }
  }

  return merged;
}
