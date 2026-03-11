/**
 * Events Tracker – Excel Import Engine
 * ======================================
 * Port of Streamlit parse_events_excel_v2 + apply_import_changes → TypeScript / ExcelJS
 * Version: 1.0.0
 *
 * Key principles (same as Streamlit V2.4.5+):
 *   - ATTRIBUTE LEGEND = Source of Truth for column mapping
 *   - Users CAN delete legend rows (removes attr from import)
 *   - If legend col letters don't match headers → REJECT with instructions
 *   - Smart reclassify: invalid event_ids → CREATE instead of silent failure
 *   - Multi-level create: one Excel row → parent + child events
 *   - Validation: created_at >= session_start (per row)
 */

import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { FIXED_COL_COUNT } from './excelExport';
import { loadCategoriesForExport, loadAttrDefsForCategories } from './excelDataLoader';
import type {
  ExportCategoriesDict,
  ExportAttrDef,
  LegendMapping,
  ParsedImportRow,
  ParseResult,
  ValidationResult,
  ApplyResult,
} from './excelTypes';

// ─────────────────────────────────────────────
// Time parsing helpers
// ─────────────────────────────────────────────

/** Parse HH:MM or HH:MM:SS string → { h, m, s } */
function parseTimeStr(str: string): { h: number; m: number; s: number } | null {
  if (!str) return null;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  return { h: parts[0] ?? 0, m: parts[1] ?? 0, s: parts[2] ?? 0 };
}

/** Combine date string YYYY-MM-DD + time object → ISO datetime string */
function toISO(dateStr: string, time: { h: number; m: number; s: number }): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(time.h, time.m, time.s, 0);
  return d.toISOString();
}

/** Normalize an Excel cell value to a YYYY-MM-DD string */
function normalizeDateCell(val: ExcelJS.CellValue): string {
  if (!val) return '';
  if (val instanceof Date) {
    const y  = val.getFullYear();
    const mo = (val.getMonth() + 1).toString().padStart(2, '0');
    const d  = val.getDate().toString().padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const str = String(val).trim();
  // Accept YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[./]/);
  if (parts.length === 3) {
    const [p0, p1, p2] = parts;
    if (p2 && p2.length === 4) {
      // DD.MM.YYYY
      return `${p2}-${p1!.padStart(2,'0')}-${p0!.padStart(2,'0')}`;
    }
  }
  return str;
}

/** Get a plain string from an ExcelJS cell value */
function cellStr(val: ExcelJS.CellValue): string {
  if (val == null) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'richText' in (val as object)) {
    return ((val as { richText: { text: string }[] }).richText ?? []).map(r => r.text).join('');
  }
  return String(val).trim();
}

// ─────────────────────────────────────────────
// Step 1: Parse ATTRIBUTE LEGEND
// ─────────────────────────────────────────────

function parseLegend(ws: ExcelJS.Worksheet): { mapping: LegendMapping; legendEndRow: number; error: string } {
  let legendStartRow = -1;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (legendStartRow !== -1) return;
    const v = cellStr(row.getCell(1).value);
    if (v.includes('ATTRIBUTE LEGEND')) legendStartRow = rowNumber;
  });

  if (legendStartRow === -1) {
    return { mapping: {}, legendEndRow: 0, error: 'Could not find ATTRIBUTE LEGEND section. Invalid file format.' };
  }

  const legendHeaderRow = legendStartRow + 1;
  const mapping: LegendMapping = {};
  let legendEndRow = legendHeaderRow;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= legendHeaderRow) return;

    const colCell = cellStr(row.getCell(1).value);
    if (!colCell) return;   // blank col → skip this row

    let letter = colCell.toUpperCase().replace(/^COL\s*/, '').trim();
    if (!letter) return;

    // Stop if col A is not a valid Excel column letter (1-3 capital letters A-Z).
    // This prevents reading EVENT DATA rows (which have event_id, UUIDs etc.) as legend rows.
    if (!/^[A-Z]{1,3}$/.test(letter)) return;

    const area         = cellStr(row.getCell(2).value);
    const categoryPath = cellStr(row.getCell(3).value);
    const attrName     = cellStr(row.getCell(4).value);

    if (!attrName) return;

    mapping[letter] = { area, categoryPath, attrName };
    legendEndRow = rowNumber;
  });

  if (Object.keys(mapping).length === 0) {
    return { mapping, legendEndRow, error: 'No valid attribute mappings found in ATTRIBUTE LEGEND.' };
  }

  return { mapping, legendEndRow, error: '' };
}

// ─────────────────────────────────────────────
// Step 2: Find EVENT DATA section + header row
// ─────────────────────────────────────────────

function findEventDataSection(ws: ExcelJS.Worksheet, afterRow: number): { titleRow: number; headerRow: number; error: string } {
  let titleRow = -1;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (titleRow !== -1 || rowNumber <= afterRow) return;
    if (cellStr(row.getCell(1).value).includes('EVENT DATA')) titleRow = rowNumber;
  });

  if (titleRow === -1) {
    return { titleRow: -1, headerRow: -1, error: 'Could not find EVENT DATA section. Invalid file format.' };
  }

  return { titleRow, headerRow: titleRow + 1, error: '' };
}

// ─────────────────────────────────────────────
// Step 3: Validate legend vs actual headers
// ─────────────────────────────────────────────

