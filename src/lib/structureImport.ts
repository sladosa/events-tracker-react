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
  // DependsOn: { parentSlug, optionsMap }
  dependsOn?: {
    parentSlug: string;
    optionsMap: Record<string, string[]>;
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
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// Group multi-row DependsOn attributes into single AttrGroup
// ─────────────────────────────────────────────────────────────

function groupAttributes(rows: ParsedRow[]): AttrGroup[] {
  // Key: `${categoryPath}||${attrName}` — groups all rows for same attr
  const map = new Map<string, AttrGroup>();
  const order: string[] = []; // preserve insertion order

  for (const row of rows) {
    if (row.type !== 'Attribute') continue;
    if (!row.attrName) continue;

    const key = `${row.categoryPath}||${row.attrName}`;

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
      // DependsOn row — build options_map
      if (!group.dependsOn) {
        group.dependsOn = { parentSlug: row.dependsOn, optionsMap: {} };
      }
      const opts = row.textOptions
        ? row.textOptions.split('|').map(s => s.trim()).filter(Boolean)
        : [];
      group.dependsOn.optionsMap[row.whenValue || '*'] = opts;
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
    return {
      type: 'suggest',
      depends_on: {
        attribute_slug: group.dependsOn.parentSlug,
        options_map: group.dependsOn.optionsMap,
      },
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
      supabase.from('areas').select('id, name, slug').eq('user_id', userId),
      supabase
        .from('categories')
        .select('id, area_id, parent_category_id, name, slug, level, sort_order, path'),
      supabase
        .from('attribute_definitions')
        .select('id, category_id, name, slug, unit, description, sort_order, validation_rules'),
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
    unit: string | null;
    description: string | null;
    sortOrder: number;
    validationRules: Record<string, unknown>;
  }
  const attrBySlugCat = new Map<string, AttrRecord>(); // key: `${slug}||${categoryId}`
  // attrKey: `${categoryId}/${name.lower}` → id (for slug-less lookup, unchanged)
  const attrByKey = new Map<string, string>();

  for (const a of dbAttrs) {
    const key = `${a.slug}||${a.category_id ?? ''}`;
    attrBySlugCat.set(key, {
      id:              a.id,
      categoryId:      a.category_id,
      name:            a.name,
      unit:            a.unit ?? null,
      description:     a.description ?? null,
      sortOrder:       a.sort_order,
      validationRules: (a.validation_rules as Record<string, unknown>) ?? {},
    });
    if (a.category_id) {
      attrByKey.set(`${a.category_id}/${a.name.toLowerCase()}`, a.id);
    }
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
    const slugCatKey = group.slug ? `${group.slug}||${categoryId}` : null;
    const existing   = slugCatKey ? attrBySlugCat.get(slugCatKey) : null;

    if (!existing) {
      // CREATE — slug not found in THIS category (or empty slug → trigger generates)
      const { error } = await supabase.from('attribute_definitions').insert({
        id:               crypto.randomUUID(),
        user_id:          userId,
        category_id:      categoryId,
        name:             group.attrName,
        slug:             group.slug || '', // trigger generates if empty
        data_type:        group.attrType as ('number'|'text'|'datetime'|'boolean'|'link'|'image'),
        unit:             group.unit || null,
        is_required:      group.isRequired,
        default_value:    group.defaultVal || null,
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
        if (group.slug && slugCatKey) {
          attrBySlugCat.set(slugCatKey, {
            id:              '',
            categoryId,
            name:            group.attrName,
            unit:            group.unit || null,
            description:     group.description || null,
            sortOrder:       group.sort,
            validationRules: validationRules,
          });
        }
      }
      continue;
    }

    // Slug found in this category — dirty check before UPDATE.
    // Compare all updatable fields; if nothing changed, skip entirely (no DB write).
    const newRules = validationRules;

    const nameDiff   = existing.name        !== group.attrName;
    const unitDiff   = (existing.unit        ?? '') !== (group.unit        || '');
    const descDiff   = (existing.description ?? '') !== (group.description || '');
    const sortDiff   = existing.sortOrder   !== group.sort;
    const rulesDiff  = normalizeJson(existing.validationRules) !== normalizeJson(newRules);

    const isDirty = nameDiff || unitDiff || descDiff || sortDiff || rulesDiff;

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
        slug:             group.slug,  // explicit: prevents trigger overwrite
        name:             group.attrName,
        unit:             group.unit || null,
        description:      group.description || null,
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

  return result;
}
