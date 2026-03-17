// ============================================================
// structureExcel.ts — Structure Tab Excel Export
// ============================================================
// Exports the category hierarchy (Areas → Categories →
// Attribute Definitions) to an .xlsx file compatible with
// the U8 Streamlit reference format.
//
// Output file: structure_export_YYYYMMDD_HHMMSS.xlsx
// One data sheet per Area in the export scope.
// One Help sheet describing the format.
//
// Called from AppHome "Export" button with:
//   exportStructureExcel(nodes, filterAreaId)
//
// Columns (per data sheet, one row = one leaf-chain × attr):
//   A: Type          — "Category" or "Attribute"
//   B: Sort          — category sort_order or attr sort_order
//   C: Area          — area name
//   D: Chain         — full path e.g. "Fitness > Activity > Gym > Strength"
//   E: Level         — numeric level (0=Area, 1=L1, etc.)
//   F: IsLeaf        — "Yes" / "No"
//   G: Description   — category or attr description
//   H: AttrName      — attribute name (empty for Category rows)
//   I: AttrSlug      — attribute slug (empty for Category rows)
//   J: AttrType      — attribute data_type (empty for Category rows)
//   K: Unit          — attribute unit (empty for Category rows)
//   L: IsRequired    — "Yes" / "No" (empty for Category rows)
//   M: ValidationType — "suggest" / "depends_on" / "none"
//   N: TextOptions   — pipe-separated suggest values e.g. "pull.m|biceps|triceps"
//   O: DependsOnAttr — slug of the parent attribute (depends_on only)
//   P–Z+: DependsOnWhen_<value> — per-value option columns (depends_on only)
//         e.g. "DependsOnWhen_Upp" → "pull.m|biceps|triceps"
//
// NOTE: DependsOn columns are dynamic — one per parent-attr value.
//       They are padded to align across all rows in the sheet.
// ============================================================

import ExcelJS from 'exceljs';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

// Fill colours (ARGB)
const FILL_HEADER: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' },
};
const FILL_AREA: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' }, // indigo-50
};
const FILL_CATEGORY: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' }, // near-white
};
const FILL_LEAF: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' }, // emerald-50
};
const FILL_ATTR: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' }, // amber-50
};
const FILL_HELP_SECTION: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' }, // blue-50
};

const FONT_HEADER: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' }, bold: true, size: 10,
};
const FONT_BOLD: Partial<ExcelJS.Font> = { bold: true };

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin' },
  bottom: { style: 'thin' },
  left:   { style: 'thin' },
  right:  { style: 'thin' },
};

// Fixed column definitions (A–P are fixed; depends_on columns appended after P)
const FIXED_COLUMNS = [
  { key: 'type',          header: 'Type',         width: 12 },
  { key: 'sort',          header: 'Sort',         width: 6  },
  { key: 'area',          header: 'Area',         width: 14 },
  { key: 'chain',         header: 'Chain',        width: 40 },
  { key: 'level',         header: 'Level',        width: 7  },
  { key: 'isLeaf',        header: 'IsLeaf',       width: 7  },
  { key: 'description',   header: 'Description',  width: 28 },
  { key: 'attrName',      header: 'AttrName',     width: 20 },
  { key: 'attrSlug',      header: 'AttrSlug',     width: 20 },
  { key: 'attrType',      header: 'AttrType',     width: 12 },
  { key: 'unit',          header: 'Unit',         width: 8  },
  { key: 'isRequired',    header: 'IsRequired',   width: 10 },
  { key: 'validationType',header: 'ValidationType',width: 14 },
  { key: 'textOptions',   header: 'TextOptions',  width: 36 },
  { key: 'dependsOnAttr', header: 'DependsOnAttr',width: 18 },
] as const;

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

// Actual shape of validation_rules jsonb in the DB.
// (The TypeScript database.ts type is a legacy stub — we parse raw.)
interface SuggestRules {
  type: 'suggest';
  suggest?: string[];
  depends_on?: {
    attribute_slug: string;
    options_map: Record<string, string[]>;
  };
}