function validateLegendHeaders(
  ws:         ExcelJS.Worksheet,
  mapping:    LegendMapping,
  headerRow:  number,
): string[] {
  const errors: string[] = [];

  for (const [letter, { attrName }] of Object.entries(mapping)) {
    try {
      // ExcelJS column index from letter
      const colIdx = colLetterToIndex(letter);
      if (colIdx < 1) {
        errors.push(`Invalid column letter '${letter}' in LEGEND.`);
        continue;
      }

      const actualHeader = cellStr(ws.getRow(headerRow).getCell(colIdx).value);
      if (!actualHeader) continue; // column doesn't exist → will be ignored

      // Accept "attrName" or "attrName (Category)" format
      const baseHeader = actualHeader.split('(')[0].trim();
      if (baseHeader !== attrName) {
        errors.push(`Col ${letter}: Legend says '${attrName}' but header shows '${actualHeader}'`);
      }
    } catch {
      errors.push(`Invalid column letter '${letter}' in LEGEND.`);
    }
  }

  return errors;
}

/** Convert column letter to 1-based index */
function colLetterToIndex(letter: string): number {
  let result = 0;
  for (const ch of letter.toUpperCase()) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

// ─────────────────────────────────────────────
// Step 4: Parse data rows
// ─────────────────────────────────────────────

function parseDataRows(
  ws:         ExcelJS.Worksheet,
  mapping:    LegendMapping,
  headerRow:  number,
): ParsedImportRow[] {
  const colToAttr: Record<number, string> = {};
  for (const [letter, { attrName }] of Object.entries(mapping)) {
    const idx = colLetterToIndex(letter);
    if (idx > 0) colToAttr[idx] = attrName;
  }

  const rows: ParsedImportRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    // Require area (col B) to detect valid data rows
    const area = cellStr(row.getCell(2).value);
    if (!area) return;

    const eventId      = cellStr(row.getCell(1).value) || null;
    const categoryPath = cellStr(row.getCell(3).value);
    const eventDate    = normalizeDateCell(row.getCell(4).value);
    const sessionStart = cellStr(row.getCell(5).value) || '09:00';
    const createdAt    = cellStr(row.getCell(6).value) || '';
    // Comment: merged G:J, read from col 7 (G)
    const comment      = cellStr(row.getCell(FIXED_COL_COUNT).value);

    // Attributes via legend mapping
    const attributes: Record<string, string | number | boolean | null> = {};
    for (const [colIdx, attrName] of Object.entries(colToAttr)) {
      const val = row.getCell(Number(colIdx)).value;
      if (val == null) continue;
      if (typeof val === 'number' || typeof val === 'boolean') {
        attributes[attrName] = val;
      } else if (val instanceof Date) {
        attributes[attrName] = val.toISOString();
      } else {
        const s = cellStr(val as ExcelJS.CellValue);
        if (s !== '') attributes[attrName] = s;
      }
    }

    rows.push({
      event_id:      eventId,
      area,
      category_path: categoryPath,
      event_date:    eventDate,
      session_start: sessionStart,
      created_at:    createdAt,
      comment,
      attributes,
      _source_row:   rowNumber,
    });
  });

  return rows;
}

// ─────────────────────────────────────────────
// Public: parse Excel file → ParseResult
// ─────────────────────────────────────────────

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb          = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const ws = wb.worksheets[0];
  if (!ws) return { toCreate: [], toUpdate: [], warnings: [], errors: ['Excel file has no worksheets.'], legendMapping: {} };

  // Parse legend
  const { mapping, legendEndRow, error: legendError } = parseLegend(ws);
  if (legendError) return { toCreate: [], toUpdate: [], warnings: [], errors: [legendError], legendMapping: {} };

  // Find EVENT DATA
  const { headerRow, error: sectionError } = findEventDataSection(ws, legendEndRow);
  if (sectionError) return { toCreate: [], toUpdate: [], warnings: [], errors: [sectionError], legendMapping: mapping };

  // Validate legend vs headers
  const mismatchErrors = validateLegendHeaders(ws, mapping, headerRow);
  if (mismatchErrors.length > 0) {
    const msg =
      '❌ Cannot import: Column headers don\'t match ATTRIBUTE LEGEND!\n\n' +
      'This usually happens when you delete columns from EVENT DATA.\n' +
      'Excel shifts remaining columns but Legend still shows old positions.\n\n' +
      '🔍 Mismatches found:\n' +
      mismatchErrors.map(e => `  • ${e}`).join('\n') +
      '\n\n📝 How to fix:\n' +
      '  1. Open ATTRIBUTE LEGEND in Excel\n' +
      '  2. For each mismatch: UPDATE "Col" letter OR DELETE the legend row\n' +
      '  3. Save Excel and import again\n\n' +
      '✅ Remember: ATTRIBUTE LEGEND = source of truth!';
    return { toCreate: [], toUpdate: [], warnings: [], errors: [msg], legendMapping: mapping };
  }

  // Parse data rows
  const allRows = parseDataRows(ws, mapping, headerRow);

  // Validate time ordering per row: created_at >= session_start
  const warnings: string[] = [];
  const validRows: ParsedImportRow[] = [];

  for (const r of allRows) {
    if (r.created_at && r.session_start) {
      const ss = parseTimeStr(r.session_start);
      const ca = parseTimeStr(r.created_at);
      if (ss && ca) {
        const ssSeconds = ss.h * 3600 + ss.m * 60 + ss.s;
        const caSeconds = ca.h * 3600 + ca.m * 60 + ca.s;
        if (caSeconds < ssSeconds) {
          warnings.push(
            `Row ${r._source_row}: created_at (${r.created_at}) is before session_start (${r.session_start}). ` +
            `Row will still be imported but please review.`
          );
        }
      }
    }
    validRows.push(r);
  }

  const toCreate = validRows.filter(r => !r.event_id);
  const toUpdate = validRows.filter(r => !!r.event_id);

  return { toCreate, toUpdate, warnings, errors: [], legendMapping: mapping };
}

