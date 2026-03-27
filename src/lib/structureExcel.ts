// ============================================================
// structureExcel.ts — Structure Tab Excel Export v2
// ============================================================
//
// v2 vs v1:
//   • Single sheet "Structure" (was: "HierarchicalView" pre-S26)
//   • 17 fixed columns A–Q (no dynamic DependsOnWhen_* columns)
//   • Multi-row DependsOn: one row per WhenValue (Streamlit style)
//   • Rows 1–5: color legend (row-grouped, default collapsed)
//   • Row 6: always-visible info/backup row
//   • Row 7: header row
//   • Row 8+: data rows
//   • Freeze pane at G8 (cols A–F + rows 1–7 frozen)
//   • Column-based editability coloring (Pink/Yellow/Blue/Green)
//   • Column groups per spec (some collapsed, some open by default)
//   • Excel data validations on Type, AttrType, IsRequired, Val.Type
//   • Bold: Area rows + leaf Category rows. Italic: Attribute rows.
//   • Area formula in col C: =IFERROR(LEFT(D8,FIND(" > ",D8)-1),D8)
//
// Unified workbook (S26 Korak 3):
//   exportStructureExcel() → 4 sheets: Events(stub), Structure, HelpStructure, Filter
//   addStructureSheetsTo() → internal builder used by excelBackup.ts too
//
// Filenames:
//   Normal:   structure_export_YYYYMMDD_HHmmss.xlsx
//   Backup:   structure_export_YYYYMMDD_HHmmss_backup.xlsx
//   Conflict: structure_export_YYYYMMDD_HHmmss_conflict.xlsx
//
// Public API:
//   exportStructureExcel(nodes, options?)  → ArrayBuffer
//   addStructureSheetsTo(wb, nodes, ...)   → void  (for composing multi-sheet workbooks)
//   structureExportFilename()              → string
//   structureBackupFilename()              → string
//   structureConflictFilename()            → string
// ============================================================

import ExcelJS from 'exceljs';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';
import {
  timestampSuffix,
  formatTimestampSuffix,
  addFilterSheet,
  type FilterSheetInfo,
} from './excelUtils';

// ─────────────────────────────────────────────────────────────
// ARGB color constants
// ─────────────────────────────────────────────────────────────
const CLR = {
  // Column editability fills (used on every data cell)
  PINK:      'FFFCE4D6', // Pink  — read-only / auto-calculated
  YELLOW:    'FFFFF2CC', // Yellow — key identifier (edit carefully)
  BLUE:      'FFDAE3F3', // Blue  — freely editable
  GREEN:     'FFE2EFDA', // Green — dependency columns

  // Header row
  HEADER_BG: 'FF4472C4', // indigo-600
  HEADER_FG: 'FFFFFFFF',

  // Row 6 info backgrounds
  INFO_BG:     'FFF5F5F5', // light gray — normal export
  BACKUP_BG:   'FFFCE4D6', // soft orange — backup
  CONFLICT_BG: 'FFFFFF99', // soft yellow — conflict

  // Conflict: highlight slug cells
  SLUG_CONFLICT: 'FFFFFF00', // bright yellow on conflicted slug cell
} as const;