// A single row written to the Excel sheet
interface SheetRow {
  type: string;
  sort: number;
  area: string;
  chain: string;
  level: number;
  isLeaf: string;
  description: string;
  attrName: string;
  attrSlug: string;
  attrType: string;
  unit: string;
  isRequired: string;
  validationType: string;
  textOptions: string;
  dependsOnAttr: string;
  // dynamic depends_on columns keyed "DependsOnWhen_<value>"
  [key: string]: string | number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Parse validation_rules safely — handles object or JSON string */
function parseValidationRules(raw: unknown): SuggestRules | null {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const r = obj as Record<string, unknown>;
  if (r['type'] === 'suggest') return r as unknown as SuggestRules;
  return null;
}

/** Determine validation type label for an attribute */
function getValidationType(attrDef: AttributeDefinition): string {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules) return 'none';
  if (rules.depends_on) return 'depends_on';
  if (rules.suggest && rules.suggest.length > 0) return 'suggest';
  return 'none';
}

/** Get pipe-separated suggest options (simple suggest only) */
function getTextOptions(attrDef: AttributeDefinition): string {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules || rules.depends_on) return '';
  if (rules.suggest && rules.suggest.length > 0) {
    return rules.suggest.join('|');
  }
  return '';
}

/** Get depends_on parent attribute slug */
function getDependsOnAttr(attrDef: AttributeDefinition): string {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules?.depends_on) return '';
  return rules.depends_on.attribute_slug;
}

/**
 * Get depends_on options map.
 * Returns Record<parentValue, pipe-separated options> or {}
 */
function getDependsOnMap(attrDef: AttributeDefinition): Record<string, string> {
  const rules = parseValidationRules(attrDef.validation_rules);
  if (!rules?.depends_on?.options_map) return {};
  const result: Record<string, string> = {};
  for (const [key, vals] of Object.entries(rules.depends_on.options_map)) {
    result[key] = Array.isArray(vals) ? vals.join('|') : String(vals);
  }
  return result;
}

/** Generate timestamp string for filename */
function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** Group StructureNode[] by area, preserving DFS order within each area */
function groupNodesByArea(
  nodes: StructureNode[],
): Map<string, StructureNode[]> {
  const map = new Map<string, StructureNode[]>();
  for (const node of nodes) {
    const areaId = node.areaId;
    const existing = map.get(areaId) ?? [];
    existing.push(node);
    map.set(areaId, existing);
  }
  return map;
}

// ────────────────────────────────────────────────────────────
// Row builders
// ────────────────────────────────────────────────────────────

/**
 * Build rows for one StructureNode.
 * Returns 1 "Category" row + N "Attribute" rows (one per attr def).
 */
function buildRowsForNode(node: StructureNode): SheetRow[] {
  const rows: SheetRow[] = [];

  // ---- Category row ----
  rows.push({
    type:           'Category',
    sort:           node.sortOrder,
    area:           node.area.name,
    chain:          node.fullPath,
    level:          node.level,
    isLeaf:         node.isLeaf ? 'Yes' : 'No',
    description:    node.description ?? '',
    attrName:       '',
    attrSlug:       '',
    attrType:       '',
    unit:           '',
    isRequired:     '',
    validationType: '',
    textOptions:    '',
    dependsOnAttr:  '',
  });

  // ---- Attribute rows (one per attr def at this level) ----
  for (const attr of node.attributeDefinitions) {
    const validationType = getValidationType(attr);
    const dependsOnMap   = getDependsOnMap(attr);

    const attrRow: SheetRow = {
      type:           'Attribute',
      sort:           attr.sort_order,
      area:           node.area.name,
      chain:          node.fullPath,
      level:          node.level,
      isLeaf:         node.isLeaf ? 'Yes' : 'No',
      description:    attr.description ?? '',
      attrName:       attr.name,
      attrSlug:       attr.slug,
      attrType:       attr.data_type,
      unit:           attr.unit ?? '',
      isRequired:     attr.is_required ? 'Yes' : 'No',
      validationType,
      textOptions:    getTextOptions(attr),
      dependsOnAttr:  getDependsOnAttr(attr),
    };

    // Add dynamic DependsOnWhen_<value> columns
    for (const [value, options] of Object.entries(dependsOnMap)) {
      attrRow[`DependsOnWhen_${value}`] = options;
    }

    rows.push(attrRow);
  }

  return rows;
}