// ─────────────────────────────────────────────
// Smart reclassify (port of Python V2.4.6)
// ─────────────────────────────────────────────

async function smartReclassify(
  userId:         string,
  toCreate:       ParsedImportRow[],
  toUpdate:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
): Promise<{ toCreate: ParsedImportRow[]; toUpdate: ParsedImportRow[]; warnings: string[] }> {
  if (toUpdate.length === 0) return { toCreate, toUpdate, warnings: [] };

  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[info.full_path] = id;

  const eventIds = toUpdate.map(r => r.event_id!).filter(Boolean);

  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, category_id')
    .in('id', eventIds)
    .eq('user_id', userId);

  const existingMap = new Map<string, string>(
    (existingEvents ?? []).map(e => [e.id, e.category_id])
  );

  const validUpdates:        ParsedImportRow[] = [];
  const reclassifiedCreates: ParsedImportRow[] = [];
  const notFound:            string[] = [];
  const mismatch:            string[] = [];

  for (const row of toUpdate) {
    const eid = row.event_id!;

    if (!existingMap.has(eid)) {
      reclassifiedCreates.push({ ...row, event_id: null });
      notFound.push(eid.slice(0, 8) + '...');
      continue;
    }

    const existingCatId  = existingMap.get(eid)!;
    const expectedCatId  = catByPath[row.category_path] ?? null;

    if (existingCatId !== expectedCatId) {
      reclassifiedCreates.push({ ...row, event_id: null });
      mismatch.push(eid.slice(0, 8) + '...');
      continue;
    }

    validUpdates.push(row);
  }

  const warnings: string[] = [];
  if (reclassifiedCreates.length > 0) {
    let msg = `⚠️ ${reclassifiedCreates.length} row(s) had invalid event IDs → will be created as NEW events:`;
    if (notFound.length > 0) msg += `\n  - ${notFound.length} event ID(s) not found in database`;
    if (mismatch.length  > 0) msg += `\n  - ${mismatch.length} event ID(s) belonged to different categories`;
    msg += '\n\n💡 Tip: When adding new events in Excel, clear column A to avoid this.';
    warnings.push(msg);
  }

  return {
    toCreate: [...toCreate, ...reclassifiedCreates],
    toUpdate: validUpdates,
    warnings,
  };
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

export function validateImportData(
  toCreate:       ParsedImportRow[],
  toUpdate:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
): ValidationResult {
  const errors: string[] = [];
  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[info.full_path] = id;

  const validCreates: ParsedImportRow[] = [];
  const validUpdates: ParsedImportRow[] = [];

  for (const row of toCreate) {
    const rowErrors: string[] = [];
    if (!row.event_date)    rowErrors.push(`Row ${row._source_row}: event_date is required`);
    if (!row.category_path) rowErrors.push(`Row ${row._source_row}: Category_Path is required`);
    else if (!catByPath[row.category_path]) rowErrors.push(`Row ${row._source_row}: Category_Path '${row.category_path}' not found`);

    if (rowErrors.length > 0) errors.push(...rowErrors);
    else validCreates.push(row);
  }

  for (const row of toUpdate) {
    const rowErrors: string[] = [];
    if (!row.event_id)   rowErrors.push(`Update row ${row._source_row}: event_id is required`);
    if (!row.event_date) rowErrors.push(`Update row ${row._source_row}: event_date is required`);

    if (rowErrors.length > 0) errors.push(...rowErrors);
    else validUpdates.push(row);
  }

  return { validCreates, validUpdates, errors };
}

// ─────────────────────────────────────────────
// Get hierarchy levels for a category path
// ─────────────────────────────────────────────

function getHierarchyLevels(
  categoryPath:   string,
  categoriesDict: ExportCategoriesDict,
): Array<{ partialPath: string; categoryId: string }> {
  const pathToId: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) pathToId[info.full_path] = id;

  const parts = categoryPath.split(' > ').map(p => p.trim());
  const result: Array<{ partialPath: string; categoryId: string }> = [];

  for (let i = 1; i <= parts.length; i++) {
    const partial = parts.slice(0, i).join(' > ');
    const catId   = pathToId[partial];
    if (catId) result.push({ partialPath: partial, categoryId: catId });
  }

  return result;
}

// ─────────────────────────────────────────────
// Apply import changes to database
// ─────────────────────────────────────────────