// ─────────────────────────────────────────────────────────────
// Column specification (A–Q, 17 columns)
// ─────────────────────────────────────────────────────────────
// colColor  : fill applied to every data cell in this column
// grouped   : adds outlineLevel = 1
// collapsed : hides column by default (only meaningful when grouped=true)
// ─────────────────────────────────────────────────────────────
const COLS = [
  // idx 0 = col A
  { key: 'type',        header: 'Type',              width: 9,  colColor: CLR.PINK,   grouped: false, collapsed: false },
  { key: 'isLeaf',      header: 'IsLeaf',            width: 9,  colColor: CLR.PINK,   grouped: true,  collapsed: true  },
  { key: 'area',        header: 'Area',              width: 9,  colColor: CLR.PINK,   grouped: true,  collapsed: true  },
  { key: 'categoryPath',header: 'CategoryPath',      width: 40, colColor: CLR.YELLOW, grouped: false, collapsed: false },
  { key: 'sort',        header: 'Sort',              width: 6,  colColor: CLR.YELLOW, grouped: true,  collapsed: true  },
  { key: 'attrName',    header: 'AttrName',          width: 18, colColor: CLR.BLUE,   grouped: false, collapsed: false },
  { key: 'slug',        header: 'Slug',              width: 18, colColor: CLR.PINK,   grouped: true,  collapsed: true  },
  { key: 'attrType',    header: 'AttrType',          width: 9,  colColor: CLR.BLUE,   grouped: true,  collapsed: true  },
  { key: 'isRequired',  header: 'IsRequired',        width: 9,  colColor: CLR.BLUE,   grouped: true,  collapsed: true  },
  { key: 'valType',     header: 'Val.Type',          width: 9,  colColor: CLR.BLUE,   grouped: true,  collapsed: true  },
  { key: 'defaultVal',  header: 'Default',           width: 9,  colColor: CLR.BLUE,   grouped: true,  collapsed: true  },
  { key: 'valMax',      header: 'Val.Max (no)',       width: 9,  colColor: CLR.BLUE,   grouped: true,  collapsed: true  },
  { key: 'unit',        header: 'Unit',              width: 7,  colColor: CLR.BLUE,   grouped: false, collapsed: false },
  { key: 'textOptions', header: 'TextOptions/Val.Min',width: 45, colColor: CLR.BLUE,   grouped: true,  collapsed: false },
  { key: 'dependsOn',   header: 'DependsOn',         width: 18, colColor: CLR.GREEN,  grouped: true,  collapsed: false },
  { key: 'whenValue',   header: 'WhenValue',         width: 12, colColor: CLR.GREEN,  grouped: true,  collapsed: false },
  { key: 'description', header: 'Description',       width: 60, colColor: CLR.BLUE,   grouped: false, collapsed: false },
] as const;

const N_COLS = COLS.length; // 17

// Column letter helpers (0-based index: A=0, B=1, ...)
function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx);
}

