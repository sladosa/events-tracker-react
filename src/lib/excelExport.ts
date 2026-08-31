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
import { applyProfileToWorkbook, getProfileAttrOrder, type ExportProfile } from './exportProfile';
import { computeRowFingerprint, ROW_HASH_HEADER } from './excelFingerprint';
import { DATE_ATTR_NUMFMT, canonicalDatetime, datetimeCellValue } from './excelDatetime';

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

/**
 * Header of the delete-flag column (S107w). Sits to the right of row_hash and is
 * found on import by scanning the header row, so its position may change freely.
 *
 * The only accepted value is DELETE_MARKER — deliberately NOT TRUE/FALSE, which
 * booleans like `Rate?` use: a destructive flag must not look like an attribute,
 * and TRUE is the value most likely to survive a careless fill-down. Any other
 * value is an import error rather than a silent skip; silently ignoring it is
 * how a deletion the user asked for goes missing.
 */
export const DELETE_COL_HEADER = 'Delete?';
export const DELETE_MARKER     = 'DELETE';

// LEGEND columns (7 cols: Col, Area, Category_Path, Attribute, Type, Default, Description)
const LEGEND_COLS = ['Col', 'Area', 'Category_Path', 'Attribute', 'Type', 'Default', 'Description'];

// ─────────────────────────────────────────────
// Import-report annotations (S107w)
// ─────────────────────────────────────────────

/**
 * What an import did to one event, written into extra columns at the far right
 * of the report workbook. Purely informational: the columns sit to the right of
 * every column import reads (fixed A–H, LEGEND-mapped attrs, row_hash, Delete?),
 * so the report re-imports as an ordinary export file.
 */
export interface RowAnnotation {
  /** 'Created' | 'Updated' */
  result:    string;
  /** Row number in the imported file this event came from */
  sourceRow: number;
  /** Field names changed by an update ('' for a create) */
  changed:   string;
}

/** eventId → annotation */
export type RowAnnotations = Map<string, RowAnnotation>;

const ANNOTATION_HEADERS = ['Result', 'Source row', 'Changed'] as const;

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

interface AttrDependsOn {
  attributeSlug: string;
  optionsMap: Record<string, string[]>;
}

interface AttrMeta {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryPath: string;
  areaName: string;
  dataType: string;
  unit: string;
  defaultValue: string | number;
  min: string | number;
  max: string | number;
  sortOrder: number;
  description: string;
  suggestOptions: string[];
  dependsOn: AttrDependsOn | null;
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

    // Extract suggest options from validation_rules
    const vr = validation as Record<string, unknown>;
    let suggestOptions: string[] = [];
    if (Array.isArray(vr.options)) suggestOptions = vr.options.map(String);
    else if (Array.isArray(vr.suggest)) suggestOptions = vr.suggest.map(String);
    if (vr.type === 'suggest' && suggestOptions.length === 0 && typeof vr.options === 'string') {
      suggestOptions = (vr.options as string).split('|').map(s => s.trim()).filter(Boolean);
    }