// ────────────────────────────────────────────────────────────
// Sheet writer
// ────────────────────────────────────────────────────────────

/**
 * Write one data sheet (one Area) to the workbook.
 */
function writeAreaSheet(
  wb: ExcelJS.Workbook,
  areaName: string,
  nodes: StructureNode[],
): void {
  // ---- Build all rows first (we need to discover depends_on columns) ----
  const allRows: SheetRow[] = [];
  for (const node of nodes) {
    if (node.nodeType === 'area') continue; // Area nodes → Category row only
    allRows.push(...buildRowsForNode(node));
  }

  // If area has no category nodes at all, still write area-level info
  if (nodes.every(n => n.nodeType === 'area')) {
    const areaNode = nodes.find(n => n.nodeType === 'area');
    if (areaNode) {
      allRows.push({
        type:           'Category',
        sort:           areaNode.sortOrder,
        area:           areaNode.area.name,
        chain:          areaNode.fullPath,
        level:          0,
        isLeaf:         'No',
        description:    areaNode.description ?? '',
        attrName:       '',
        attrSlug:       '',
        attrType:       '',
        unit:           '',
        isRequired:     '',
        validationType: '',
        textOptions:    '',
        dependsOnAttr:  '',
      });
    }
  }

  // ---- Discover all dynamic depends_on column keys in this sheet ----
  const dynamicColKeys = new Set<string>();
  for (const row of allRows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith('DependsOnWhen_')) {
        dynamicColKeys.add(key);
      }
    }
  }
  const dynamicCols = [...dynamicColKeys].sort();

  // ---- Create sheet (truncate name to 31 chars — Excel limit) ----
  const sheetName = areaName.slice(0, 31);
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // ---- Define columns ----
  const colDefs: Partial<ExcelJS.Column>[] = FIXED_COLUMNS.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  for (const dynKey of dynamicCols) {
    colDefs.push({ header: dynKey, key: dynKey, width: 30 });
  }
  ws.columns = colDefs;

  // ---- Style header row ----
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill   = FILL_HEADER;
    cell.font   = FONT_HEADER;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
  });
  headerRow.height = 18;

  // ---- Add data rows ----
  for (const row of allRows) {
    const excelRow = ws.addRow(row);
    const isAttrRow = row.type === 'Attribute';
    const isAreaRow = row.level === 0;
    const isLeafRow = row.isLeaf === 'Yes';

    // Choose fill based on row type
    let fill: ExcelJS.Fill;
    if (isAttrRow)      fill = FILL_ATTR;
    else if (isAreaRow) fill = FILL_AREA;
    else if (isLeafRow) fill = FILL_LEAF;
    else                fill = FILL_CATEGORY;

    excelRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill = fill;
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', wrapText: false };
    });

    // Bold the chain column for category rows
    if (!isAttrRow) {
      const chainCell = excelRow.getCell('chain');
      chainCell.font = FONT_BOLD;
    }

    excelRow.height = 16;
  }

  // ---- Auto-filter on header ----
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: colDefs.length },
  };
}

// ────────────────────────────────────────────────────────────
// Help sheet
// ────────────────────────────────────────────────────────────

function writeHelpSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Help', {
    views: [{ showGridLines: false }],
  });

  ws.getColumn('A').width = 22;
  ws.getColumn('B').width = 70;

  type HelpLine = [string, string] | ['---SECTION---', string];

  const content: HelpLine[] = [
    ['---SECTION---', 'Events Tracker — Structure Export Format'],
    ['Version', '1.0 — 2026'],
    ['', ''],
    ['---SECTION---', 'Purpose'],
    ['', 'This file is a snapshot of your category hierarchy and attribute schema.'],
    ['', 'It contains one sheet per Area, showing every category level and all'],
    ['', 'attribute definitions at each level.'],
    ['', ''],
    ['', 'Use this file to:'],
    ['', '  • Back up your structure before making edits'],
    ['', '  • Review your schema at a glance'],
    ['', '  • Import new areas/categories/attributes (add-only — see Import Rules)'],
    ['', ''],
    ['---SECTION---', 'How to Read the File'],
    ['', 'Each sheet represents one Area (e.g. "Fitness").'],
    ['', 'Rows alternate between Category rows and Attribute rows.'],
    ['', '  • Category row (Type = "Category"): describes one level of the hierarchy.'],
    ['', '    The Chain column shows the full path: "Fitness > Activity > Gym > Cardio"'],
    ['', '  • Attribute row (Type = "Attribute"): describes one attribute definition'],
    ['', '    attached to the category at the level shown in Chain.'],
    ['', ''],
    ['---SECTION---', 'Column Descriptions'],
    ['Type',           '"Category" or "Attribute"'],
    ['Sort',           'Display order of this node within its parent level'],
    ['Area',           'Area name (e.g. "Fitness")'],
    ['Chain',          'Full category path from Area to this level'],
    ['Level',          'Hierarchy depth. 0 = Area, 1 = L1, 2 = L2, etc.'],
    ['IsLeaf',         '"Yes" if this category has no children (data entry level)'],
    ['Description',    'Optional description of the category or attribute'],
    ['AttrName',       'Attribute display name (Attribute rows only)'],
    ['AttrSlug',       'Internal identifier — never changes after creation'],
    ['AttrType',       'Data type: number | text | datetime | boolean | link | image'],
    ['Unit',           'Optional unit label shown in UI (e.g. "kg", "min")'],
    ['IsRequired',     '"Yes" if attribute must be filled in when recording an activity'],
    ['ValidationType', '"none" = free text. "suggest" = dropdown. "depends_on" = conditional dropdown.'],
    ['TextOptions',    'For ValidationType="suggest": pipe-separated options. e.g. "Low|Medium|High"'],
    ['DependsOnAttr',  'For ValidationType="depends_on": slug of the parent attribute'],
    ['DependsOnWhen_*','For each value of the parent attribute, the available child options (pipe-separated).'],
    ['', 'Example: DependsOnWhen_Upp = "pull.m|biceps|triceps"'],
    ['', '         DependsOnWhen_Low = "squat-bw|squat-bulg|iskoraci"'],
    ['', ''],
    ['---SECTION---', 'Validation Rules — Format Reference'],
    ['', 'Simple suggest list (stored in DB as JSON):'],
    ['', '  { "type": "suggest", "suggest": ["Option A", "Option B", "Option C"] }'],
    ['', ''],
    ['', 'Dependent dropdown (stored in DB as JSON):'],
    ['', '  { "type": "suggest", "depends_on": {'],
    ['', '      "attribute_slug": "strength_type",'],
    ['', '      "options_map": {'],
    ['', '        "Upp": ["pull.m", "biceps", "triceps"],'],
    ['', '        "Low": ["squat-bw", "squat-bulg"]'],
    ['', '      }'],
    ['', '  }}'],
    ['', ''],
    ['---SECTION---', 'Import Rules'],
    ['', 'Importing this file is NON-DESTRUCTIVE — it only ADDS new structure.'],
    ['', 'It will never modify or delete existing areas, categories, or attributes.'],
    ['', ''],
    ['', 'What import does:'],
    ['', '  • Adds Areas that do not already exist (matched by name)'],
    ['', '  • Adds Categories that do not already exist under their parent (matched by slug)'],
    ['', '  • Adds Attribute Definitions that do not already exist (matched by slug)'],
    ['', ''],
    ['', 'What import does NOT do:'],
    ['', '  • Rename or change existing categories or attributes'],
    ['', '  • Delete anything'],
    ['', '  • Move categories to different parents'],
    ['', ''],
    ['', 'To edit or delete existing structure, use the Edit Mode in the Structure tab.'],
  ];

  let row = 1;
  for (const [label, value] of content) {
    if (label === '---SECTION---') {
      ws.mergeCells(`A${row}:B${row}`);
      const cell = ws.getCell(`A${row}`);
      cell.value  = value;
      cell.fill   = FILL_HELP_SECTION;
      cell.font   = { bold: true, size: 11, color: { argb: 'FF1565C0' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(row).height = 20;
    } else {
      const cellA = ws.getCell(`A${row}`);
      const cellB = ws.getCell(`B${row}`);
      cellA.value = label;
      cellB.value = value;
      if (label) {
        cellA.font = { bold: true };
      }
      cellA.alignment = { vertical: 'top', wrapText: false };
      cellB.alignment = { vertical: 'top', wrapText: true };
      ws.getRow(row).height = label.startsWith('DependsOn') ? 14 : 14;
    }
    row++;
  }

  ws.getColumn('B').width = 70;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export interface ExportStructureOptions {
  /** If set, export only this Area and its descendants. */
  filterAreaId?: string | null;
  /** If set, export only this Category subtree. */
  filterCategoryId?: string | null;
}

/**
 * Build an Excel workbook from the given StructureNode list
 * and return it as an ArrayBuffer, ready for file-saver.
 *
 * Usage:
 *   const buffer = await exportStructureExcel(nodes, { filterAreaId });
 *   const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 *   saveAs(blob, `structure_export_${nowTimestamp()}.xlsx`);
 */
export async function exportStructureExcel(
  nodes: StructureNode[],
  options: ExportStructureOptions = {},
): Promise<ArrayBuffer> {
  const { filterAreaId, filterCategoryId } = options;

  // ---- Filter nodes to export scope ----
  let scopedNodes = nodes;
  if (filterCategoryId) {
    const pivot = nodes.find(n => n.id === filterCategoryId);
    if (pivot) {
      const prefix = pivot.fullPath;
      scopedNodes = nodes.filter(
        n => n.areaId === pivot.areaId &&
          (n.nodeType === 'area' ||
           n.fullPath === prefix ||
           n.fullPath.startsWith(prefix + ' > ')),
      );
    }
  } else if (filterAreaId) {
    scopedNodes = nodes.filter(n => n.areaId === filterAreaId);
  }

  // ---- Group by area ----
  const byArea = groupNodesByArea(scopedNodes);

  // ---- Build workbook ----
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Events Tracker';
  wb.created  = new Date();
  wb.modified = new Date();

  // Write one sheet per area (preserve area order from DFS)
  const areaOrder: string[] = [];
  for (const node of scopedNodes) {
    if (node.nodeType === 'area' && !areaOrder.includes(node.areaId)) {
      areaOrder.push(node.areaId);
    }
  }

  for (const areaId of areaOrder) {
    const areaNodes = byArea.get(areaId) ?? [];
    const areaName  = areaNodes.find(n => n.nodeType === 'area')?.name ?? areaId;
    writeAreaSheet(wb, areaName, areaNodes);
  }

  // Write Help sheet last
  writeHelpSheet(wb);

  // ---- Serialise to buffer ----
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Generate the output filename for a structure export.
 * Always uses current local time.
 */
export function structureExportFilename(): string {
  return `structure_export_${nowTimestamp()}.xlsx`;
}