// Excel column index (1-based) for a given key
function colNum(key: string): number {
  return COLS.findIndex(c => c.key === key) + 1;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface SuggestRules {
  type: 'suggest';
  suggest?: string[];
  max?: number | string;
  min?: number | string;
  depends_on?: {
    attribute_slug: string;
    options_map: Record<string, string[]>;
  };
}

// One spreadsheet data row (all values as strings except sort)
interface DataRow {
  type:         string; // Area | Category | Attribute
  isLeaf:       string; // TRUE | ''
  area:         'FORMULA';      // always formula for data rows
  categoryPath: string;
  sort:         number;
  attrName:     string;
  slug:         string;
  attrType:     string;
  isRequired:   string; // TRUE | FALSE | ''
  valType:      string; // suggest | none | ''
  defaultVal:   string;
  valMax:       string;
  unit:         string;
  textOptions:  string;
  dependsOn:    string;
  whenValue:    string;
  description:  string;
  // Row meta (not written to cells)
  _isAreaRow:   boolean;
  _isLeafRow:   boolean;
  _isAttrRow:   boolean;
}

export interface ExportStructureOptions {
  filterAreaId?: string | null;
  filterCategoryId?: string | null;
}

export interface InfoRowOptions {
  type: 'export' | 'backup' | 'conflict';
  /** Human-readable description written to cell C6 */
  description?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function parseRules(raw: unknown): SuggestRules | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const r = obj as Record<string, unknown>;
  if (r['type'] === 'suggest') return r as unknown as SuggestRules;
  return null;
}

function getValType(attr: AttributeDefinition): string {
  const r = parseRules(attr.validation_rules);
  if (!r) return 'none';
  if (r.depends_on || (r.suggest && r.suggest.length > 0)) return 'suggest';
  return 'none';
}

function makeFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

// Thin light-gray border applied to all table cells (header + data)
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

// ─────────────────────────────────────────────────────────────
// Row builders
// ─────────────────────────────────────────────────────────────
function buildAreaRow(node: StructureNode): DataRow {
  return {
    type: 'Area',
    isLeaf: '',
    area: 'FORMULA',
    categoryPath: node.name,
    sort: node.sortOrder,
    attrName: '', slug: '', attrType: '', isRequired: '',
    valType: '', defaultVal: '', valMax: '', unit: '',
    textOptions: '', dependsOn: '', whenValue: '',
    description: node.description ?? '',
    _isAreaRow: true, _isLeafRow: false, _isAttrRow: false,
  };
}

function buildCategoryRow(node: StructureNode): DataRow {
  return {
    type: 'Category',
    isLeaf: node.isLeaf ? 'TRUE' : '',
    area: 'FORMULA',
    categoryPath: node.fullPath,
    sort: node.sortOrder,
    attrName: '', slug: '', attrType: '', isRequired: '',
    valType: '', defaultVal: '', valMax: '', unit: '',
    textOptions: '', dependsOn: '', whenValue: '',
    description: node.description ?? '',
    _isAreaRow: false, _isLeafRow: node.isLeaf, _isAttrRow: false,
  };
}

function buildAttrRows(node: StructureNode, attr: AttributeDefinition): DataRow[] {
  const rules = parseRules(attr.validation_rules);

  const base = {
    type: 'Attribute' as const,
    isLeaf: '' as const,
    area: 'FORMULA' as const,
    categoryPath: node.fullPath,
    sort: attr.sort_order,
    attrName: attr.name,
    slug: attr.slug,
    attrType: attr.data_type,
    isRequired: attr.is_required ? 'TRUE' : 'FALSE',
    valType: getValType(attr),
    defaultVal: attr.default_value ?? '',
    valMax: rules?.max != null ? String(rules.max) : '',
    unit: attr.unit ?? '',
    description: attr.description ?? '',
    _isAreaRow: false as const,
    _isLeafRow: false as const,
    _isAttrRow: true as const,
  };

  // Simple attribute (no depends_on)
  if (!rules?.depends_on) {
    return [{
      ...base,
      textOptions: rules?.suggest?.join('|') ?? '',
      dependsOn: '',
      whenValue: '',
    }];
  }

  // Dependent attribute: one row per WhenValue
  const parentSlug = rules.depends_on.attribute_slug;
  const optMap = rules.depends_on.options_map;
  const rows: DataRow[] = [];

  for (const [whenVal, opts] of Object.entries(optMap)) {
    rows.push({
      ...base,
      textOptions: Array.isArray(opts) ? opts.join('|') : '',
      dependsOn: parentSlug,
      whenValue: whenVal,
    });
  }

  // Add fallback "*" row if not present
  if (!('*' in optMap)) {
    rows.push({
      ...base,
      textOptions: '',
      dependsOn: parentSlug,
      whenValue: '*',
    });
  }

  return rows;
}

function buildAllRows(nodes: StructureNode[]): DataRow[] {
  const rows: DataRow[] = [];
  for (const node of nodes) {
    if (node.nodeType === 'area') {
      rows.push(buildAreaRow(node));
    } else {
      rows.push(buildCategoryRow(node));
      for (const attr of node.attributeDefinitions) {
        rows.push(...buildAttrRows(node, attr));
      }
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// Structure sheet writer
// ─────────────────────────────────────────────────────────────
function writeStructureSheet(
  wb: ExcelJS.Workbook,
  rows: DataRow[],
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): void {
  const ts = timestampSuffix();

  const ws = wb.addWorksheet('Structure');

  // Freeze at G8: first 6 cols + first 7 rows frozen
  ws.views = [{ state: 'frozen', xSplit: 6, ySplit: 7 }];

  // Outline properties (summary buttons on left/top, not right/bottom)
  ws.properties.outlineLevelRow = 1;
  ws.properties.outlineLevelCol = 1;

  // ── Column widths and grouping ──────────────────────────────
  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

  for (let ci = 0; ci < COLS.length; ci++) {
    const spec = COLS[ci];
    if (!spec.grouped) continue;
    const col = ws.getColumn(ci + 1);
    col.outlineLevel = 1;
    if (spec.collapsed) col.hidden = true;
  }

  // Force slug column (G = index 6) visible when there are conflicts
  const hasConflicts = conflictSlugs && conflictSlugs.size > 0;
  if (hasConflicts) {
    const slugCol = ws.getColumn(colNum('slug'));
    slugCol.hidden = false;
  }

  // ── Rows 1–5: Legend (collapsed by default) ─────────────────
  const legendItems: [string, string][] = [
    [CLR.HEADER_BG, '🎨  COLOR CODING (4 Colors)'],
    [CLR.PINK,      'PINK COLUMNS (Auto-calculated / Read-only):  Do not edit for existing rows.'],
    [CLR.YELLOW,    'YELLOW COLUMNS (Key identifiers):  Edit ONLY for NEW rows.  For EXISTING rows DO NOT CHANGE — creates duplicates!'],
    [CLR.BLUE,      'BLUE COLUMNS (Freely editable):'],
    [CLR.GREEN,     'GREEN COLUMNS (Attribute dependency — DependsOn / WhenValue):'],
  ];

  for (let i = 0; i < legendItems.length; i++) {
    const [bgArgb, text] = legendItems[i];
    const rowNum = i + 1;
    const xlRow = ws.getRow(rowNum);
    xlRow.outlineLevel = 1;
    xlRow.hidden = true;
    xlRow.height = 16;

    // Merge A:Q
    ws.mergeCells(rowNum, 1, rowNum, N_COLS);
    const cell = ws.getCell(rowNum, 1);
    cell.value = text;
    cell.fill = makeFill(bgArgb);
    cell.font = {
      bold: true,
      size: 10,
      color: { argb: rowNum === 1 ? CLR.HEADER_FG : 'FF222222' },
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  }

  // ── Row 6: Info / backup / conflict row ─────────────────────
  const row6 = ws.getRow(6);
  row6.height = 15;

  const infoBg  = !infoRow                      ? CLR.INFO_BG
                : infoRow.type === 'backup'      ? CLR.BACKUP_BG
                : infoRow.type === 'conflict'    ? CLR.CONFLICT_BG
                : CLR.INFO_BG;

  const infoLabel = !infoRow                    ? 'Export'
                  : infoRow.type === 'backup'   ? 'Backup before:'
                  : infoRow.type === 'conflict' ? 'Import conflict:'
                  : 'Export';

  const setInfo = (colIdx: number, val: string, bold = false) => {
    const c = ws.getCell(6, colIdx);
    c.value = val;
    c.fill = makeFill(infoBg);
    c.font = { size: 10, bold, color: { argb: 'FF444444' } };
    c.alignment = { vertical: 'middle', horizontal: 'left' };
  };

  // A6 = label (Export / Backup before: / Import conflict:)
  setInfo(1, infoLabel, true);
  // B6, C6 — empty, same background (columns are usually collapsed)
  ws.getCell(6, 2).fill = makeFill(infoBg);
  ws.getCell(6, 3).fill = makeFill(infoBg);
  // D6 = timestamp
  setInfo(4, formatTimestampSuffix(ts));
  // E6..Q6 — fill remaining cells (cosmetic)
  for (let ci = 5; ci <= N_COLS; ci++) {
    ws.getCell(6, ci).fill = makeFill(infoBg);
  }

  // ── Row 7: Header ────────────────────────────────────────────
  const headerRow = ws.getRow(7);
  headerRow.height = 18;

  for (let ci = 0; ci < COLS.length; ci++) {
    const cell = ws.getCell(7, ci + 1);
    cell.value = COLS[ci].header;
    cell.fill = makeFill(CLR.HEADER_BG);
    cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: CLR.HEADER_FG } };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  }

  // Auto-filter covers header row, all columns
  ws.autoFilter = {
    from: { row: 7, column: 1 },
    to:   { row: 7, column: N_COLS },
  };

  // ── Rows 8+: Data ────────────────────────────────────────────
  const slugColNum = colNum('slug');
  const pathColNum = colNum('categoryPath');

  for (let ri = 0; ri < rows.length; ri++) {
    const data = rows[ri];
    const rowNum = ri + 8;
    const xlRow = ws.getRow(rowNum);
    xlRow.height = 15;

    const isArea = data._isAreaRow;
    const isLeaf = data._isLeafRow;
    const isAttr = data._isAttrRow;
    const fontBase: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: isArea ? 12 : 11,
      bold: isArea || isLeaf,
      italic: isAttr,
    };

    for (let ci = 0; ci < COLS.length; ci++) {
      const spec = COLS[ci];
      const cell = ws.getCell(rowNum, ci + 1);

      // ── Cell value ──
      if (spec.key === 'area') {
        // Always formula: extract left part of CategoryPath before " > "
        cell.value = {
          formula: `IFERROR(LEFT(${colLetter(pathColNum - 1)}${rowNum},FIND(" > ",${colLetter(pathColNum - 1)}${rowNum})-1),${colLetter(pathColNum - 1)}${rowNum})`,
        };
      } else if (spec.key === 'sort') {
        cell.value = data.sort;
      } else {
        const val = data[spec.key as keyof DataRow];
        cell.value = typeof val === 'string' ? val : '';
      }

      // ── Cell fill: column-based editability color ──
      let fillArgb = spec.colColor as string;

      // Conflict highlight override for slug column
      if (hasConflicts && ci === slugColNum - 1) {
        const slugVal = data.slug;
        if (slugVal && conflictSlugs!.has(slugVal)) {
          fillArgb = CLR.SLUG_CONFLICT;
        }
      }

      cell.fill = makeFill(fillArgb);
      cell.font = { ...fontBase };
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
    }
  }

  // ── Data validations ─────────────────────────────────────────
  const lastDataRow = Math.max(rows.length + 8, 100);
  const dvRange = (col: string) => `${col}8:${col}${lastDataRow}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dv = (ws as any).dataValidations;

  dv.add(dvRange('A'), {
    type: 'list', allowBlank: true,
    formulae: ['"Area,Category,Attribute"'],
  });

  dv.add(dvRange(colLetter(colNum('attrType') - 1)), {
    type: 'list', allowBlank: true,
    formulae: ['"number,text,datetime,boolean,link,image"'],
  });

  dv.add(dvRange(colLetter(colNum('isRequired') - 1)), {
    type: 'list', allowBlank: true,
    formulae: ['"TRUE,FALSE"'],
  });

  dv.add(dvRange(colLetter(colNum('valType') - 1)), {
    type: 'list', allowBlank: true,
    formulae: ['"suggest,none"'],
  });
}

// ─────────────────────────────────────────────────────────────
// HelpStructure sheet
// ─────────────────────────────────────────────────────────────
function writeHelpStructureSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('HelpStructure', {
    views: [{ showGridLines: false }],
  });

  ws.getColumn('A').width = 70;
  ws.getColumn('B').width = 72;

  const fillSection = makeFill('FFE3F2FD');

  type HelpLine =
    | { kind: 'section'; text: string }
    | { kind: 'row'; label: string; value: string };

  const lines: HelpLine[] = [
    { kind: 'section', text: 'Events Tracker — Structure Export Format v2' },
    { kind: 'row', label: 'Version',  value: '2.0 — 2026' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'File Layout' },
    { kind: 'row', label: 'Rows 1–5', value: 'Color coding legend.  Click [+] on the left to expand.' },
    { kind: 'row', label: 'Row 6',    value: 'Export info, or backup / conflict description.' },
    { kind: 'row', label: 'Row 7',    value: 'Column headers.' },
    { kind: 'row', label: 'Row 8+',   value: 'Data: Area rows, Category rows, Attribute rows.' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'Color Coding' },
    { kind: 'row', label: 'PINK',   value: 'Auto-calculated / Read-only.  Do not edit for existing rows.' },
    { kind: 'row', label: 'YELLOW', value: 'Key identifiers.  Edit ONLY for NEW rows — changing existing rows creates duplicates.' },
    { kind: 'row', label: 'BLUE',   value: 'Freely editable.' },
    { kind: 'row', label: 'GREEN',  value: 'Dependency columns (DependsOn / WhenValue).' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'Grouped / Hidden Columns' },
    { kind: 'row', label: '', value: 'Several columns are grouped and collapsed by default.  Click [+] in the column header area to expand.' },
    { kind: 'row', label: 'Default collapsed', value: 'IsLeaf (B), Area (C), Sort (E), Slug (G), AttrType (H), IsRequired (I), Val.Type (J), Default (K), Val.Max (L)' },
    { kind: 'row', label: 'Default open',      value: 'TextOptions/Val.Min (N), DependsOn (O), WhenValue (P)' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'Column Reference (A–Q)' },
    { kind: 'row', label: 'A  Type',              value: 'Area / Category / Attribute' },
    { kind: 'row', label: 'B  IsLeaf',            value: 'TRUE if leaf category (no children).  Informational — importer recalculates from DB.' },
    { kind: 'row', label: 'C  Area',              value: 'Auto-formula: extracts area name from CategoryPath.  Read-only.' },
    { kind: 'row', label: 'D  CategoryPath',      value: 'KEY column.  Full path e.g. "Fitness > Activity > Gym".  Do NOT change for existing rows.' },
    { kind: 'row', label: 'E  Sort',              value: 'Display order within parent.' },
    { kind: 'row', label: 'F  AttrName',          value: 'Attribute display name.' },
    { kind: 'row', label: 'G  Slug',              value: 'Internal stable identifier.  Used for import matching and DependsOn references.  Never changes after creation.' },
    { kind: 'row', label: 'H  AttrType',          value: 'Data type: number | text | datetime | boolean | link | image' },
    { kind: 'row', label: 'I  IsRequired',        value: 'TRUE / FALSE' },
    { kind: 'row', label: 'J  Val.Type',          value: 'suggest = dropdown with options.  none = free text.' },
    { kind: 'row', label: 'K  Default',           value: 'Default value shown when creating a new event.' },
    { kind: 'row', label: 'L  Val.Max (no)',      value: 'Maximum allowed value (number attributes only).' },
    { kind: 'row', label: 'M  Unit',              value: 'Display unit e.g. kg, min, bpm.' },
    { kind: 'row', label: 'N  TextOptions/Val.Min', value: 'For suggest: pipe-separated options e.g. "Low|Medium|High".  For number: minimum value.' },
    { kind: 'row', label: 'O  DependsOn',         value: 'Slug of the parent attribute that controls this dropdown.  Must be in the same category.' },
    { kind: 'row', label: 'P  WhenValue',         value: 'Value of parent attribute for this row\'s options.  Use "*" as fallback for unlisted parent values.' },
    { kind: 'row', label: 'Q  Description',       value: 'Optional documentation notes.' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'Understanding DependsOn Rows' },
    { kind: 'row', label: '', value: 'When an attribute has conditional options (depends on another attribute\'s value),' },
    { kind: 'row', label: '', value: 'it appears as MULTIPLE rows — one per WhenValue.' },
    { kind: 'row', label: '', value: '' },
    { kind: 'row', label: 'Example:', value: '' },
    { kind: 'row', label: 'AttrName      | DependsOn      | WhenValue | TextOptions', value: '' },
    { kind: 'row', label: 'exercise_name | strength_type  | Upp       | pull.m|biceps|triceps', value: '' },
    { kind: 'row', label: 'exercise_name | strength_type  | Low       | squat-bw|iskoraci', value: '' },
    { kind: 'row', label: 'exercise_name | strength_type  | *         | (empty → free text for other parent values)', value: '' },
    { kind: 'row', label: '', value: '' },
    { kind: 'row', label: '', value: 'All rows for the same attribute share the same SortOrder, AttrType, Unit, IsRequired.' },
    { kind: 'row', label: '', value: '' },

    { kind: 'section', text: 'Import Rules (Non-Destructive)' },
    { kind: 'row', label: '', value: 'Import ONLY ADDS new structure.  It never modifies or deletes existing rows.' },
    { kind: 'row', label: '', value: '' },
    { kind: 'row', label: 'Empty Slug (new row)',   value: '→ Creates new attribute.  DB assigns slug automatically from AttrName.' },
    { kind: 'row', label: 'Slug found, same path',  value: '→ Updates name, unit, description, suggest options (safe operations).' },
    { kind: 'row', label: 'Slug found, diff path',  value: '→ SKIPPED.  Cell highlighted yellow in conflict report (col G).' },
    { kind: 'row', label: 'New CategoryPath',        value: '→ Creates Area and/or Category if they don\'t exist.' },
    { kind: 'row', label: '', value: '' },
    { kind: 'row', label: '', value: 'To edit or delete existing structure, use Edit Mode in the Structure tab UI.' },
  ];

  let rowIdx = 1;
  for (const line of lines) {
    if (line.kind === 'section') {
      ws.mergeCells(rowIdx, 1, rowIdx, 2);
      const c = ws.getCell(rowIdx, 1);
      c.value = line.text;
      c.fill = fillSection;
      c.font = { bold: true, size: 11, color: { argb: 'FF1565C0' } };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      c.border = THIN_BORDER;
      ws.getRow(rowIdx).height = 20;
    } else {
      const cA = ws.getCell(rowIdx, 1);
      const cB = ws.getCell(rowIdx, 2);
      cA.value = line.label;
      cB.value = line.value;
      if (line.label) cA.font = { bold: true, size: 10 };
      else            cA.font = { size: 10 };
      cB.font = { size: 10 };
      cA.alignment = { vertical: 'top', wrapText: false };
      cB.alignment = { vertical: 'top', wrapText: true };
      cA.border = THIN_BORDER;
      cB.border = THIN_BORDER;
    }
    rowIdx++;
  }

  // Color PINK/YELLOW/BLUE/GREEN cells in column A for the Color Coding section rows
  // Rows 11–14 correspond to the Color Coding entries (PINK, YELLOW, BLUE, GREEN)
  const colorRows: Array<[number, string]> = [
    [11, CLR.PINK],
    [12, CLR.YELLOW],
    [13, CLR.BLUE],
    [14, CLR.GREEN],
  ];
  for (const [r, argb] of colorRows) {
    ws.getCell(r, 1).fill = makeFill(argb);
  }
}

// ─────────────────────────────────────────────────────────────
// Events stub sheet (for Structure Export — no events included)
// ─────────────────────────────────────────────────────────────
function _addEventsStubSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Events');
  ws.getColumn('A').width = 90;
  const cell = ws.getCell(1, 1);
  cell.value = 'Export initiated from Structure tab — no events included. To export events, use Activities tab.';
  cell.font = { italic: true, color: { argb: 'FF888888' } };
}

// ─────────────────────────────────────────────────────────────
// Filter sheet info builder (for Structure Export)
// ─────────────────────────────────────────────────────────────
function _buildStructureFilterInfo(
  nodes: StructureNode[],
  options: ExportStructureOptions,
  ts: string,
): FilterSheetInfo {
  const { filterAreaId, filterCategoryId } = options;

  let area: string | null = null;
  let category: string | null = null;

  if (filterCategoryId) {
    const pivot = nodes.find(n => n.id === filterCategoryId);
    if (pivot) {
      category = pivot.fullPath;
      const areaNode = nodes.find(n => n.nodeType === 'area' && n.id === pivot.areaId);
      area = areaNode?.name ?? null;
    }
  } else if (filterAreaId) {
    const areaNode = nodes.find(n => n.id === filterAreaId);
    area = areaNode?.name ?? null;
  }

  return {
    exportType: 'Structure',
    exportedAt: ts,
    area,
    category,
  };
}

// ─────────────────────────────────────────────────────────────
// Public API — internal builder
// ─────────────────────────────────────────────────────────────

/**
 * Add "Structure" + "HelpStructure" sheets to an existing workbook.
 * Used by exportStructureExcel() and by excelBackup.ts (Korak 4).
 */
export async function addStructureSheetsTo(
  wb: ExcelJS.Workbook,
  nodes: StructureNode[],
  options: ExportStructureOptions = {},
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): Promise<void> {
  const { filterAreaId, filterCategoryId } = options;

  // Filter scope (same logic as old exportStructureExcel)
  let scoped = nodes;
  if (filterCategoryId) {
    const pivot = nodes.find(n => n.id === filterCategoryId);
    if (pivot) {
      const prefix = pivot.fullPath;
      scoped = nodes.filter(
        n => n.areaId === pivot.areaId &&
          (n.nodeType === 'area' ||
           n.fullPath === prefix ||
           n.fullPath.startsWith(prefix + ' > ')),
      );
    }
  } else if (filterAreaId) {
    scoped = nodes.filter(n => n.areaId === filterAreaId);
  }

  const rows = buildAllRows(scoped);
  writeStructureSheet(wb, rows, infoRow, conflictSlugs);
  writeHelpStructureSheet(wb);
}

// ─────────────────────────────────────────────────────────────
// Public API — thin wrapper (produces unified workbook)
// ─────────────────────────────────────────────────────────────

/**
 * Export structure to Excel unified format.
 * Produces 4 sheets: Events (stub), Structure, HelpStructure, Filter.
 *
 * @param nodes         All StructureNodes from useStructureData
 * @param options       Optional filter scope
 * @param infoRow       Info for row 6 (export/backup/conflict)
 * @param conflictSlugs Set of attribute slugs that caused import conflicts.
 *                      Forces Slug column visible and highlights those cells.
 */
export async function exportStructureExcel(
  nodes: StructureNode[],
  options: ExportStructureOptions = {},
  infoRow?: InfoRowOptions,
  conflictSlugs?: Set<string>,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Events Tracker';
  wb.created  = new Date();
  wb.modified = new Date();

  const ts = timestampSuffix();

  // Sheet order: Events(stub) → Structure → HelpStructure → Filter
  _addEventsStubSheet(wb);
  await addStructureSheetsTo(wb, nodes, options, infoRow, conflictSlugs);
  addFilterSheet(wb, _buildStructureFilterInfo(nodes, options, ts));

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Filename for a normal structure export. */
export function structureExportFilename(): string {
  return `structure_export_${timestampSuffix()}.xlsx`;
}

/** Filename for a pre-operation backup export. */
export function structureBackupFilename(): string {
  return `structure_export_${timestampSuffix()}_backup.xlsx`;
}

/** Filename for an import conflict report. */
export function structureConflictFilename(): string {
  return `structure_export_${timestampSuffix()}_conflict.xlsx`;
}