export async function applyImportChanges(
  userId:              string,
  _toCreate:           ParsedImportRow[],
  _toUpdate:           ParsedImportRow[],
  categoriesDict:      ExportCategoriesDict,
  attrDefs:            ExportAttrDef[],
  /** Map<sessionKey, decision>:
   *   'replace' = obriši stare leaf evente + INSERT nove (pravi overwrite)
   *   'add'     = zadrži stare + dodaj nove (dodaj u sesiju)
   *   'skip'    = preskoči cijelu sesiju
   *   undefined = nema kolizije, normalan INSERT
   */
  overwriteDecisions:  Map<string, 'replace' | 'add' | 'skip'> = new Map(),
): Promise<ApplyResult> {
  // Local mutable copies so BUG-F fix can reclassify rows
  let toCreate = _toCreate; // eslint-disable-line prefer-const
  let toUpdate = _toUpdate; // eslint-disable-line prefer-const

  let created  = 0;
  let updated  = 0;
  const errors:   string[] = [];
  const warnings: string[] = [];

  // Build (category_id, attr_name) → attr_def lookup
  const attrByCatName = new Map<string, ExportAttrDef>();
  for (const def of attrDefs) {
    attrByCatName.set(`${def.category_id}||${def.name}`, def);
  }

  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[info.full_path] = id;

  // ── BUG-F fix: reclassify toUpdate rows za 'replace' sesije ──────────────
  // Ako je sesija odlučena kao 'replace', stari leaf eventi su već obrisani
  // (DELETE će se pokrenuti niže). UPDATE na obrisani event_id bi pao s
  // "Event not found" i ostavio bazu u parcijalnom stanju. Rješenje: tretiraj
  // sve takve redove kao CREATE (postavi event_id = null).
  {
    const reclassifiedCreates: ParsedImportRow[] = [];
    const remainingUpdates:    ParsedImportRow[] = [];
    for (const row of toUpdate) {
      const ssParsed       = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
      const sessionISO     = toISO(row.event_date, ssParsed);
      const levels         = getHierarchyLevels(row.category_path, categoriesDict);
      const leafCatId      = levels[levels.length - 1]?.categoryId ?? '';
      const sessionKey     = `${row.event_date}__${sessionISO}__${leafCatId}`;
      if (overwriteDecisions.get(sessionKey) === 'replace') {
        reclassifiedCreates.push({ ...row, event_id: null });
        warnings.push(`Row ${row._source_row}: reclassified as CREATE (session is being replaced).`);
      } else {
        remainingUpdates.push(row);
      }
    }
    if (reclassifiedCreates.length > 0) {
      toCreate = [...toCreate, ...reclassifiedCreates];
      toUpdate = remainingUpdates;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────
  // Helper: pronađi parent event koristeći chain disambiguation
  // Traži event s (category_id + session_start) koji pripada
  // lancu čiji LEAF (leafCategoryId) postoji za istu sesiju.
  //
  // BUG-G fix: koristimo LEAF kao disambiguator, ne immediate child.
  // Razlog: dva lanca mogu dijeliti isti intermediate parent (npr.
  // Activity→Gym→Cardio i Activity→Gym→Strength dijele Gym).
  // Immediate child (Gym) nije unique — leaf (Cardio vs Strength) jest.
  //
  // VAŽNO: ne smijemo raditi early return za candidates.length === 1
  // jer prvi lanac koji se procesira kreira Activity event i on postaje
  // jedini kandidat — ali možda ne pripada ovom lancu.
  // ────────────────────────────────────────────────────────
  const findParentEventByChain = async (
    categoryId:     string,
    sessionISO:     string,
    leafCategoryId: string, // leaf u lancu = chain discriminator (BUG-G fix v2)
  ): Promise<string | null> => {
    // BUG-G fix v2: comment field kao chain discriminator.
    // Parent eventi imaju comment = leafCategoryId od importa.
    // Ovo eliminira nedeterminizam candidates[0] kad postoji više
    // parent evenata za isti category_id + session_start (npr. Cardio i
    // Strength imaju svaki svoju Activity sesiju s istim session_start).
    const { data: byChainKey } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('session_start', sessionISO)
      .eq('comment', leafCategoryId)
      .limit(1);

    if (byChainKey && byChainKey.length > 0) {
      return (byChainKey[0] as { id: string }).id;
    }

    // Fallback za staru data (comment = null, kreirana prije BUG-G fix v2).
    // Stara data ima samo 1 parent event po kategoriji po sesiji → sigurno je
    // uzeti jedini pronađeni event.
    const { data: legacy } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('session_start', sessionISO)
      .is('comment', null);

    if (legacy && legacy.length === 1) {
      return (legacy[0] as { id: string }).id;
    }

    return null;
  };

  // ────────────────────────────────────────────────────────
  // Helper: upsert parent event za UPDATE tok
  // Za CREATE tok koristimo direktni INSERT bez SELECT (vidi prolaz 2)
  // ────────────────────────────────────────────────────────
  const upsertParentEventForUpdate = async (
    categoryId:     string,
    leafCategoryId: string, // leaf u lancu za chain disambiguation (BUG-G fix)
    sessionISO:     string,
    eventDate:      string,
    mergedAttrs:    Map<string, { def: ExportAttrDef; value: string | number | boolean | null }>,
  ): Promise<void> => {
    if (mergedAttrs.size === 0) return;

    const existingId = await findParentEventByChain(categoryId, sessionISO, leafCategoryId);

    if (existingId) {
      // UPDATE: dohvati postojeće atribute
      const { data: existingAttrRows } = await supabase
        .from('event_attributes')
        .select('id, attribute_definition_id')
        .eq('event_id', existingId);

      const existingAttrs = new Map<string, string>(
        ((existingAttrRows ?? []) as { id: string; attribute_definition_id: string }[])
          .map(ea => [ea.attribute_definition_id, ea.id])
      );

      for (const { def, value } of mergedAttrs.values()) {
        if (value == null || value === '') continue; // P3: prazna ne prepisuje
        const attrData = buildAttrData(existingId, userId, def, value);
        if (existingAttrs.has(def.id)) {
          await supabase
            .from('event_attributes')
            .update(attrData)
            .eq('id', existingAttrs.get(def.id)!)
            .eq('user_id', userId);
        } else {
          await supabase.from('event_attributes').insert(attrData);
        }
      }
    } else {
      // INSERT: parent event ne postoji za ovaj lanac
      const { data: newParent, error: parentErr } = await supabase
        .from('events')
        .insert({
          user_id:       userId,
          category_id:   categoryId,
          event_date:    eventDate,
          session_start: sessionISO,
          comment:       leafCategoryId, // BUG-G fix v2: chain discriminator
          created_at:    sessionISO,
        })
        .select('id')
        .single();

      if (parentErr || !newParent) return;

      const parentId = (newParent as { id: string }).id;
      for (const { def, value } of mergedAttrs.values()) {
        if (value == null || value === '') continue;
        const attrData = buildAttrData(parentId, userId, def, value);
        await supabase.from('event_attributes').insert(attrData);
      }
    }
  };

  // ────── CREATE ──────
  // IMPORT-P2 fix: grupiraj po sessionISO → 1 parent event po sesiji
  //
  // Struktura session grupe:
  //   sessionKey = `${event_date}__${sessionISO}`
  //   → parentMerged: Map<categoryId, Map<defId, {def, value}>>  (P3 merge)
  //   → leafRows: ParsedImportRow[]                              (N leaf evenata)

  interface SessionGroup {
    sessionKey:     string;
    eventDate:      string;
    sessionISO:     string;
    parentMerged:   Map<string, Map<string, { def: ExportAttrDef; value: string | number | boolean | null }>>;
    leafRows:       ParsedImportRow[];
    leafCategoryId: string;
  }

  const sessionGroups = new Map<string, SessionGroup>();

  // Prolaz 1: grupiraj redove po sessionISO, P3-merge parent atribute
  for (const row of toCreate) {
    const hierarchyLevels = getHierarchyLevels(row.category_path, categoriesDict);
    if (hierarchyLevels.length === 0) {
      errors.push(`Row ${row._source_row}: Invalid category path '${row.category_path}'`);
      continue;
    }

    const ssParsed       = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
    const sessionISO     = toISO(row.event_date, ssParsed);
    const leafCategoryId = hierarchyLevels[hierarchyLevels.length - 1].categoryId;
    // Session key = event_date + sessionISO + leafCategoryId
    // Različit leaf = različit lanac = različita aktivnost, čak i uz isti session_start
    const sessionKey = `${row.event_date}__${sessionISO}__${leafCategoryId}`;

    if (!sessionGroups.has(sessionKey)) {
      sessionGroups.set(sessionKey, {
        sessionKey,
        eventDate:      row.event_date,
        sessionISO,
        parentMerged:   new Map(),
        leafRows:       [],
        leafCategoryId,
      });
    }

    const group = sessionGroups.get(sessionKey)!;
    group.leafRows.push(row);

    // P3 merge parent atributa (sve razine osim leaf)
    for (const { categoryId } of hierarchyLevels.slice(0, -1)) {
      if (!group.parentMerged.has(categoryId)) {
        group.parentMerged.set(categoryId, new Map());
      }
      const catMerge = group.parentMerged.get(categoryId)!;

      for (const [attrName, value] of Object.entries(row.attributes)) {
        if (value == null || value === '') continue; // P3: prazna se ignorira
        const def = attrByCatName.get(`${categoryId}||${attrName}`);
        if (!def) continue;
        // P3: zadnja ne-null vrijednost pobjeđuje
        catMerge.set(def.id, { def, value });
      }
    }
  }

  // Prolaz 2: za svaku sesiju INSERT parent eventi (1 po cat), pa leaf eventi (N)
  for (const group of sessionGroups.values()) {
    // ── Collision resolution ────────────────────────────────
    const decision = overwriteDecisions.get(group.sessionKey);
    if (decision === 'skip') {
      const rowNums = group.leafRows.map(r => r._source_row).join(', ');
      warnings.push(`Skipped rows ${rowNums}: session already exists (${group.leafRows[0].category_path} @ ${group.sessionISO}).`);
      continue;
    }
    if (decision === 'replace') {
      // Replace: obriši leaf evente + parent evente koji su exkluzivni za ovaj lanac.
      // BUG-G fix: parent evente (Activity, Gym) treba brisati jer Replace ranije
      // ostavljao stare parent evente → ViewDetailsPage bi pronašao stare (krive) umjesto novih.
      // Brišemo parent evente koji NE SLUŽE drugom leaf lancu na istom session_start.
      const firstRowLevelsForDelete = getHierarchyLevels(group.leafRows[0].category_path, categoriesDict);
      const parentLevelsForDelete   = firstRowLevelsForDelete.slice(0, -1);

      // Obriši leaf evente
      const { data: oldLeafs } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('category_id', group.leafCategoryId)
        .eq('session_start', group.sessionISO);

      if (oldLeafs && oldLeafs.length > 0) {
        const oldIds = (oldLeafs as { id: string }[]).map(e => e.id);
        await supabase.from('event_attributes').delete().in('event_id', oldIds).eq('user_id', userId);
        await supabase.from('event_attachments').delete().in('event_id', oldIds).eq('user_id', userId);
        await supabase.from('events').delete().in('id', oldIds).eq('user_id', userId);
      }

      // Obriši parent evente za ovaj lanac (od leaf prema korijenu)
      // Svaki parent: obriši sve evente (category_id + session_start) koji
      // su ostali od prethodnih importa. Novi će se kreirati u sljedećem koraku.
      // Sigurno je brisati sve jer:
      //   - ako drugi lanac dijeli isti parent, on će ga re-kreirati u svom grupi
      //   - redosljed procesiranja je sekvencijalan (Map iteracija = insertion order)
      for (const { categoryId } of [...parentLevelsForDelete].reverse()) {
        const { data: oldParents } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('category_id', categoryId)
          .eq('session_start', group.sessionISO);
        if (oldParents && oldParents.length > 0) {
          const oldParentIds = (oldParents as { id: string }[]).map(e => e.id);
          await supabase.from('event_attributes').delete().in('event_id', oldParentIds).eq('user_id', userId);
          await supabase.from('events').delete().in('id', oldParentIds).eq('user_id', userId);
        }
      }
    }
    // 'add' i undefined (nema kolizije) → normalan INSERT leaf evenata
    // ────────────────────────────────────────────────────────
    // Parent eventi — UPSERT: provjeri postoji li parent za ovaj lanac,
    // ako postoji UPDATE atribute, ako ne postoji INSERT.
    // Ovo sprečava kreiranje duplikata Activity evenata (npr. kod Overwrite).
    const firstRowLevels = getHierarchyLevels(group.leafRows[0].category_path, categoriesDict);
    const parentLevels = firstRowLevels.slice(0, -1);

    for (let i = 0; i < parentLevels.length; i++) {
      const { categoryId } = parentLevels[i];
      const mergedAttrs = group.parentMerged.get(categoryId);
      if (!mergedAttrs || mergedAttrs.size === 0) continue;

      try {
        // UPSERT: check if parent already exists for this chain+session
        // BUG-G fix: koristimo LEAF (group.leafCategoryId) kao disambiguator,
        // ne immediate child. Leaf je jedini ID koji je garantirano unique
        // po sesiji — intermediate čvorovi (npr. Gym) mogu biti dijeljeni.
        const existingId = await findParentEventByChain(categoryId, group.sessionISO, group.leafCategoryId);

        if (existingId) {
          // UPDATE existing parent attrs (P3: prazna ne prepisuje)
          const { data: existingAttrRows } = await supabase
            .from('event_attributes')
            .select('id, attribute_definition_id')
            .eq('event_id', existingId);

          const existingAttrs = new Map<string, string>(
            ((existingAttrRows ?? []) as { id: string; attribute_definition_id: string }[])
              .map(ea => [ea.attribute_definition_id, ea.id])
          );

          for (const { def, value } of mergedAttrs.values()) {
            if (value == null || value === '') continue;
            const attrData = buildAttrData(existingId, userId, def, value);
            if (existingAttrs.has(def.id)) {
              await supabase.from('event_attributes').update(attrData).eq('id', existingAttrs.get(def.id)!).eq('user_id', userId);
            } else {
              await supabase.from('event_attributes').insert(attrData);
            }
          }
        } else {
          // INSERT new parent event
          const { data: newParent, error: parentErr } = await supabase
            .from('events')
            .insert({
              user_id:       userId,
              category_id:   categoryId,
              event_date:    group.eventDate,
              session_start: group.sessionISO,
              comment:       group.leafCategoryId, // BUG-G fix v2: chain discriminator
              created_at:    group.sessionISO,
            })
            .select('id')
            .single();

          if (parentErr || !newParent) {
            errors.push(`Session ${group.sessionISO} parent insert error – ${parentErr?.message ?? 'unknown'}`);
            continue;
          }

          const parentId = (newParent as { id: string }).id;
          for (const { def, value } of mergedAttrs.values()) {
            if (value == null || value === '') continue;
            const attrData = buildAttrData(parentId, userId, def, value);
            await supabase.from('event_attributes').insert(attrData);
          }
        }
      } catch (err) {
        errors.push(`Session ${group.sessionISO} parent event error – ${String(err)}`);
      }
    }

    // Leaf eventi (1 per row)
    for (const row of group.leafRows) {
      try {
        const ssParsed = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };

        let createdISO: string;
        if (row.created_at) {
          const caParsed = parseTimeStr(row.created_at);
          createdISO = caParsed ? toISO(row.event_date, caParsed) : group.sessionISO;
        } else {
          const caTime = { h: ssParsed.h, m: ssParsed.m, s: ssParsed.s + 1 };
          createdISO = toISO(row.event_date, caTime);
        }

        // Skupi leaf atribute (samo atributi leaf kategorije)
        const leafAttrs: Record<string, ExportAttrDef> = {};
        for (const [attrName, value] of Object.entries(row.attributes)) {
          if (value == null || value === '') continue;
          const def = attrByCatName.get(`${group.leafCategoryId}||${attrName}`);
          if (def) leafAttrs[attrName] = def;
        }

        // INSERT leaf event (uvijek, čak i bez atributa — leaf je entitet sesije)
        const { data: newLeaf, error: leafErr } = await supabase
          .from('events')
          .insert({
            user_id:       userId,
            category_id:   group.leafCategoryId,
            event_date:    row.event_date,
            session_start: group.sessionISO,
            comment:       row.comment || null,
            created_at:    createdISO,
          })
          .select('id')
          .single();

        if (leafErr || !newLeaf) {
          errors.push(`Row ${row._source_row}: Failed to create leaf event – ${leafErr?.message ?? 'unknown'}`);
          continue;
        }

        const leafId = (newLeaf as { id: string }).id;

        for (const [attrName, def] of Object.entries(leafAttrs)) {
          const attrData = buildAttrData(leafId, userId, def, row.attributes[attrName]);
          await supabase.from('event_attributes').insert(attrData);
        }

        created++;
      } catch (err) {
        errors.push(`Row ${row._source_row}: Unexpected error – ${String(err)}`);
      }
    }
  }

  // ────── UPDATE ──────
  // Grupiraj UPDATE redove po sessionISO za parent upsert
  // Leaf event se updatea per row (ima event_id), parent se upserta per sesija

  interface UpdateSessionGroup {
    eventDate:    string;
    sessionISO:   string;
    parentMerged: Map<string, Map<string, { def: ExportAttrDef; value: string | number | boolean | null }>>;
    rows:         ParsedImportRow[];
  }

  const updateGroups = new Map<string, UpdateSessionGroup>();

  for (const row of toUpdate) {
    const ssParsed        = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
    const sessionISO      = toISO(row.event_date, ssParsed);
    const hierarchyLevels = getHierarchyLevels(row.category_path, categoriesDict);
    const leafCategoryId  = hierarchyLevels[hierarchyLevels.length - 1]?.categoryId;
    // Isti session key kao u CREATE — leaf određuje lanac
    const sessionKey = `${row.event_date}__${sessionISO}__${leafCategoryId ?? ''}`;

    if (!updateGroups.has(sessionKey)) {
      updateGroups.set(sessionKey, {
        eventDate:    row.event_date,
        sessionISO,
        parentMerged: new Map(),
        rows:         [],
      });
    }

    const group = updateGroups.get(sessionKey)!;
    group.rows.push(row);

    for (const { categoryId } of hierarchyLevels) {
      if (categoryId === leafCategoryId) continue; // leaf se updatea per row, ne ovdje

      if (!group.parentMerged.has(categoryId)) {
        group.parentMerged.set(categoryId, new Map());
      }
      const catMerge = group.parentMerged.get(categoryId)!;

      for (const [attrName, value] of Object.entries(row.attributes)) {
        if (value == null || value === '') continue;
        const def = attrByCatName.get(`${categoryId}||${attrName}`);
        if (!def) continue;
        catMerge.set(def.id, { def, value });
      }
    }
  }

  // Upsert parent eventi po sesiji (UPDATE tok — koristi chain disambiguation)
  for (const group of updateGroups.values()) {
    // Rekonstruiraj redosljed parent razina iz prvog reda grupe
    const firstRowLevels = getHierarchyLevels(group.rows[0].category_path, categoriesDict);
    // parentLevels = sve osim leaf
    const parentLevels = firstRowLevels.slice(0, -1);

    for (let i = 0; i < parentLevels.length; i++) {
      const { categoryId } = parentLevels[i];
      const mergedAttrs = group.parentMerged.get(categoryId);
      if (!mergedAttrs || mergedAttrs.size === 0) continue;

      try {
        // BUG-G fix: koristimo LEAF kao disambiguator (vidi findParentEventByChain)
        const leafCategoryId = firstRowLevels[firstRowLevels.length - 1].categoryId;
        await upsertParentEventForUpdate(
          categoryId,
          leafCategoryId,
          group.sessionISO,
          group.eventDate,
          mergedAttrs,
        );
      } catch (err) {
        errors.push(`Session ${group.sessionISO} parent update error – ${String(err)}`);
      }
    }
  }

  // Update leaf eventi per row (ima event_id)
  for (const row of toUpdate) {
    try {
      const eventId = row.event_id!;

      // Fetch existing leaf event
      const { data: existing } = await supabase
        .from('events')
        .select('id, category_id, event_attributes(id, attribute_definition_id)')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        errors.push(`Row ${row._source_row}: Event ${eventId} not found`);
        continue;
      }

      const ssParsed   = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
      const sessionISO = toISO(row.event_date, ssParsed);

      let createdISO: string;
      if (row.created_at) {
        const caParsed = parseTimeStr(row.created_at);
        createdISO = caParsed ? toISO(row.event_date, caParsed) : sessionISO;
      } else {
        createdISO = sessionISO;
      }

      // Update leaf event core fields
      await supabase
        .from('events')
        .update({
          event_date:    row.event_date,
          session_start: sessionISO,
          comment:       row.comment || null,
          created_at:    createdISO,
          edited_at:     new Date().toISOString(),
        })
        .eq('id', eventId)
        .eq('user_id', userId);

      // Update leaf atribute (samo atributi leaf kategorije)
      const existingAttrs = new Map<string, string>(
        ((existing as { event_attributes: { id: string; attribute_definition_id: string }[] })
          .event_attributes ?? [])
          .map((ea: { id: string; attribute_definition_id: string }) => [ea.attribute_definition_id, ea.id])
      );

      const existingCatId = (existing as { category_id: string }).category_id;

      for (const [attrName, value] of Object.entries(row.attributes)) {
        const def = attrByCatName.get(`${existingCatId}||${attrName}`);
        if (!def) continue;

        const attrData = buildAttrData(eventId, userId, def, value);

        if (existingAttrs.has(def.id)) {
          await supabase
            .from('event_attributes')
            .update(attrData)
            .eq('id', existingAttrs.get(def.id)!)
            .eq('user_id', userId);
        } else if (value != null && value !== '') {
          await supabase.from('event_attributes').insert(attrData);
        }
      }

      updated++;
    } catch (err) {
      errors.push(`Row ${row._source_row}: Unexpected update error – ${String(err)}`);
    }
  }

  return { created, updated, errors, warnings };
}

