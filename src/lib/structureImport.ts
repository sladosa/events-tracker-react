// ============================================================
// structureImport.ts — Structure Tab Excel Import (S20 Faza C)
// ============================================================
//
// Non-destructive: only ADDS new structure. Never deletes,
// never changes data_type, never moves categories.
//
// Supported formats:
//   React v2 (header at row 7, data from row 8, col D = CategoryPath)
//   Streamlit v5 (header at row 1 or 2, col E = CategoryPath)
//
// Slug lookup decision tree (S21 fix — per-category scope):
//   Empty slug                      → CREATE (trigger generates slug from name)
//   Slug present, not in this cat   → CREATE (slug scoped to category_id, not global)
//   Slug present, in this cat, same values → SKIP (dirty check — no DB write)
//   Slug present, in this cat, different   → UPDATE safe ops (name, unit, desc, validation_rules)
//
// NOTE: Slug uniqueness is per-category (category_id + slug), NOT global.
// Same slug in different categories = two independent attribute_definitions — both valid.
//
// Public API:
//   importStructureExcel(file, existingNodes, userId) → ImportResult
// ============================================================

import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { isValidDateRule } from '@/lib/attributeRules';
import type { AttributeRuleConfig } from '@/types/database';

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export interface ConflictRow {
  rowNum: number;       // Excel row number (1-based)
  attrName: string;
  slug: string;
  foundInPath: string;  // path in DB
  importedPath: string; // path from Excel
}

export interface ImportResult {
  created: {
    areas: number;
    categories: number;
    attributes: number;
  };
  updated: {
    attributes: number;
  };
  skipped: number;
  conflicts: ConflictRow[];
  /** Automations sheet (set_attribute rules) — Faza 2b */
  automations: {
    areasUpdated: number;
    rulesImported: number;
    rulesSkipped: number; // invalid rows (unknown area/slug, bad DateMap syntax)
  };
}

// ─────────────────────────────────────────────────────────────
// Internal parsed row (after reading Excel)
// ─────────────────────────────────────────────────────────────

interface ParsedRow {
  rowNum:       number;
  type:         string; // 'Area' | 'Category' | 'Attribute'
  categoryPath: string; // e.g. "Fitness > Activity > Gym > Cardio"
  sort:         number;
  attrName:     string;
  slug:         string;
  attrType:     string;
  isRequired:   boolean;
  valType:      string; // 'suggest' | 'none'
  defaultVal:   string;
  valMax:       string;
  unit:         string;
  textOptions:  string; // pipe-separated
  dependsOn:    string; // parent attr slug
  whenValue:    string; // '*' or specific value
  description:  string;
  commentTpl:   string;
}

// Grouped attribute: combines multiple DependsOn rows
interface AttrGroup {
  categoryPath: string;
  attrName:     string;
  slug:         string;
  attrType:     string;
  isRequired:   boolean;
  valType:      string;
  defaultVal:   string;
  valMax:       string;
  unit:         string;
  description:  string;
  sort:         number;
  // Simple suggest options (valType='suggest', no dependsOn)
  simpleOptions: string[];
  // DependsOn: { parentSlug, optionsMap, defaultMap? }
  dependsOn?: {
    parentSlug: string;
    optionsMap: Record<string, string[]>;
    defaultMap?: Record<string, string>;
  };
  // For conflict tracking
  firstRowNum: number;
}

// ─────────────────────────────────────────────────────────────
// Normalize JSON for comparison — sorts keys recursively.
// PostgreSQL JSONB stores keys alphabetically; JS objects preserve
// insertion order. Without normalization, key-order differences
// cause false dirty-check positives on validation_rules.
// ─────────────────────────────────────────────────────────────

function normalizeJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object' || Array.isArray(v)) return JSON.stringify(v);
  const sorted = Object.keys(v as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = (v as Record<string, unknown>)[k];
      return acc;
    }, {});
  // Recurse into values
  return '{' + Object.entries(sorted).map(([k, val]) =>
    `${JSON.stringify(k)}:${normalizeJson(val)}`
  ).join(',') + '}';
}