    // Extract depends_on
    let dependsOn: AttrDependsOn | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vrAny = validation as any;
    if (vrAny?.depends_on?.attribute_slug && vrAny.depends_on.options_map) {
      dependsOn = { attributeSlug: vrAny.depends_on.attribute_slug, optionsMap: vrAny.depends_on.options_map };
    } else if (vrAny?.dropdown?.depends_on) {
      const dd = vrAny.dropdown.depends_on;
      if (dd.options_map) {
        dependsOn = { attributeSlug: dd.field, optionsMap: dd.options_map };
      } else if (dd.mapping) {
        const om: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(dd.mapping)) om[k] = [v as string];
        dependsOn = { attributeSlug: dd.field, optionsMap: om };
      }
    }

    attrMeta.set(def.id, {
      id:           def.id,
      name:         def.name,
      slug:         def.slug ?? '',
      categoryId:   def.category_id,
      categoryPath: catInfo.full_path ?? 'Unknown',
      areaName:     catInfo.area_name ?? 'Unknown',
      dataType,
      unit:         def.unit ?? '',
      defaultValue: defaultVal,
      min:          minVal,
      max:          maxVal,
      sortOrder:    def.sort_order ?? 0,
      description:  def.description ?? '',
      suggestOptions,
      dependsOn,
    });

    const key = `${catInfo.full_path ?? ''}||${def.name}||${def.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      attrColumns.push({ categoryPath: catInfo.full_path ?? 'Unknown', attrName: def.name, attrDefId: def.id });
    }

    if (!attrByCat.has(def.category_id)) attrByCat.set(def.category_id, new Set());
    attrByCat.get(def.category_id)!.add(def.id);
  }

  // Sort columns by Area → CategoryPath → sort_order (matches Structure tab definition order)
  attrColumns.sort((a, b) => {
    const ma = attrMeta.get(a.attrDefId)!;
    const mb = attrMeta.get(b.attrDefId)!;
    if (ma.areaName     !== mb.areaName)     return ma.areaName.localeCompare(mb.areaName);
    if (ma.categoryPath !== mb.categoryPath) return ma.categoryPath.localeCompare(mb.categoryPath);
    return ma.sortOrder - mb.sortOrder;
  });

  return { attrMeta, attrColumns, attrByCat };
}

// ─────────────────────────────────────────────
// Dependent dropdowns via INDIRECT + hidden sheet
// ─────────────────────────────────────────────

const DIACRITICAL_MAP: [string, string][] = [
  ['č', 'c'], ['ć', 'c'], ['š', 's'], ['ž', 'z'], ['đ', 'd'],
  ['Č', 'C'], ['Ć', 'C'], ['Š', 'S'], ['Ž', 'Z'], ['Đ', 'D'],
];

function transliterateDiacriticals(s: string): string {
  let result = s;
  for (const [from, to] of DIACRITICAL_MAP) result = result.replaceAll(from, to);
  return result;
}

function sanitizeNamedRange(s: string): string {
  return transliterateDiacriticals(s).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function addDependentDropdowns(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  attrMeta: Map<string, AttrMeta>,
  attrColumns: AttrColumn[],
  eventDataStart: number,
  eventDataEnd: number,
): void {
  // Collect attrs that have dependsOn
  const depAttrs: { meta: AttrMeta; colIdx: number }[] = [];
  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    const meta = attrMeta.get(attrColumns[aidx].attrDefId)!;
    if (meta.dependsOn) depAttrs.push({ meta, colIdx: aidx });
  }
  if (depAttrs.length === 0) return;

  // Build parent slug → column index map
  const slugToColIdx = new Map<string, number>();
  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    const m = attrMeta.get(attrColumns[aidx].attrDefId)!;
    if (m.slug) slugToColIdx.set(m.slug, aidx);
  }

  // Create hidden sheet for named range data
  const ddSheet = wb.addWorksheet('DropdownData', { state: 'veryHidden' });
  let ddCol = 1;

  for (const { meta, colIdx } of depAttrs) {
    const dep = meta.dependsOn!;
    const parentColIdx = slugToColIdx.get(dep.attributeSlug);
    if (parentColIdx === undefined) continue;

    const parentColNum = ATTR_COL_START + parentColIdx;
    const parentColLtr = colLetter(parentColNum);
    const depColNum    = ATTR_COL_START + colIdx;

    // prefix shared by all named ranges for this dependency
    const prefix = sanitizeNamedRange(`Dep_${dep.attributeSlug}`);

    // Write each parent value's options as a column on DropdownData
    const parentValues = Object.keys(dep.optionsMap);
    const rangeNameByValue = new Map<string, string>();

    for (const pv of parentValues) {
      const options = dep.optionsMap[pv];
      if (!options || options.length === 0) continue;

      const rangeName = sanitizeNamedRange(`${prefix}_${pv}`);
      rangeNameByValue.set(pv, rangeName);

      // Write header + options in this column
      ddSheet.getCell(1, ddCol).value = `${dep.attributeSlug}=${pv}`;
      for (let i = 0; i < options.length; i++) {
        ddSheet.getCell(2 + i, ddCol).value = options[i];
      }

      // Define named range (absolute refs with $)
      const cLtr = colLetter(ddCol);
      const rangeStr = `DropdownData!$${cLtr}$2:$${cLtr}$${1 + options.length}`;
      wb.definedNames.add(rangeStr, rangeName);

      ddCol++;
    }

    if (rangeNameByValue.size === 0) continue;

    // Set INDIRECT-based Data Validation on the dependent column.
    // The SUBSTITUTE chain must produce exactly the sanitized named range name.
    // sanitizeNamedRange replaces all non-[A-Za-z0-9_] with _,
    // so the Excel formula does the same transformation at runtime.
    for (let r = eventDataStart; r <= eventDataEnd; r++) {
      const parentRef = `${parentColLtr}${r}`;
      // Nested SUBSTITUTE: special chars + diacriticals → match sanitizeNamedRange output
      let sub = parentRef;
      for (const ch of [' ', '/', '-', '.', '(', ')', ',', ':', '+', '&']) {
        sub = `SUBSTITUTE(${sub},"${ch}","_")`;
      }
      for (const [from, to] of DIACRITICAL_MAP) {
        sub = `SUBSTITUTE(${sub},"${from}","${to}")`;
      }
      const formula = `INDIRECT("${prefix}_"&${sub})`;
      ws.getCell(r, depColNum).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showInputMessage: true,
        promptTitle: meta.name,
        prompt: `Depends on: ${dep.attributeSlug}`,
      };
    }
  }

  // If no data was written, remove the empty sheet
  if (ddCol === 1) {
    wb.removeWorksheet(ddSheet.id);
  }
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
  attrColumnOrder?: number[],
  annotations?: RowAnnotations,
  /**
   * Drugi blok redaka, odvojen prazninom i pisan ISTIM pisacem (dakle s ispravnim
   * `row_hash`om, bojama i dropdownima). Delta sheet time dobiva sekciju „planirano"
   * ispod praznih redaka, a da se logika pisanja retka nigdje ne duplicira.
   * ⚠ Praznina mora biti >= broja praznih redaka koje delta alat poslije upisuje,
   *   inace bi ih upisao PREKO ovog bloka.
   */
  trailing?: { events: ExportEvent[]; gapRows: number },
): Promise<void> {

  const built = buildAttrMeta(attrDefs, categoriesDict);
  const attrMeta = built.attrMeta;
  const attrByCat = built.attrByCat;

  // Apply custom column order from profile (if provided)
  const attrColumns = attrColumnOrder
    ? attrColumnOrder.map(i => built.attrColumns[i]).filter(Boolean)
    : built.attrColumns;

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

    // 7 cols: Col, Area, Category_Path, Attribute, Type, Default, Description
    const rowData = [
      letter,
      meta.areaName,
      meta.categoryPath,
      attrName,
      meta.dataType,
      meta.defaultValue === '' ? null : meta.defaultValue,
      meta.description,
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
  // Max / Min / Sum summary rows
  // (placed before EVENT DATA title; importer skips them — col A is not a valid column letter)
  // Formulas are written after data rows when eventDataStart/End are known.
  // ──────────────────────────────────────────
  const maxSummaryRow = row++;
  const minSummaryRow = row++;
  const sumSummaryRow = row++;

  const summaryLabelFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  for (const [summaryRow, label] of [
    [maxSummaryRow, 'Max (if relevant) ->'],
    [minSummaryRow, 'Min (if relevant) ->'],
    [sumSummaryRow, 'Summ (if relevant) ->'],
  ] as [number, string][]) {
    const labelCell = ws.getCell(summaryRow, FIXED_COL_COUNT);  // col H
    labelCell.value     = label;
    labelCell.font      = { italic: true, color: { argb: 'FF666666' } };
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    labelCell.fill      = summaryLabelFill;
    ws.getRow(summaryRow).outlineLevel = 1;
  }

  // ──────────────────────────────────────────
  // SECTION 2: EVENT DATA
  // ──────────────────────────────────────────
  ws.getCell(row, 1).value = 'EVENT DATA:';
  ws.getCell(row, 1).font  = TITLE_FONT;
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

  // Fixed display headers + attr headers (no padding cols) + row_hash + Delete?
  // (+ report annotation columns, only when this workbook is an import report)
  const allHeaders = [
    ...FIXED_DISPLAY_HEADERS,
    ...attrHeaderStrings,
    ROW_HASH_HEADER,
    DELETE_COL_HEADER,
    ...(annotations ? ANNOTATION_HEADERS : []),
  ];

  for (let ci = 0; ci < allHeaders.length; ci++) {
    const cell = ws.getCell(row, ci + 1);
    cell.value     = allHeaders[ci] || null;
    cell.fill      = HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  }
  row++;

  const eventDataStart = row;

  // Trailing columns, right of the last attribute
  const rowHashColNum  = ATTR_COL_START + attrColumns.length;
  const deleteColNum   = rowHashColNum + 1;
  const annotStartCol  = deleteColNum + 1;
  const lastColNum     = annotations ? annotStartCol + ANNOTATION_HEADERS.length - 1 : deleteColNum;

  // ──────────────────────────────────────────
  // EVENT DATA ROWS
  // ──────────────────────────────────────────
  // Sort events:
  //   1. event_date  – direction controlled by sortOrder (newest ↓ default)
  //   2. session_start – same direction
  //   3. created_at – always ASC (leaf events within a session in chronological order)
  const byDateThenSession = (a: ExportEvent, b: ExportEvent) => {
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
  };

  // Dva bloka se sortiraju ZASEBNO — inace bi se `trailing` retci uvukli medju
  // glavne po datumu, a upravo ih se zeli drzati odvojeno (planirane kartcne
  // stavke su starije od prozora, pa bi inace ili nestale ili se rasule).
  const sortedEvents = [...events].sort(byDateThenSession);
  const trailingSorted = trailing ? [...trailing.events].sort(byDateThenSession) : [];
  const mainCount = sortedEvents.length;
  const allRows = [...sortedEvents, ...trailingSorted];

  let writtenIdx = 0;
  for (const event of allRows) {
    // Praznina izmedju blokova: `readLayout` u deltaSheet.ts po njoj prepoznaje
    // gdje glavni blok zavrsava, a import prazan redak ne vidi kao redak (kol. B).
    if (trailing && writtenIdx === mainCount) row += trailing.gapRows;
    writtenIdx++;
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

      // Datum-atribut ide kao PRAVA datumska ćelija (Faza 0.1) — inače korisnik
      // u koloni vidi `2025-01-07T12:00:00+00:00` i ne može je provjeriti
      // Data Validationom. Padne li parsiranje, ostaje sirova vrijednost.
      const dateCell = meta.dataType === 'datetime' ? datetimeCellValue(value) : null;
      cell.value  = dateCell ?? value;
      cell.border = THIN_BORDER;
      if (dateCell) cell.numFmt = DATE_ATTR_NUMFMT;

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

    // ---- row_hash column (S107 D7: fingerprint for untouched-row skip on import) ----
    // Attr record mirrors parseDataRows semantics: keyed by attr NAME, iterated in
    // column order (duplicate names: later non-empty column wins), empty cells skipped.
    const hashAttrs: Record<string, string | number | boolean | null> = {};
    for (const { attrDefId, attrName } of attrColumns) {
      const v = attrValues.get(attrDefId) ?? null;
      if (v == null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      // ⚠ Datum se hašira u kanonskom obliku (`YYYY-MM-DDTHH:mm`) jer import iz
      // datumske ćelije proizvodi baš njega. Da se ovdje hašira sirova vrijednost
      // iz baze (`…T12:00:00+00:00`), otisak se nikad ne bi poklopio i svaki bi
      // redak pao u DB diff — skip nedirnutih redaka (D7) bi tiho prestao raditi.
      const meta = attrMeta.get(attrDefId);
      hashAttrs[attrName] = meta?.dataType === 'datetime' ? (canonicalDatetime(v) ?? v) : v;
    }
    const hashCell = ws.getCell(row, rowHashColNum);
    hashCell.value = computeRowFingerprint({
      event_id:      event.id,
      area:          catInfo.area_name ?? '',
      category_path: catInfo.full_path ?? '',
      event_date:    event.event_date,
      session_start: sessionTime,
      created_at:    createdTime,
      user_email:    event.user_email ?? '',
      comment:       commentValue,
      attributes:    hashAttrs,
    });
    hashCell.fill      = PINK_FILL;
    hashCell.border    = THIN_BORDER;
    hashCell.numFmt    = '@';
    hashCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // ---- Delete? column (S107w) — empty by default, dropdown added below ----
    const delCell = ws.getCell(row, deleteColNum);
    delCell.value     = null;
    delCell.fill      = BLUE_FILL;
    delCell.border    = THIN_BORDER;
    delCell.numFmt    = '@';
    delCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ---- Import-report annotation columns (report workbooks only) ----
    if (annotations) {
      const ann = annotations.get(event.id);
      const annValues: (string | number | null)[] = [
        ann?.result ?? null,
        ann?.sourceRow ?? null,
        ann?.changed || null,
      ];
      for (let ai = 0; ai < annValues.length; ai++) {
        const cell = ws.getCell(row, annotStartCol + ai);
        cell.value     = annValues[ai];
        cell.fill      = PINK_FILL;
        cell.border    = THIN_BORDER;
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }

    row++;
  }

  const eventDataEnd = row - 1;

  // ──────────────────────────────────────────
  // Data Validation (suggest dropdowns — static, non-dependent)
  // ──────────────────────────────────────────
  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    const { attrDefId } = attrColumns[aidx];
    const meta          = attrMeta.get(attrDefId)!;

    // Datum-kolona (Faza 0.1): provjera pri UPISU, ne pri uvozu. Bez nje se
    // tipfeleric u datumu vidi tek u izvještaju nakon uvoza — a tad je već
    // u bazi. Raspon je namjerno širok: rate sežu godinama unaprijed.
    // ⚠ `promptTitle` ≤ 32 i `prompt` ≤ 255 znaka, inače Excel nudi „repair".
    if (meta.dataType === 'datetime') {
      for (let r = eventDataStart; r <= eventDataEnd; r++) {
        ws.getCell(r, ATTR_COL_START + aidx).dataValidation = {
          type: 'date',
          operator: 'between',
          allowBlank: true,
          formulae: [new Date(Date.UTC(2000, 0, 1, 12)), new Date(Date.UTC(2040, 11, 31, 12))],
          showInputMessage: true,
          promptTitle: meta.name.slice(0, 32),
          prompt: 'Datum, npr. 7.1.2025. Prazno je dopusteno.',
          showErrorMessage: true,
          errorTitle: 'Nije datum',
          error: 'Upisite datum (npr. 7.1.2025), ne tekst.',
        };
      }
      continue;
    }

    if (meta.dependsOn) continue; // handled by addDependentDropdowns
    if (meta.suggestOptions.length === 0) continue;

    const colNum = ATTR_COL_START + aidx;
    const formulae = `"${meta.suggestOptions.join(',')}"`;

    // Excel inline list limit is 255 chars; use it when possible
    if (formulae.length <= 255) {
      for (let r = eventDataStart; r <= eventDataEnd; r++) {
        ws.getCell(r, colNum).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formulae],
          showInputMessage: true,
          promptTitle: meta.name,
          prompt: `Options: ${meta.suggestOptions.join(', ')}`,
        };
      }
    }
    // >255 chars: skip (would need hidden sheet + named range — future enhancement)
  }

  // Dependent dropdowns (INDIRECT + hidden DropdownData sheet)
  addDependentDropdowns(wb, ws, attrMeta, attrColumns, eventDataStart, eventDataEnd);

  // ──────────────────────────────────────────
  // Delete? column: dropdown + red row highlight  (S107w)
  // ──────────────────────────────────────────
  // allowBlank + a single-item list = the two states we accept, empty and DELETE.
  // showErrorMessage rejects anything else at typing time; import rejects it too,
  // for values that arrive by paste or from a hand-made file.
  // ⚠ Excel limits: promptTitle ≤32 chars, prompt ≤255, same for error fields.
  for (let r = eventDataStart; r <= eventDataEnd; r++) {
    ws.getCell(r, deleteColNum).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${DELETE_MARKER}"`],
      showInputMessage: true,
      promptTitle: 'Delete this record?',
      prompt: 'Pick DELETE to permanently remove this record when the file is imported. Leave empty to keep it.',
      showErrorMessage: true,
      // ⚠ OOXML pozna samo `stop | warning | information`. `'error'` Excel
      //   progura, ali openpyxl na njemu PADNE — a to je alat kojim se ovi isti
      //   fileovi pune iz izvoda (`fill_from_izvod.py`). Nevaljan atribut koji
      //   jedan čitač oprašta nije bezopasan: ruši drugi kraj lanca.
      errorStyle: 'stop',
      errorTitle: 'Only DELETE or empty',
      error: 'This column accepts only DELETE (from the dropdown) or an empty cell.',
    };
  }

  if (eventDataEnd >= eventDataStart) {
    const delLtr = colLetter(deleteColNum);
    ws.addConditionalFormatting({
      ref: `A${eventDataStart}:${colLetter(lastColNum)}${eventDataEnd}`,
      rules: [{
        type: 'expression',
        priority: 1,
        // Absolute column, relative row → the whole row lights up for the marked record
        formulae: [`$${delLtr}${eventDataStart}="${DELETE_MARKER}"`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } },
          font: { color: { argb: 'FF9C0006' }, bold: true },
        },
      }],
    });
  }

  // ──────────────────────────────────────────
  // SUBTOTAL formulas for Max / Min / Sum rows
  // Dynamic range: LOOKUP finds last non-empty row in col B → no hardcoded end row
  // SUBTOTAL(4=MAX, 5=MIN, 9=SUM) respects active autofilter
  // ──────────────────────────────────────────
  const bLetter = colLetter(2); // col B = Area
  const dynamicEnd = (colLtr: string) =>
    `INDEX(${colLtr}:${colLtr},LOOKUP(2,1/(${bLetter}${eventDataStart}:${bLetter}1048576<>""),ROW(${bLetter}${eventDataStart}:${bLetter}1048576)))`;

  for (let aidx = 0; aidx < attrColumns.length; aidx++) {
    const { attrDefId } = attrColumns[aidx];
    const meta          = attrMeta.get(attrDefId)!;
    if (meta.dataType !== 'number') continue;

    const colNum = ATTR_COL_START + aidx;
    const ltr    = colLetter(colNum);
    const rangeStart = `${ltr}${eventDataStart}`;
    const rangeEnd   = dynamicEnd(ltr);

    const maxCell = ws.getCell(maxSummaryRow, colNum);
    maxCell.value     = { formula: `SUBTOTAL(4,${rangeStart}:${rangeEnd})` };
    maxCell.alignment = { horizontal: 'right' };
    maxCell.fill      = summaryLabelFill;

    const minCell = ws.getCell(minSummaryRow, colNum);
    minCell.value     = { formula: `SUBTOTAL(5,${rangeStart}:${rangeEnd})` };
    minCell.alignment = { horizontal: 'right' };
    minCell.fill      = summaryLabelFill;

    const sumCell = ws.getCell(sumSummaryRow, colNum);
    sumCell.value     = { formula: `SUBTOTAL(9,${rangeStart}:${rangeEnd})` };
    sumCell.alignment = { horizontal: 'right' };
    sumCell.fill      = summaryLabelFill;
  }

  // ──────────────────────────────────────────
  // AUTOFILTER
  // ──────────────────────────────────────────
  // row_hash and Delete? MUST be inside the autofilter range so Excel sorts move
  // them with their row — a flag left behind by a sort would delete the wrong record
  ws.autoFilter = {
    from: { row: eventHeaderRow, column: 1 },
    to:   { row: eventDataEnd,   column: lastColNum },
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

  // row_hash column: narrow + grouped so users can collapse it (like User col)
  ws.getColumn(rowHashColNum).width = 12;
  ws.getColumn(rowHashColNum).outlineLevel = 1;

  // Delete? stays VISIBLE (never grouped) — a flag nobody can find is a flag
  // nobody can un-set
  ws.getColumn(deleteColNum).width = 10;

  if (annotations) {
    ws.getColumn(annotStartCol).width     = 10;  // Result
    ws.getColumn(annotStartCol + 1).width = 10;  // Source row
    ws.getColumn(annotStartCol + 2).width = 40;  // Changed
  }

  // Legend column widths (7 cols: Col=A..Unit=F, Description=G)
  // G also serves as User email col in data section — use max of both needs
  const legendWidths: Record<string, number> = { A: 6, B: 12, C: 32, D: 16, E: 10, F: 10, G: 40 };
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
  exportProfile?:   ExportProfile | null,
  annotations?:     RowAnnotations,
): Promise<ArrayBuffer> {

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Events Tracker';
  wb.created = new Date();

  // Compute column order from profile (if any)
  let attrColumnOrder: number[] | undefined;
  if (exportProfile) {
    const { attrMeta, attrColumns } = buildAttrMeta(attrDefs, categoriesDict);
    attrColumnOrder = getProfileAttrOrder(exportProfile, attrColumns, attrMeta);
  }

  // Sheet 1 + 2: Events + HelpEvents (with profile column order)
  await addActivitiesSheetsTo(wb, events, attrDefs, categoriesDict, sortOrder, attrColumnOrder, annotations);

  // Apply export profile (column grouping + widths) after sheet is built
  if (exportProfile) {
    applyProfileToWorkbook(wb, exportProfile, attrDefs, categoriesDict);
  }

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
    { text: '   Type / Default: attribute type and default value' },
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
    { text: 'DELETE EVENTS:' },
    { text: '  1. Find the row you want gone (event_id must be filled)' },
    { text: '  2. In the "Delete?" column (far right, next to row_hash) pick DELETE' },
    { text: '  3. Save and import — the import shows exactly what will disappear' },
    { text: '     and asks for a separate confirmation before deleting anything' },
    { text: '  Only DELETE or an empty cell are accepted — any other value is an error.' },
    { text: '  Deleting the last record of a session also removes its parent events.' },
    { text: '  ⚠ Deleting a row is permanent — there is no undo. Removing the ROW from' },
    { text: '     Excel does NOT delete anything; only the Delete? flag does.' },
    { text: '' },
    { text: '📄 IMPORT REPORT:' },
    { text: '' },
    { text: '  After every import a report file downloads automatically. It is a normal' },
    { text: '  export file (real event_id, valid row_hash, Delete? dropdown) listing only' },
    { text: '  the records that import just created or changed, plus three columns on the' },
    { text: '  far right: Result, Source row, Changed.' },
    { text: '  So if you spot a mistake — e.g. a duplicate you created by copying a row —' },
    { text: '  mark it DELETE in the report and import that same file back.' },
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
    { text: '📊 EXPORT PROFILES — saving a custom column layout:' },
    { text: '' },
    { text: '  An Export Profile remembers column ORDER, WIDTHS, and GROUPING' },
    { text: '  (collapsed/expanded) for future exports — no need to rearrange every time.' },
    { text: '' },
    { text: '  TO CHANGE COLUMN ORDER:' },
    { text: '  Reorder the ROWS in ATTRIBUTE LEGEND (top section) — that row order' },
    { text: '  becomes the column order. You do NOT need to physically move the' },
    { text: '  columns in EVENT DATA below — only the LEGEND row order matters.' },
    { text: '' },
    { text: '  TO CHANGE WIDTHS / GROUPING:' },
    { text: '  Resize or group/collapse the actual EVENT DATA columns as usual in Excel.' },
    { text: '' },
    { text: '  TO SAVE AS A PROFILE:' },
    { text: '  1. Edit LEGEND order + EVENT DATA widths/grouping as above, save the file' },
    { text: '  2. In the app: Export modal → "Import Profile" → pick this xlsx' },
    { text: '  3. Give it a name — it is now stored permanently for this Area' },
    { text: '  Once saved, the layout lives in the app (per Area) — this source xlsx' },
    { text: '  file is no longer needed; just pick the profile by name on future exports.' },
    { text: '' },
    { text: '  Profiles can also store FILTER overrides (date range, sort, comment' },
    { text: '  search, attribute filter) — see the Filter sheet for the exact format.' },
    { text: '  Period key dropdown includes "custom" — pairs with explicit Date From/To' },
    { text: '  values on the Filter sheet for an exact saved date range (not a rolling' },
    { text: '  period like "this-year"). Type dates as plain YYYY-MM-DD text.' },
    { text: '  Empty Attribute filter in a profile = no override (inherits whatever' },
    { text: '  filter is live when you export). Type _ to explicitly clear it instead' },
    { text: '  (e.g. force "all accounts" even if a specific one is live).' },
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