/** Build event_attributes insert/update payload */
function buildAttrData(
  eventId: string,
  userId:  string,
  def:     ExportAttrDef,
  value:   string | number | boolean | null | undefined,
): Record<string, unknown> {
  const base = {
    event_id:              eventId,
    attribute_definition_id: def.id,
    user_id:               userId,
    value_text:    null as string | null,
    value_number:  null as number | null,
    value_datetime: null as string | null,
    value_boolean: null as boolean | null,
  };

  if (value == null || value === '') return base;

  switch (def.data_type) {
    case 'number':
      base.value_number  = typeof value === 'number' ? value : parseFloat(String(value));
      break;
    case 'boolean':
      base.value_boolean = typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true';
      break;
    case 'datetime':
      base.value_datetime = String(value);
      break;
    default:
      base.value_text = String(value);
  }

  return base;
}

// ─────────────────────────────────────────────
// Collision detection (CREATE rows vs existing DB)
// ─────────────────────────────────────────────

export interface CollisionInfo {
  /** Isti key koji se koristi u sessionGroups */
  sessionKey:        string;
  sessionISO:        string;
  eventDate:         string;
  /** Human-readable path za prikaz u UI */
  categoryPath:      string;
  /** Redni brojevi Excel redova koji su u koliziji */
  rowNumbers:        number[];
  /** Broj postojećih leaf evenata u bazi za ovu sesiju */
  existingLeafCount: number;
  /** true ako bilo koji od postojećih leaf evenata ima fotografije — Replace će ih obrisati */
  hasPhotos:         boolean;
}