function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────────────────────
// Cell value → string helper
// ─────────────────────────────────────────────────────────────

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  // Rich text
  if (typeof v === 'object' && 'richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText
      .map((r) => r.text)
      .join('')
      .trim();
  }
  // Formula result
  if (typeof v === 'object' && 'result' in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    if (typeof res === 'string') return res.trim();
    if (typeof res === 'number') return String(res);
  }
  return String(v).trim();
}

// ─────────────────────────────────────────────────────────────
// Format detection & header row finder
// ─────────────────────────────────────────────────────────────

interface HeaderInfo {
  headerRowNum: number; // 1-based
  colType:     number;  // 1-based col index
  colCategoryPath: number;
  colSort:     number;
  colAttrName: number;
  colSlug:     number;
  colAttrType: number;
  colIsRequired: number;
  colValType:  number;
  colDefault:  number;
  colValMax:   number;
  colUnit:     number;
  colTextOptions: number;
  colDependsOn:   number;
  colWhenValue:   number;
  colDescription: number;
  colCommentTpl:  number;
}

function findHeader(ws: ExcelJS.Worksheet): HeaderInfo | null {
  // Search first 12 rows for a row that looks like the header
  // (contains 'Type' and 'CategoryPath' or 'Chain')
  for (let r = 1; r <= 12; r++) {
    const row = ws.getRow(r);
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      values[colNum - 1] = cellStr(cell).toLowerCase();
    });

    // Find 'type' column
    const typeIdx = values.findIndex(v => v === 'type');
    if (typeIdx < 0) continue;

    // Find CategoryPath (v2) or Chain (v1) or CategoryPath (Streamlit)
    const pathIdx = values.findIndex(
      v => v === 'categorypath' || v === 'chain',
    );
    if (pathIdx < 0) continue;

    // We found the header row — now map column names to indices (1-based)
    const findCol = (...names: string[]): number => {
      const idx = values.findIndex(v => names.includes(v));
      return idx >= 0 ? idx + 1 : 0;
    };

    return {
      headerRowNum:    r,
      colType:         typeIdx + 1,
      colCategoryPath: pathIdx + 1,
      colSort:         findCol('sort', 'sortorder'),
      colAttrName:     findCol('attrname', 'attributename'),
      colSlug:         findCol('slug', 'attrslug'),
      colAttrType:     findCol('attrtype', 'datatype'),
      colIsRequired:   findCol('isrequired'),
      colValType:      findCol('val.type', 'validationtype'),
      colDefault:      findCol('default'),
      colValMax:       findCol('val.max (no)', 'validationmax'),
      colUnit:         findCol('unit'),
      colTextOptions:  findCol('textoptions/val.min', 'textoptions', 'textoptions/val.min'),
      colDependsOn:    findCol('dependson'),
      colWhenValue:    findCol('whenvalue'),
      colDescription:  findCol('description'),
      colCommentTpl:   findCol('commenttemplate'),
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Row parser
// ─────────────────────────────────────────────────────────────

function parseRows(ws: ExcelJS.Worksheet, h: HeaderInfo): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lastRow = ws.lastRow?.number ?? 1000;

  for (let r = h.headerRowNum + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const get = (colNum: number): string =>
      colNum > 0 ? cellStr(row.getCell(colNum)) : '';

    const type = get(h.colType);
    if (!type) continue; // skip blank rows
    if (!['area', 'category', 'attribute'].includes(type.toLowerCase())) continue;

    const categoryPath = get(h.colCategoryPath);
    if (!categoryPath) continue;

    rows.push({
      rowNum:       r,
      type:         type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      categoryPath,
      sort:         Number(get(h.colSort)) || 1,
      attrName:     get(h.colAttrName),
      slug:         get(h.colSlug),
      attrType:     get(h.colAttrType) || 'text',
      isRequired:   get(h.colIsRequired).toUpperCase() === 'TRUE',
      valType:      get(h.colValType) || 'none',
      defaultVal:   get(h.colDefault),
      valMax:       get(h.colValMax),
      unit:         get(h.colUnit),
      textOptions:  get(h.colTextOptions),
      dependsOn:    get(h.colDependsOn),
      whenValue:    get(h.colWhenValue),
      description:  get(h.colDescription),
      commentTpl:   get(h.colCommentTpl),
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// Group multi-row DependsOn attributes into single AttrGroup
// ─────────────────────────────────────────────────────────────

function groupAttributes(rows: ParsedRow[]): AttrGroup[] {
  // Key: `${categoryPath}||${slug || attrName}` — groups by slug when available
  const map = new Map<string, AttrGroup>();
  const order: string[] = []; // preserve insertion order

  for (const row of rows) {
    if (row.type !== 'Attribute') continue;
    if (!row.attrName) continue;

    const key = `${row.categoryPath}||${row.slug || row.attrName}`;

    if (!map.has(key)) {
      order.push(key);
      map.set(key, {
        categoryPath: row.categoryPath,
        attrName:     row.attrName,
        slug:         row.slug,
        attrType:     row.attrType,
        isRequired:   row.isRequired,
        valType:      row.valType,
        defaultVal:   row.defaultVal,
        valMax:       row.valMax,
        unit:         row.unit,
        description:  row.description,
        sort:         row.sort,
        simpleOptions: [],
        firstRowNum:  row.rowNum,
      });
    }

    const group = map.get(key)!;

    if (row.dependsOn) {
      // DependsOn row — build options_map + defaultMap
      if (!group.dependsOn) {
        group.dependsOn = { parentSlug: row.dependsOn, optionsMap: {} };
      }
      const opts = row.textOptions
        ? row.textOptions.split('|').map(s => s.trim()).filter(Boolean)
        : [];
      group.dependsOn.optionsMap[row.whenValue || '*'] = opts;
      if (row.defaultVal) {
        if (!group.dependsOn.defaultMap) group.dependsOn.defaultMap = {};
        group.dependsOn.defaultMap[row.whenValue || '*'] = row.defaultVal;
      }
    } else if (row.valType === 'suggest' && row.textOptions) {
      // Simple suggest
      group.simpleOptions = row.textOptions
        .split('|').map(s => s.trim()).filter(Boolean);
    }
  }

  return order.map(k => map.get(k)!);
}

// ─────────────────────────────────────────────────────────────
// Build validation_rules jsonb from AttrGroup
// ─────────────────────────────────────────────────────────────

function buildValidationRules(
  group: AttrGroup,
): Record<string, unknown> {
  if (group.dependsOn) {
    const dep: Record<string, unknown> = {
      attribute_slug: group.dependsOn.parentSlug,
      options_map: group.dependsOn.optionsMap,
    };
    if (group.dependsOn.defaultMap && Object.keys(group.dependsOn.defaultMap).length > 0) {
      dep.default_map = group.dependsOn.defaultMap;
    }
    return {
      type: 'suggest',
      depends_on: dep,
    };
  }
  if (group.valType === 'suggest' && group.simpleOptions.length > 0) {
    const rules: Record<string, unknown> = {
      type: 'suggest',
      suggest: group.simpleOptions,
    };
    if (group.valMax) rules.max = Number(group.valMax) || group.valMax;
    return rules;
  }
  return {};
}

// ─────────────────────────────────────────────────────────────
// Parse CategoryPath into segments
// "Fitness > Activity > Gym > Cardio" → ["Fitness", "Activity", "Gym", "Cardio"]
// ─────────────────────────────────────────────────────────────

function parsePath(categoryPath: string): string[] {
  return categoryPath.split('>').map(s => s.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────────────────────

export async function importStructureExcel(
  file: File,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    created:  { areas: 0, categories: 0, attributes: 0 },
    updated:  { attributes: 0 },
    skipped:  0,
    conflicts: [],
    automations: { areasUpdated: 0, rulesImported: 0, rulesSkipped: 0 },
  };

  // ── 1. Read file ──────────────────────────────────────────
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Find the Structure sheet (unified format S26+) — case-insensitive for robustness
  const ws = wb.worksheets.find(s => s.name.toLowerCase() === 'structure') ?? wb.worksheets[0];

  if (!ws) throw new Error('No data sheet found in Excel file.');

  // ── 2. Detect header ──────────────────────────────────────
  const header = findHeader(ws);
  if (!header) {
    throw new Error(
      'Could not find column headers. Expected columns: Type, CategoryPath (or Chain), AttrName.',
    );
  }

  // ── 3. Parse rows ─────────────────────────────────────────
  const parsedRows = parseRows(ws, header);
  if (parsedRows.length === 0) {
    throw new Error('No data rows found in the file.');
  }

  // ── 4. Load current DB state ──────────────────────────────
  const [{ data: dbAreas }, { data: dbCats }, { data: dbAttrs }] =
    await Promise.all([
      supabase.from('areas').select('id, name, slug, settings').eq('user_id', userId),
      supabase
        .from('categories')
        .select('id, area_id, parent_category_id, name, slug, level, sort_order, path'),
      supabase
        .from('attribute_definitions')
        .select('id, category_id, name, slug, unit, description, sort_order, validation_rules, default_value'),
    ]);

  if (!dbAreas || !dbCats || !dbAttrs) {
    throw new Error('Failed to load current structure from database.');
  }

  // Build lookup maps
  const areaByName  = new Map<string, string>(); // name → id
  const areaBySlug  = new Map<string, string>(); // slug → id
  for (const a of dbAreas) {
    areaByName.set(a.name.toLowerCase(), a.id);
    areaBySlug.set(a.slug, a.id);
  }

  // catKey: `${areaId}/${parentCatId ?? 'root'}/${name.lower}` → id
  const catByKey = new Map<string, string>();
  // catPath: fullPath string → id (built after area + category maps ready)
  const catByPath = new Map<string, string>(); // fullPath → category id
  const catById   = new Map<string, { areaId: string; parentId: string | null; name: string; level: number; sortOrder: number }>();

  for (const c of dbCats) {
    const key = `${c.area_id}/${c.parent_category_id ?? 'root'}/${c.name.toLowerCase()}`;
    catByKey.set(key, c.id);
    catById.set(c.id, {
      areaId: c.area_id,
      parentId: c.parent_category_id,
      name: c.name,
      level: c.level,
      sortOrder: c.sort_order,
    });
  }

  // Build fullPath → catId (DFS is not needed — we reconstruct from parent chain)
  // We build a name-path → id map by walking parent chains
  function buildFullPath(catId: string): string {
    const parts: string[] = [];
    let cur: string | null = catId;
    while (cur) {
      const info = catById.get(cur);
      if (!info) break;
      parts.unshift(info.name);
      cur = info.parentId;
    }
    return parts.join(' > ');
  }

  // Populate catByPath
  for (const c of dbCats) {
    const fp = buildFullPath(c.id);
    catByPath.set(fp, c.id);
  }

  // Bug fix S21: key = `${slug}||${categoryId}` — slug is NOT globally unique.
  // Same slug in different categories = two independent attribute_definitions.
  // Lookup must be scoped to category_id to avoid false-positive conflicts.
  interface AttrRecord {
    id: string;
    categoryId: string | null;
    name: string;
    slug: string;
    unit: string | null;
    description: string | null;
    defaultValue: string | null;
    sortOrder: number;
    validationRules: Record<string, unknown>;
  }
  const attrBySlugCat = new Map<string, AttrRecord>(); // key: `${slug}||${categoryId}`
  // attrKey: `${categoryId}/${name.lower}` → id (for slug-less lookup)
  const attrByKey = new Map<string, string>();
  const attrById  = new Map<string, AttrRecord>();     // id → record (for name-based fallback)

  for (const a of dbAttrs) {
    const key = `${a.slug}||${a.category_id ?? ''}`;
    const rec: AttrRecord = {
      id:              a.id,
      categoryId:      a.category_id,
      name:            a.name,
      slug:            a.slug,
      unit:            a.unit ?? null,
      description:     a.description ?? null,
      defaultValue:    (a as { default_value?: string | null }).default_value ?? null,
      sortOrder:       a.sort_order,
      validationRules: (a.validation_rules as Record<string, unknown>) ?? {},
    };
    attrBySlugCat.set(key, rec);
    attrById.set(a.id, rec);
    if (a.category_id) {
      attrByKey.set(`${a.category_id}/${a.name.toLowerCase()}`, a.id);
    }
  }

  // Generate a URL-safe slug from an attribute name (mirrors UI logic)
  function makeAttrSlug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  // Helper: find or create area by name
  async function findOrCreateArea(areaName: string): Promise<string> {
    const existing = areaByName.get(areaName.toLowerCase());
    if (existing) return existing;

    const slug = generateSlug(areaName);
    const id   = crypto.randomUUID();
    const { error } = await supabase.from('areas').insert({
      id,
      user_id:    userId,
      name:       areaName,
      slug:       areaBySlug.has(slug) ? `${slug}-${id.slice(0, 6)}` : slug,
      sort_order: (dbAreas?.length ?? 0) + result.created.areas + 1,
    });
    if (error) throw new Error(`Failed to create Area "${areaName}": ${error.message}`);

    areaByName.set(areaName.toLowerCase(), id);
    areaBySlug.set(slug, id);
    result.created.areas++;
    return id;
  }

  // Helper: find or create a single category level
  async function findOrCreateCategory(
    areaId: string,
    parentId: string | null,
    name: string,
    level: number,
    sort: number,
  ): Promise<string> {
    const key = `${areaId}/${parentId ?? 'root'}/${name.toLowerCase()}`;
    const existing = catByKey.get(key);
    if (existing) return existing;

    const slug = generateSlug(name);
    const id   = crypto.randomUUID();
    const { error } = await supabase.from('categories').insert({
      id,
      user_id:            userId,
      area_id:            areaId,
      parent_category_id: parentId,
      name,
      slug,
      level,
      sort_order:         sort,
      description:        null,
    });
    if (error) throw new Error(`Failed to create Category "${name}": ${error.message}`);

    catByKey.set(key, id);
    catById.set(id, { areaId, parentId, name, level, sortOrder: sort });
    result.created.categories++;
    return id;
  }

  // Helper: resolve full CategoryPath to leaf category id (creates missing nodes)
  async function resolveCategoryPath(
    categoryPath: string,
    sort: number,
  ): Promise<string> {
    // Check cache first (fullPath → id)
    const cached = catByPath.get(categoryPath);
    if (cached) return cached;

    const segments = parsePath(categoryPath);
    if (segments.length === 0) throw new Error(`Empty CategoryPath: "${categoryPath}"`);

    const areaName = segments[0];
    const areaId   = await findOrCreateArea(areaName);

    let parentId: string | null = null;
    let lastCatId = '';

    for (let i = 1; i < segments.length; i++) {
      const name  = segments[i];
      const level = i; // L1 = 1, L2 = 2, ...
      const catId = await findOrCreateCategory(areaId, parentId, name, level, sort);
      parentId   = catId;
      lastCatId  = catId;
    }

    if (!lastCatId) {
      throw new Error(`CategoryPath has only one segment (area name): "${categoryPath}"`);
    }

    catByPath.set(categoryPath, lastCatId);
    return lastCatId;
  }

  // ── 5. Group attribute rows ───────────────────────────────
  const attrGroups = groupAttributes(parsedRows);

  // ── 6. Collect unique CategoryPaths from Area + Category + Attribute rows ──
  // (Ensure all category chains exist before processing attributes)
  // Area rows: create the area itself (no categories needed)
  for (const row of parsedRows) {
    if (row.type === 'Area') {
      await findOrCreateArea(row.categoryPath.split('>')[0].trim());
    }
  }

  const pathsToResolve = new Map<string, number>(); // path → sort
  for (const row of parsedRows) {
    if (row.type === 'Category' || row.type === 'Attribute') {
      if (!pathsToResolve.has(row.categoryPath)) {
        pathsToResolve.set(row.categoryPath, row.sort);
      }
    }
  }

  for (const [path, sort] of pathsToResolve) {
    // For Category rows: path IS the category (no attrs needed)
    // For Attribute rows: path IS the category that owns the attr
    // Both cases: ensure the category chain exists
    const segments = parsePath(path);
    if (segments.length >= 2) {
      await resolveCategoryPath(path, sort);
    }
  }

  // ── 7. Process attributes ─────────────────────────────────
  for (const group of attrGroups) {
    const segments = parsePath(group.categoryPath);
    if (segments.length < 2) {
      // Attribute row with only an area name as path — skip
      result.skipped++;
      continue;
    }

    // Get leaf category id (should already exist from step 6)
    const categoryId = catByPath.get(group.categoryPath);
    if (!categoryId) {
      result.skipped++;
      continue;
    }

    const validationRules = buildValidationRules(group);

    // Per-category lookup: slug is unique within a category, NOT globally.
    // Two categories can have an attribute with the same slug — that's valid.
    // When Excel slug is empty, generate one client-side (no DB trigger exists).
    const effectiveSlug = group.slug || makeAttrSlug(group.attrName);
    const slugCatKey    = effectiveSlug ? `${effectiveSlug}||${categoryId}` : null;
    let   existing      = slugCatKey ? attrBySlugCat.get(slugCatKey) : null;

    // Name-based fallback: if slug was empty AND slug-lookup missed (attr in DB also has empty slug)
    if (!existing && !group.slug && categoryId) {
      const nameKey    = `${categoryId}/${group.attrName.toLowerCase()}`;
      const existingId = attrByKey.get(nameKey);
      if (existingId) existing = attrById.get(existingId) ?? null;
    }

    if (!existing) {
      // CREATE — slug not found in THIS category (or empty slug → trigger generates)
      const { error } = await supabase.from('attribute_definitions').insert({
        id:               crypto.randomUUID(),
        user_id:          userId,
        category_id:      categoryId,
        name:             group.attrName,
        slug:             effectiveSlug,     // always non-empty — generated from name if Excel was blank
        data_type:        group.attrType as ('number'|'text'|'datetime'|'boolean'|'link'|'image'),
        unit:             group.unit || null,
        is_required:      group.isRequired,
        default_value:    group.defaultVal === '_' ? null : (group.defaultVal || null),
        validation_rules: validationRules,
        sort_order:       group.sort,
        description:      group.description || null,
      });
      if (error) {
        console.error('Import: failed to create attr', group.attrName, error);
        result.skipped++;
      } else {
        result.created.attributes++;
        // Update in-memory cache so later rows in same import session see it
        if (effectiveSlug && slugCatKey) {
          const newRec: AttrRecord = {
            id:              '',
            categoryId,
            name:            group.attrName,
            slug:            effectiveSlug,
            unit:            group.unit || null,
            description:     group.description || null,
            defaultValue:    group.defaultVal || null,
            sortOrder:       group.sort,
            validationRules: validationRules,
          };
          attrBySlugCat.set(slugCatKey, newRec);
          attrByKey.set(`${categoryId}/${group.attrName.toLowerCase()}`, '');
        }
      }
      continue;
    }

    // Slug found in this category — dirty check before UPDATE.
    // Compare all updatable fields; if nothing changed, skip entirely (no DB write).
    const newRules = validationRules;

    const nameDiff    = existing.name         !== group.attrName;
    const unitDiff    = (existing.unit         ?? '') !== (group.unit        || '');
    const descDiff    = (existing.description  ?? '') !== (group.description || '');
    const importDefault = group.defaultVal === '_' ? '' : (group.defaultVal || '');
    const defaultDiff = (existing.defaultValue ?? '') !== importDefault;
    const sortDiff    = existing.sortOrder    !== group.sort;
    const rulesDiff   = normalizeJson(existing.validationRules) !== normalizeJson(newRules);

    const isDirty = nameDiff || unitDiff || descDiff || defaultDiff || sortDiff || rulesDiff;

    // DEBUG — remove after S21 testing
    if (isDirty) {
      console.log('[Import dirty]', group.slug, '|', group.categoryPath, {
        nameDiff,
        unitDiff,   dbUnit:  existing.unit,        xlUnit:  group.unit        || null,
        descDiff,   dbDesc:  existing.description, xlDesc:  group.description || null,
        sortDiff,   dbSort:  existing.sortOrder,   xlSort:  group.sort,
        rulesDiff,  dbRules: normalizeJson(existing.validationRules),
                    xlRules: normalizeJson(newRules),
      });
    }

    if (!isDirty) {
      // Nothing changed — skip silently (not counted as error/skipped)
      continue;
    }

    // SAFE UPDATE — values differ, update only safe ops (never data_type, never moves)
    const { error } = await supabase
      .from('attribute_definitions')
      .update({
        slug:             effectiveSlug || existing.slug,  // keep existing slug if Excel was blank
        name:             group.attrName,
        unit:             group.unit || null,
        description:      group.description || null,
        default_value:    group.defaultVal === '_' ? null : (group.defaultVal || null),
        sort_order:       group.sort,
        validation_rules: newRules,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Import: failed to update attr', group.slug, error);
      result.skipped++;
    } else {
      result.updated.attributes++;
    }
  }

  // ── 8. Update comment_template on Areas and leaf Categories ──
  const hasCommentTplCol = header.colCommentTpl > 0;
  if (hasCommentTplCol) {
    for (const row of parsedRows) {
      if (row.type !== 'Area' && row.type !== 'Category') continue;
      const xlTpl = row.commentTpl === '_' ? null : (row.commentTpl || null);

      if (row.type === 'Area') {
        const areaId = areaByName.get(row.categoryPath.split('>')[0].trim().toLowerCase());
        if (!areaId) continue;
        const existingArea = dbAreas?.find(a => a.id === areaId);
        const dbTpl = existingArea?.settings?.comment_template ?? null;
        if (dbTpl === xlTpl) continue;
        const newSettings = { ...(existingArea?.settings ?? {}), comment_template: xlTpl ?? undefined };
        await supabase.from('areas').update({ settings: newSettings }).eq('id', areaId);
        // Keep in-memory snapshot fresh — section 9 (Automations) spreads the same
        // settings object; a stale copy would silently revert this template change.
        if (existingArea) existingArea.settings = newSettings;
      }

      if (row.type === 'Category') {
        const catId = catByPath.get(row.categoryPath);
        if (!catId) continue;
        await supabase.from('categories').update({
          settings: { comment_template: xlTpl ?? undefined },
        }).eq('id', catId);
      }
    }
  }

  // ── 9. Automations sheet — set_attribute rules (Faza 2b) ──
  // Redovi zamjenjuju SVA set_attribute pravila navedene Aree; Aree koje se
  // ne spominju u sheetu ostaju netaknute. Stariji exporti bez sheeta = no-op.
  const autoWs = wb.worksheets.find(s => s.name.toLowerCase() === 'automations');
  if (autoWs) {
    // Header (row 1): Area | RuleName | Action | TargetAttr | MapAttr | DateMap
    const headerVals: string[] = [];
    autoWs.getRow(1).eachCell({ includeEmpty: true }, (cell, colNum) => {
      headerVals[colNum - 1] = cellStr(cell).toLowerCase();
    });
    const aCol = (name: string) => headerVals.findIndex(v => v === name) + 1; // 0 = not found

    const colArea = aCol('area');
    const colRuleName = aCol('rulename');
    const colAction = aCol('action');
    const colTarget = aCol('targetattr');
    const colMap = aCol('mapattr');
    const colDateMap = aCol('datemap');

    if (colArea > 0 && colAction > 0 && colTarget > 0 && colMap > 0 && colDateMap > 0) {
      // Per-area set of known attribute slugs (walk category → area via catById).
      // attrBySlugCat already contains attrs created earlier in THIS import run.
      const slugsByArea = new Map<string, Set<string>>();
      for (const rec of attrBySlugCat.values()) {
        const areaId = rec.categoryId ? catById.get(rec.categoryId)?.areaId : undefined;
        if (!areaId) continue;
        let set = slugsByArea.get(areaId);
        if (!set) { set = new Set(); slugsByArea.set(areaId, set); }
        set.add(rec.slug);
      }

      const rulesByArea = new Map<string, AttributeRuleConfig[]>();
      const lastRow = autoWs.lastRow?.number ?? 1;

      for (let r = 2; r <= lastRow; r++) {
        const row = autoWs.getRow(r);
        const get = (colNum: number): string => (colNum > 0 ? cellStr(row.getCell(colNum)) : '');

        if (get(colAction).toLowerCase() !== 'set_attribute') continue; // help/blank rows

        const areaName = get(colArea);
        const targetSlug = get(colTarget);
        const mapSlug = get(colMap);
        const dateMapRaw = get(colDateMap);
        const areaId = areaByName.get(areaName.toLowerCase());

        if (!areaId || !targetSlug || !mapSlug || !dateMapRaw) {
          console.warn(`[Automations import] row ${r}: unknown area or missing fields — skipped`);
          result.automations.rulesSkipped++;
          continue;
        }

        // Slugovi moraju postojati u toj Arei — mrtvo pravilo se ne uvozi
        const areaSlugs = slugsByArea.get(areaId);
        if (!areaSlugs?.has(targetSlug) || !areaSlugs.has(mapSlug)) {
          console.warn(`[Automations import] row ${r}: slug "${!areaSlugs?.has(targetSlug) ? targetSlug : mapSlug}" not found in area "${areaName}" — skipped`);
          result.automations.rulesSkipped++;
          continue;
        }

        // DateMap: "Mastercard=next:11 | Visa=next:3 | Racun=same"
        const dateMap: Record<string, string> = {};
        let mapValid = true;
        for (const entry of dateMapRaw.split('|')) {
          const trimmed = entry.trim();
          if (!trimmed) continue;
          const eq = trimmed.indexOf('=');
          const key = eq > 0 ? trimmed.slice(0, eq).trim() : '';
          const ruleStr = eq > 0 ? trimmed.slice(eq + 1).trim() : '';
          if (!key || !isValidDateRule(ruleStr)) { mapValid = false; break; }
          dateMap[key] = ruleStr;
        }
        if (!mapValid || Object.keys(dateMap).length === 0) {
          console.warn(`[Automations import] row ${r}: invalid DateMap "${dateMapRaw}" — skipped`);
          result.automations.rulesSkipped++;
          continue;
        }

        const rule: AttributeRuleConfig = {
          action: 'set_attribute',
          ...(get(colRuleName) ? { name: get(colRuleName) } : {}),
          target_slug: targetSlug,
          map_slug: mapSlug,
          date_map: dateMap,
        };
        const list = rulesByArea.get(areaId) ?? [];
        list.push(rule);
        rulesByArea.set(areaId, list);
      }

      // Canonical compare — order-insensitive on date_map keys
      const canon = (rules: AttributeRuleConfig[]): string =>
        JSON.stringify(rules.map(rl => [
          rl.action, rl.name ?? '', rl.target_slug, rl.map_slug,
          Object.entries(rl.date_map).sort(([a], [b]) => a.localeCompare(b)),
        ]));

      for (const [areaId, rules] of rulesByArea) {
        const existingArea = dbAreas?.find(a => a.id === areaId);
        const existingRules = (existingArea?.settings?.automations?.attribute_rules ?? []) as AttributeRuleConfig[];
        result.automations.rulesImported += rules.length;
        if (canon(existingRules) === canon(rules)) continue; // unchanged

        const newSettings = {
          ...(existingArea?.settings ?? {}),
          automations: { ...(existingArea?.settings?.automations ?? {}), attribute_rules: rules },
        };
        const { error } = await supabase.from('areas').update({ settings: newSettings }).eq('id', areaId);
        if (error) {
          console.error('[Automations import] failed to update area settings:', error);
          result.automations.rulesSkipped += rules.length;
          result.automations.rulesImported -= rules.length;
        } else {
          if (existingArea) existingArea.settings = newSettings;
          result.automations.areasUpdated++;
        }
      }
    }
  }

  return result;
}