/**
 * Provjeri postoje li u bazi eventi koji se podudaraju s CREATE redovima
 * (isti user + leafCategoryId + session_start).
 * Vraća popis kolizija za prikaz u UI prije primjene importa.
 */
export async function checkImportCollisions(
  userId:         string,
  toCreate:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
): Promise<CollisionInfo[]> {
  if (toCreate.length === 0) return [];

  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[info.full_path] = id;

  // Grupiraj CREATE redove po sessionKey (isti kao u applyImportChanges)
  const sessionMap = new Map<string, {
    sessionISO: string; eventDate: string;
    categoryPath: string; leafCategoryId: string; rowNumbers: number[];
  }>();

  for (const row of toCreate) {
    const leafCategoryId = catByPath[row.category_path];
    if (!leafCategoryId) continue;
    const ssParsed   = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
    const sessionISO = toISO(row.event_date, ssParsed);
    const sessionKey = `${row.event_date}__${sessionISO}__${leafCategoryId}`;

    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        sessionISO,
        eventDate:    row.event_date,
        categoryPath: row.category_path,
        leafCategoryId,
        rowNumbers:   [],
      });
    }
    sessionMap.get(sessionKey)!.rowNumbers.push(row._source_row);
  }

  // Za svaku sesiju provjeri postoji li već u bazi + ima li fotografije
  const collisions: CollisionInfo[] = [];

  for (const [sessionKey, info] of sessionMap) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', info.leafCategoryId)
      .eq('session_start', info.sessionISO);

    if (existing && existing.length > 0) {
      const existingIds = (existing as { id: string }[]).map(e => e.id);

      // Provjeri ima li fotografija na ovim eventima (batch query)
      const { data: photos } = await supabase
        .from('event_attachments')
        .select('id')
        .in('event_id', existingIds)
        .eq('type', 'image')
        .limit(1);

      collisions.push({
        sessionKey,
        sessionISO:        info.sessionISO,
        eventDate:         info.eventDate,
        categoryPath:      info.categoryPath,
        rowNumbers:        info.rowNumbers,
        existingLeafCount: existing.length,
        hasPhotos:         (photos?.length ?? 0) > 0,
      });
    }
  }

  return collisions;
}



export interface ImportResult {
  created:  number;
  updated:  number;
  errors:   string[];
  warnings: string[];
}

export async function importEventsFromExcel(
  userId:             string,
  file:               File,
  overwriteDecisions: Map<string, 'replace' | 'add' | 'skip'> = new Map(),
): Promise<ImportResult> {
  // Step 1: Parse file
  const parsed = await parseExcelFile(file);
  if (parsed.errors.length > 0) {
    return { created: 0, updated: 0, errors: parsed.errors, warnings: parsed.warnings };
  }
  if (parsed.toCreate.length === 0 && parsed.toUpdate.length === 0) {
    return { created: 0, updated: 0, errors: ['No events found in file'], warnings: [] };
  }

  // Step 2: Load categories + attr defs
  const categoriesDict = await loadCategoriesForExport(userId);
  const allCatIds      = Object.keys(categoriesDict);
  const attrDefs       = await loadAttrDefsForCategories(userId, allCatIds, categoriesDict);

  // Step 3: Smart reclassify (invalid event_ids → CREATE)
  const reclassified = await smartReclassify(userId, parsed.toCreate, parsed.toUpdate, categoriesDict);

  // Step 4: Validate
  const { validCreates, validUpdates, errors: validationErrors } = validateImportData(
    reclassified.toCreate,
    reclassified.toUpdate,
    categoriesDict,
  );

  if (validationErrors.length > 0) {
    return {
      created:  0,
      updated:  0,
      errors:   validationErrors,
      warnings: [...parsed.warnings, ...reclassified.warnings],
    };
  }

  // Step 5: Apply (s overwrite odlukama za kolizije)
  const result = await applyImportChanges(userId, validCreates, validUpdates, categoriesDict, attrDefs, overwriteDecisions);

  return {
    created:  result.created,
    updated:  result.updated,
    errors:   result.errors,
    warnings: [...parsed.warnings, ...reclassified.warnings, ...result.warnings],
  };
}
