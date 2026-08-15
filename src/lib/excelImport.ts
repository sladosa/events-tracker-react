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
import { FIXED_COL_COUNT, DELETE_COL_HEADER, DELETE_MARKER } from './excelExport';
import { computeRowFingerprint, ROW_HASH_HEADER } from './excelFingerprint';
import { loadCategoriesForExport, loadAttrDefsForCategories } from './excelDataLoader';
import { upsertParentEvent, type ParentAttrWrite } from './parentEventLoader';
import { fetchAllPagedIn } from './supabasePaging';
import type {
  ExportCategoriesDict,
  ExportAttrDef,
  LegendMapping,
  ParsedImportRow,
  ParseResult,
  ValidationResult,
  ApplyResult,
  ImportOutcome,
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
  // Hyperlink cell: { text: 'email@x.com', hyperlink: 'mailto:...' }
  if (typeof val === 'object' && 'text' in (val as object)) {
    return String((val as { text: unknown }).text).trim();
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

  // Empty legend is valid — category may have no attributes
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

/** Find a trailing marker column by scanning the header row (returns -1 if the file has none). */
function findMarkerCol(ws: ExcelJS.Worksheet, headerRow: number, header: string): number {
  let found = -1;
  ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (found === -1 && colNumber > FIXED_COL_COUNT && cellStr(cell.value) === header) {
      found = colNumber;
    }
  });
  return found;
}

/** One row whose Delete? cell held something other than DELETE or blank. */
export interface BadDeleteValue {
  sourceRow: number;
  value:     string;
}

function parseDataRows(
  ws:            ExcelJS.Worksheet,
  mapping:       LegendMapping,
  headerRow:     number,
  rowHashCol:    number = -1,
  deleteCol:     number = -1,
  badDeleteOut?: BadDeleteValue[],
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
    const rowEmail     = cellStr(row.getCell(7).value) || undefined;  // col G = User/email
    const comment      = cellStr(row.getCell(FIXED_COL_COUNT).value); // col H = leaf comment

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

    const rowHash = rowHashCol > 0 ? (cellStr(row.getCell(rowHashCol).value) || undefined) : undefined;

    // Delete? flag (S107w). Anything other than the marker or an empty cell is
    // collected as an error — a typo must never read as "keep this record".
    let isDelete = false;
    if (deleteCol > 0) {
      const raw = cellStr(row.getCell(deleteCol).value);
      if (raw !== '') {
        if (raw.trim().toUpperCase() === DELETE_MARKER) isDelete = true;
        else badDeleteOut?.push({ sourceRow: rowNumber, value: raw });
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
      _row_email:    rowEmail,
      _row_hash:     rowHash,
      _delete:       isDelete || undefined,
    });
  });

  return rows;
}

// ─────────────────────────────────────────────
// Public: parse Excel file → ParseResult
// ─────────────────────────────────────────────

export async function parseExcelFile(
  file: File,
  currentUserEmail?: string,
  foreignMode: 'skip' | 'import_as_mine' = 'skip',
): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const wb          = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const emptyForeign = { foreignRowCount: 0, foreignEmailsSummary: {} as Record<string, number>, untouchedCount: 0 };
  const emptyLists   = { toCreate: [], toUpdate: [], toDelete: [] };

  // Try Events sheet by name (unified format), fall back to first worksheet
  const ws = wb.getWorksheet('Events') ?? wb.worksheets[0];
  if (!ws) return { ...emptyLists, warnings: [], errors: ['Excel file has no worksheets.'], legendMapping: {}, ...emptyForeign };

  // Detect structure-only stub (file exported from Structure tab, not Activities)
  const stubText = cellStr(ws.getRow(1).getCell(1).value);
  if (stubText.includes('Export initiated from Structure tab')) {
    return {
      ...emptyLists, warnings: [],
      errors: [
        'This file was exported from the Structure tab — it contains no events.\n' +
        'To import structure, use the Structure tab → Import button.\n' +
        'To import activities, export from the Activities tab first.',
      ],
      legendMapping: {},
      ...emptyForeign,
    };
  }

  // Parse legend
  const { mapping, legendEndRow, error: legendError } = parseLegend(ws);
  if (legendError) return { ...emptyLists, warnings: [], errors: [legendError], legendMapping: {}, ...emptyForeign };

  // Find EVENT DATA
  const { headerRow, error: sectionError } = findEventDataSection(ws, legendEndRow);
  if (sectionError) return { ...emptyLists, warnings: [], errors: [sectionError], legendMapping: mapping, ...emptyForeign };

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
    return { ...emptyLists, warnings: [], errors: [msg], legendMapping: mapping, ...emptyForeign };
  }

  // Parse data rows (row_hash col — if present — enables untouched-row skip, S107 D7;
  // Delete? col — if present — flags rows for deletion, S107w. Older exports have
  // neither column and behave exactly as before: nothing is skipped, nothing deleted.)
  const rowHashCol = findMarkerCol(ws, headerRow, ROW_HASH_HEADER);
  const deleteCol  = findMarkerCol(ws, headerRow, DELETE_COL_HEADER);
  const badDeletes: BadDeleteValue[] = [];
  const allRows = parseDataRows(ws, mapping, headerRow, rowHashCol, deleteCol, badDeletes);

  if (badDeletes.length > 0) {
    const msg =
      `❌ Invalid value in the "${DELETE_COL_HEADER}" column.\n\n` +
      `Only ${DELETE_MARKER} (from the dropdown) or an empty cell are accepted.\n\n` +
      badDeletes.slice(0, 20).map(b => `  • Row ${b.sourceRow}: '${b.value}'`).join('\n') +
      (badDeletes.length > 20 ? `\n  … and ${badDeletes.length - 20} more` : '') +
      '\n\nFix or clear those cells and import again. Nothing was imported.';
    return { ...emptyLists, warnings: [], errors: [msg], legendMapping: mapping, ...emptyForeign };
  }

  // Validate time ordering per row: created_at >= session_start
  const warnings: string[] = [];
  let validRows: ParsedImportRow[] = [];

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

  // Classify rows by user email (multi-user support)
  let foreignRowCount = 0;
  const foreignEmailsSummary: Record<string, number> = {};

  if (currentUserEmail) {
    const ownRows: ParsedImportRow[] = [];
    for (const r of validRows) {
      const rowEmail = r._row_email;
      if (rowEmail && rowEmail !== currentUserEmail) {
        // Foreign row — belongs to a different user
        foreignRowCount++;
        foreignEmailsSummary[rowEmail] = (foreignEmailsSummary[rowEmail] ?? 0) + 1;
        if (foreignMode === 'import_as_mine') {
          // Force INSERT with new ID — user_id will be set to currentUserId in apply
          ownRows.push({ ...r, event_id: null });
        }
        // else 'skip': exclude from processing
      } else {
        // Own row (empty col G = owner row per spec)
        ownRows.push(r);
      }
    }
    validRows = ownRows;
  }

  /** Does the row still carry the fingerprint written for it at export? */
  const matchesRowHash = (r: ParsedImportRow): boolean =>
    !!r._row_hash && !!r.event_id && computeRowFingerprint({
      event_id:      r.event_id,
      area:          r.area,
      category_path: r.category_path,
      event_date:    r.event_date,
      session_start: r.session_start,
      created_at:    r.created_at,
      user_email:    r._row_email ?? '',
      comment:       r.comment,
      attributes:    r.attributes,
    }) === r._row_hash;

  // ── Delete rows (S107w) ──────────────────────────────────────────────────
  // Must run BEFORE the untouched-row skip: the fingerprint covers event fields
  // only, so a row that is untouched except for the DELETE flag still matches its
  // row_hash and would otherwise be dropped as "unchanged" — losing the deletion.
  const toDelete: ParsedImportRow[] = [];
  {
    const flagged = validRows.filter(r => r._delete);
    if (flagged.length > 0) {
      // event_ids that another, unflagged row in this same file still refers to
      const keptIds = new Set(
        validRows.filter(r => !r._delete && r.event_id).map(r => r.event_id!),
      );
      const ambiguous: ParsedImportRow[] = [];
      const seenIds = new Set<string>();

      for (const r of flagged) {
        if (!r.event_id) {
          // A new row (no event_id) marked DELETE: nothing exists to delete, and
          // the row must certainly not be created either.
          warnings.push(
            `Row ${r._source_row} is marked ${DELETE_MARKER} but has no event_id — ` +
            `there is no saved record to delete, so the row was ignored (and not created).`,
          );
          continue;
        }
        if (keptIds.has(r.event_id)) { ambiguous.push(r); continue; }
        if (seenIds.has(r.event_id)) continue;  // same record flagged on two rows
        seenIds.add(r.event_id);
        toDelete.push(r);
      }

      if (ambiguous.length > 0) {
        const msg =
          `❌ Cannot import: a row marked ${DELETE_MARKER} shares its event_id with a row that is not marked.\n\n` +
          'That happens after copying a row in Excel — the copy carries the original\'s event_id, ' +
          'so deleting it would remove the record the other row refers to.\n\n' +
          ambiguous.map(r => `  • Row ${r._source_row} (event_id ${r.event_id!.slice(0, 8)}…)`).join('\n') +
          '\n\nFix: clear column A (event_id) on the copy, or un-mark it. Nothing was imported.';
        return { ...emptyLists, warnings, errors: [msg], legendMapping: mapping, ...emptyForeign };
      }

      validRows = validRows.filter(r => !r._delete);
    }
  }

  // ── Copied rows: same event_id more than once in the file ────────────────
  // Adding a transaction by copying an existing row is the natural thing to do
  // in Excel, and the copy carries the original's `event_id` AND `row_hash`.
  // Without this, the copy is classified as an UPDATE of the row it was copied
  // from: the original transaction is overwritten with the copy's values and no
  // new event is created — one record silently destroyed, one never added.
  //
  // One event cannot legitimately be two rows, so a repeated event_id means a
  // copy. Exactly one row keeps the id: the one still matching its row_hash
  // (the untouched original). If none match — both were edited — the first
  // occurrence keeps it. Everything else becomes a CREATE, which is the
  // non-destructive reading and what the user meant by copying the row.
  const rowsById = new Map<string, ParsedImportRow[]>();
  for (const r of validRows) {
    if (!r.event_id) continue;
    const list = rowsById.get(r.event_id) ?? [];
    list.push(r);
    rowsById.set(r.event_id, list);
  }

  const forcedCreates = new Set<ParsedImportRow>();
  for (const [eventId, rows] of rowsById) {
    if (rows.length < 2) continue;
    const keeper = rows.find(r => r._row_hash && matchesRowHash(r)) ?? rows[0];
    for (const r of rows) {
      if (r === keeper) continue;
      forcedCreates.add(r);
    }
    warnings.push(
      `event_id ${eventId.slice(0, 8)}… appears on ${rows.length} rows ` +
      `(${rows.map(r => r._source_row).join(', ')}) — looks like a copied row. ` +
      `Row ${keeper._source_row} updates the existing record; the other ` +
      `${rows.length - 1} will be created as new activities.`,
    );
  }

  if (forcedCreates.size > 0) {
    validRows = validRows.map(r => (forcedCreates.has(r) ? { ...r, event_id: null } : r));
  }

  const toCreate = validRows.filter(r => !r.event_id);

  // S107 D7: untouched-row skip — UPDATE row whose recomputed fingerprint matches the
  // row_hash written at export was NOT touched in Excel → drop it here entirely.
  // No DB read, no write; also guarantees a stale export can never revert changes
  // made in the app after the export. Only rows WITH event_id qualify (CREATE rows
  // must never be skipped by hash).
  let untouchedCount = 0;
  const toUpdate: ParsedImportRow[] = [];
  for (const r of validRows) {
    if (!r.event_id) continue;
    if (matchesRowHash(r)) {
      untouchedCount++;
      continue;
    }
    toUpdate.push(r);
  }

  return { toCreate, toUpdate, toDelete, warnings, errors: [], legendMapping: mapping, foreignRowCount, foreignEmailsSummary, untouchedCount };
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
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[`${info.area_name}||${info.full_path}`] = id;

  const eventIds = toUpdate.map(r => r.event_id!).filter(Boolean);

  // Chunk to avoid URL length limits in PostgREST (large exports have thousands of IDs)
  const RECLASSIFY_CHUNK = 200;
  const allExisting: Array<{ id: string; category_id: string }> = [];
  for (let i = 0; i < eventIds.length; i += RECLASSIFY_CHUNK) {
    const chunk = eventIds.slice(i, i + RECLASSIFY_CHUNK);
    const { data } = await supabase
      .from('events')
      .select('id, category_id')
      .in('id', chunk)
      .eq('user_id', userId);
    if (data) allExisting.push(...(data as { id: string; category_id: string }[]));
  }

  const existingMap = new Map<string, string>(
    allExisting.map(e => [e.id, e.category_id])
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
    const expectedCatId  = catByPath[`${row.area}||${row.category_path}`] ?? null;

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
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[`${info.area_name}||${info.full_path}`] = id;

  const validCreates: ParsedImportRow[] = [];
  const validUpdates: ParsedImportRow[] = [];

  for (const row of toCreate) {
    const rowErrors: string[] = [];
    if (!row.event_date)    rowErrors.push(`Row ${row._source_row}: event_date is required`);
    if (!row.category_path) rowErrors.push(`Row ${row._source_row}: Category_Path is required`);
    else if (!catByPath[`${row.area}||${row.category_path}`]) rowErrors.push(`Row ${row._source_row}: Category_Path '${row.category_path}' not found in area '${row.area}'`);

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
  areaName?:      string,
): Array<{ partialPath: string; categoryId: string }> {
  const pathToId: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) {
    pathToId[`${info.area_name}||${info.full_path}`] = id;
    if (!areaName) pathToId[info.full_path] = id;
  }

  const parts = categoryPath.split(' > ').map(p => p.trim());
  const result: Array<{ partialPath: string; categoryId: string }> = [];

  for (let i = 1; i <= parts.length; i++) {
    const partial = parts.slice(0, i).join(' > ');
    const key     = areaName ? `${areaName}||${partial}` : partial;
    const catId   = pathToId[key];
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
  /** Q4 (S104, Fable): row-level progress callback — velikih importi (Diary 7000+
   *  redaka) inače izgledaju "frozen" bez ikakve povratne informacije. */
  onProgress?:         (done: number, total: number) => void,
): Promise<ApplyResult> {
  // Local mutable copies so BUG-F fix can reclassify rows
  let toCreate = _toCreate; // eslint-disable-line prefer-const
  let toUpdate = _toUpdate; // eslint-disable-line prefer-const

  let created  = 0;
  let updated  = 0;
  let skipped  = 0;
  const errors:   string[] = [];
  const warnings: string[] = [];
  // S107w: what happened to each row, so the post-import report can re-export
  // exactly the touched records (and only those)
  const outcomes: ImportOutcome[] = [];

  // Build (category_id, attr_name) → attr_def lookup
  const attrByCatName = new Map<string, ExportAttrDef>();
  for (const def of attrDefs) {
    attrByCatName.set(`${def.category_id}||${def.name}`, def);
  }

  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[`${info.area_name}||${info.full_path}`] = id;

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
      const levels         = getHierarchyLevels(row.category_path, categoriesDict, row.area);
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

  // Q4: row-level progress tracking (leaf rows = 1:1 s Excel redovima)
  const totalRows = toCreate.length + toUpdate.length;
  let processedRows = 0;
  const reportProgress = () => {
    processedRows++;
    onProgress?.(processedRows, totalRows);
  };

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
  // NOTE (S104): findParentEventByChain + upsertParentEventForUpdate su ekstrahirani
  // u src/lib/parentEventLoader.ts kao findParentEventByChain() + upsertParentEvent()
  // — shared service koji koriste i Add/Edit Activity. Vidi docs/FABLE_PLAN.md I.2.
  const mergedAttrsToWrites = (
    mergedAttrs: Map<string, { def: ExportAttrDef; value: string | number | boolean | null }>
  ): ParentAttrWrite[] =>
    Array.from(mergedAttrs.values()).map(({ def, value }) => ({
      definitionId: def.id,
      value,
      dataType: def.data_type,
    }));

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
    const hierarchyLevels = getHierarchyLevels(row.category_path, categoriesDict, row.area);
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
      const firstRowLevelsForDelete = getHierarchyLevels(group.leafRows[0].category_path, categoriesDict, group.leafRows[0].area);
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
      // T-BUGG-5 fix: brisati SAMO parent evente koji PRIPADAJU OVOM LANCU.
      // Stariji kod je brisao SVE parent evente za (categoryId + session_start),
      // uključujući i tuđe lance — npr. Replace za Cardio je brisao
      // Activity parent Strength lanca i obratno.
      // Rješenje: filtrirati po comment = leafCategoryId (chain marker iz BUG-G fix v2).
      for (const { categoryId } of [...parentLevelsForDelete].reverse()) {
        // Brišemo samo parent evente označene za ovaj lanac (comment = leafCategoryId).
        const { data: markedParents } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('category_id', categoryId)
          .eq('session_start', group.sessionISO)
          .eq('chain_key', group.leafCategoryId); // ← T-BUGG-5 fix: chain-specific delete

        if (markedParents && markedParents.length > 0) {
          const ids = (markedParents as { id: string }[]).map(e => e.id);
          await supabase.from('event_attributes').delete().in('event_id', ids).eq('user_id', userId);
          await supabase.from('events').delete().in('id', ids).eq('user_id', userId);
        }
      }
    }
    // 'add' i undefined (nema kolizije) → normalan INSERT leaf evenata
    // ────────────────────────────────────────────────────────
    // Parent eventi — UPSERT: provjeri postoji li parent za ovaj lanac,
    // ako postoji UPDATE atribute, ako ne postoji INSERT.
    // Ovo sprečava kreiranje duplikata Activity evenata (npr. kod Overwrite).
    const firstRowLevels = getHierarchyLevels(group.leafRows[0].category_path, categoriesDict, group.leafRows[0].area);
    const parentLevels = firstRowLevels.slice(0, -1);

    for (let i = 0; i < parentLevels.length; i++) {
      const { categoryId } = parentLevels[i];
      const mergedAttrs = group.parentMerged.get(categoryId) ?? new Map();

      try {
        // Upsert (shared service — S104 unifikacija): P2 anchor uvijek postoji
        // (čak i s 0 atributa), P3-safe per-attribute merge.
        // BUG-G fix: koristimo LEAF (group.leafCategoryId) kao disambiguator,
        // ne immediate child. Leaf je jedini ID koji je garantirano unique
        // po sesiji — intermediate čvorovi (npr. Gym) mogu biti dijeljeni.
        await upsertParentEvent(
          categoryId,
          group.leafCategoryId,
          group.sessionISO,
          group.eventDate,
          userId,
          mergedAttrsToWrites(mergedAttrs)
        );
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
          if (value == null || value === '' || value === '_') continue; // '_' on new event = skip (same as empty)
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

        // Q3 (S104, Fable): batch svih atributa jedne sesije u 1 INSERT umjesto
        // N sekvencijalnih poziva — kritično za Diary import (7000 redaka × ~10 atributa).
        const leafAttrRecords = Object.entries(leafAttrs).map(([attrName, def]) =>
          buildAttrData(leafId, userId, def, row.attributes[attrName])
        );
        if (leafAttrRecords.length > 0) {
          const { error: leafAttrErr } = await supabase.from('event_attributes').insert(leafAttrRecords);
          if (leafAttrErr) {
            errors.push(`Row ${row._source_row}: Failed to insert attributes – ${leafAttrErr.message}`);
          }
        }

        created++;
        outcomes.push({ eventId: leafId, sourceRow: row._source_row, result: 'Created', changed: [] });
      } catch (err) {
        errors.push(`Row ${row._source_row}: Unexpected error – ${String(err)}`);
      } finally {
        reportProgress();
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
    const hierarchyLevels = getHierarchyLevels(row.category_path, categoriesDict, row.area);
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
    const firstRowLevels = getHierarchyLevels(group.rows[0].category_path, categoriesDict, group.rows[0].area);
    // parentLevels = sve osim leaf
    const parentLevels = firstRowLevels.slice(0, -1);

    for (let i = 0; i < parentLevels.length; i++) {
      const { categoryId } = parentLevels[i];
      const mergedAttrs = group.parentMerged.get(categoryId) ?? new Map();

      try {
        // BUG-G fix: koristimo LEAF kao disambiguator (vidi findParentEventByChain)
        const leafCategoryId = firstRowLevels[firstRowLevels.length - 1].categoryId;
        await upsertParentEvent(
          categoryId,
          leafCategoryId,
          group.sessionISO,
          group.eventDate,
          userId,
          mergedAttrsToWrites(mergedAttrs)
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

      // Fetch existing leaf event (with full fields for diff check)
      const { data: existing } = await supabase
        .from('events')
        .select('id, category_id, event_date, session_start, comment, event_attributes(id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean)')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (!existing) {
        errors.push(`Row ${row._source_row}: Event ${eventId} not found`);
        continue;
      }

      // Diff check: if nothing changed, skip (don't update, count as skipped).
      // The field list doubles as the report's "Changed" column (S107w).
      const existingCatId = (existing as { category_id: string }).category_id;
      const rowChanges    = computeRowDiff(existing as ExistingLeafEvent, row, attrByCatName, existingCatId);
      if (rowChanges.length === 0) {
        skipped++;
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

      // Q3 (S104, Fable): batch novi atributi u 1 INSERT; postojeći se i dalje
      // update-aju pojedinačno (različiti WHERE targeti, nema shared upsert ključa).
      const attrsToInsert: Record<string, unknown>[] = [];
      for (const [attrName, value] of Object.entries(row.attributes)) {
        const def = attrByCatName.get(`${existingCatId}||${attrName}`);
        if (!def) continue;

        const isClear = value === '_'; // sentinel: explicit clear of existing value
        if (!isClear && (value == null || value === '')) continue; // P3: prazna ne prepisuje

        const attrData = buildAttrData(eventId, userId, def, value); // returns all-null for '_'
        if (existingAttrs.has(def.id)) {
          await supabase
            .from('event_attributes')
            .update(attrData)
            .eq('id', existingAttrs.get(def.id)!)
            .eq('user_id', userId);
        } else if (!isClear) {
          attrsToInsert.push(attrData);
        }
      }
      if (attrsToInsert.length > 0) {
        await supabase.from('event_attributes').insert(attrsToInsert);
      }

      updated++;
      outcomes.push({
        eventId:   eventId,
        sourceRow: row._source_row,
        result:    'Updated',
        changed:   rowChanges.map(c => c.field),
      });
    } catch (err) {
      errors.push(`Row ${row._source_row}: Unexpected update error – ${String(err)}`);
    } finally {
      reportProgress();
    }
  }

  return { created, updated, skipped, errors, warnings, outcomes };
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

  if (value == null || value === '' || value === '_') return base;

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
// Diff helper for UPDATE path (skipped vs updated)
// ─────────────────────────────────────────────

interface ExistingLeafEvent {
  event_date:       string;
  session_start:    string | null;
  comment:          string | null;
  event_attributes: Array<{
    attribute_definition_id: string;
    value_text:    string | null;
    value_number:  number | null;
    value_datetime: string | null;
    value_boolean: boolean | null;
  }>;
}

/** One field-level change of an UPDATE row (used by the update-guard preview, S107 D7). */
export interface UpdateFieldChange {
  field:    string;
  oldValue: string;
  newValue: string;
}

/** Human-readable value of an existing event_attributes record (first non-null slot). */
function existingAttrDisplay(ea: ExistingLeafEvent['event_attributes'][number]): string {
  if (ea.value_number   != null) return String(ea.value_number);
  if (ea.value_boolean  != null) return String(ea.value_boolean);
  if (ea.value_datetime != null) return ea.value_datetime;
  if (ea.value_text     != null) return ea.value_text;
  return '(empty)';
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Field-level diff of an import row vs the existing DB event.
 * P3: empty xlsx value → "no change". Returns [] when nothing changed.
 * Single source of truth for the apply path (change? → what changed, for the
 * report's Changed column) and analyzeUpdates() (update-guard preview).
 */
function computeRowDiff(
  existing:      ExistingLeafEvent,
  row:           ParsedImportRow,
  attrByCatName: Map<string, ExportAttrDef>,
  categoryId:    string,
): UpdateFieldChange[] {
  const changes: UpdateFieldChange[] = [];

  // event_date
  if (existing.event_date !== row.event_date) {
    changes.push({ field: 'event_date', oldValue: existing.event_date, newValue: row.event_date });
  }

  // session_start: existing is full ISO, row.session_start is HH:MM or HH:MM:SS
  if (existing.session_start) {
    const d = new Date(existing.session_start);
    const parsed = parseTimeStr(row.session_start);
    if (parsed && (d.getHours() !== parsed.h || d.getMinutes() !== parsed.m)) {
      changes.push({
        field:    'session_start',
        oldValue: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
        newValue: `${pad2(parsed.h)}:${pad2(parsed.m)}`,
      });
    }
  }

  // comment: null and '' are equivalent
  const existingComment = existing.comment ?? '';
  const rowComment      = row.comment ?? '';
  if (existingComment !== rowComment) {
    changes.push({ field: 'comment', oldValue: existingComment || '(empty)', newValue: rowComment || '(empty)' });
  }

  // attributes
  const existingAttrMap = new Map(
    existing.event_attributes.map(ea => [ea.attribute_definition_id, ea]),
  );

  for (const [attrName, importValue] of Object.entries(row.attributes)) {
    const def = attrByCatName.get(`${categoryId}||${attrName}`);
    if (!def) continue;

    // '_' sentinel: explicit intent to clear an existing value
    if (importValue === '_') {
      const existingAttr = existingAttrMap.get(def.id);
      if (existingAttr && (existingAttr.value_text != null || existingAttr.value_number != null || existingAttr.value_datetime != null || existingAttr.value_boolean != null)) {
        changes.push({ field: attrName, oldValue: existingAttrDisplay(existingAttr), newValue: '(cleared)' });
      }
      continue;
    }

    // P3: empty xlsx value → skip (don't change, don't count)
    if (importValue == null || importValue === '') continue;

    const existingAttr = existingAttrMap.get(def.id);
    if (!existingAttr) {
      changes.push({ field: attrName, oldValue: '(empty)', newValue: String(importValue) });
      continue;
    }

    switch (def.data_type) {
      case 'number': {
        const n = typeof importValue === 'number' ? importValue : parseFloat(String(importValue));
        if (existingAttr.value_number !== n) {
          changes.push({ field: attrName, oldValue: existingAttrDisplay(existingAttr), newValue: String(n) });
        }
        break;
      }
      case 'boolean': {
        const b = typeof importValue === 'boolean' ? importValue : String(importValue).toLowerCase() === 'true';
        if (existingAttr.value_boolean !== b) {
          changes.push({ field: attrName, oldValue: existingAttrDisplay(existingAttr), newValue: String(b) });
        }
        break;
      }
      case 'datetime': {
        if (existingAttr.value_datetime !== String(importValue)) {
          changes.push({ field: attrName, oldValue: existingAttrDisplay(existingAttr), newValue: String(importValue) });
        }
        break;
      }
      default: {
        if (existingAttr.value_text !== String(importValue)) {
          changes.push({ field: attrName, oldValue: existingAttrDisplay(existingAttr), newValue: String(importValue) });
        }
        break;
      }
    }
  }

  return changes;
}

// ─────────────────────────────────────────────
// Update-guard dry-run analysis (S107 D7)
// ─────────────────────────────────────────────

export interface UpdatePreview {
  eventId:           string;
  sourceRow:         number;
  /** New (Excel) values, for display */
  eventDate:         string;
  sessionStart:      string;   // HH:MM from Excel row
  categoryPath:      string;
  /** Existing DB event_date — old-record warnings key off this */
  existingEventDate: string;
  changes:           UpdateFieldChange[];
}

export interface UpdateAnalysis {
  /** Rows that WILL modify an existing event, with field-level old→new diff */
  updates:        UpdatePreview[];
  /** Rows identical to DB state (will be counted as skipped at apply) */
  unchangedCount: number;
  /** event_id not found / category mismatch — smartReclassify turns these into CREATE at apply */
  invalidIdCount: number;
}

/**
 * Dry-run diff of all UPDATE rows vs current DB state, WITHOUT writing anything.
 * Powers the update-guard confirmation step in ExcelImportModal: the user sees
 * exactly which existing events would change (old → new per field) before Apply.
 */
export async function analyzeUpdates(
  userId:         string,
  toUpdate:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
  attrDefs:       ExportAttrDef[],
): Promise<UpdateAnalysis> {
  if (toUpdate.length === 0) return { updates: [], unchangedCount: 0, invalidIdCount: 0 };

  const attrByCatName = new Map<string, ExportAttrDef>();
  for (const def of attrDefs) attrByCatName.set(`${def.category_id}||${def.name}`, def);

  const catByPath: Record<string, string> = {};
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[`${info.area_name}||${info.full_path}`] = id;

  type ExistingRow = ExistingLeafEvent & { id: string; category_id: string };

  // Batch fetch existing events (same fields as the apply path's per-row fetch)
  const eventIds = toUpdate.map(r => r.event_id!).filter(Boolean);
  const CHUNK = 200;
  const existingById = new Map<string, ExistingRow>();
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('events')
      .select('id, category_id, event_date, session_start, comment, event_attributes(id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean)')
      .in('id', chunk)
      .eq('user_id', userId);
    if (error) throw new Error(`Update analysis failed: ${error.message}`);
    for (const e of (data ?? []) as ExistingRow[]) existingById.set(e.id, e);
  }

  const updates: UpdatePreview[] = [];
  let unchangedCount = 0;
  let invalidIdCount = 0;

  for (const row of toUpdate) {
    const existing = existingById.get(row.event_id!);
    if (!existing) { invalidIdCount++; continue; }

    const expectedCatId = catByPath[`${row.area}||${row.category_path}`] ?? null;
    if (existing.category_id !== expectedCatId) { invalidIdCount++; continue; }

    const changes = computeRowDiff(existing, row, attrByCatName, existing.category_id);
    if (changes.length === 0) { unchangedCount++; continue; }

    const ssParsed = parseTimeStr(row.session_start) ?? { h: 9, m: 0, s: 0 };
    updates.push({
      eventId:           row.event_id!,
      sourceRow:         row._source_row,
      eventDate:         row.event_date,
      sessionStart:      `${pad2(ssParsed.h)}:${pad2(ssParsed.m)}`,
      categoryPath:      row.category_path,
      existingEventDate: existing.event_date,
      changes,
    });
  }

  return { updates, unchangedCount, invalidIdCount };
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
  for (const [id, info] of Object.entries(categoriesDict)) catByPath[`${info.area_name}||${info.full_path}`] = id;

  // Grupiraj CREATE redove po sessionKey (isti kao u applyImportChanges)
  const sessionMap = new Map<string, {
    sessionISO: string; eventDate: string;
    categoryPath: string; leafCategoryId: string; rowNumbers: number[];
  }>();

  for (const row of toCreate) {
    const leafCategoryId = catByPath[`${row.area}||${row.category_path}`];
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



// ─────────────────────────────────────────────
// Delete flow (S107w — Delete? column)
// ─────────────────────────────────────────────

/** One record that the Delete? column marks for removal, as it exists in the DB now. */
export interface DeletePreview {
  eventId:      string;
  sourceRow:    number;
  eventDate:    string;
  sessionStart: string;   // HH:MM (from the DB value, not the Excel cell)
  categoryPath: string;
  comment:      string;
  attrCount:    number;
  photoCount:   number;
  /** Last remaining record of its session → the session's parent events go too */
  lastOfSession: boolean;
  /** Raw DB values — the parent-chain cleanup keys off these, no re-derivation */
  categoryId:   string;
  sessionISO:   string;
}

export interface DeleteAnalysis {
  deletes: DeletePreview[];
  /** Flagged event_ids that are not in the database (already deleted, or not ours) */
  notFoundCount: number;
}

type DeleteTargetRow = { id: string; category_id: string; event_date: string; session_start: string | null; comment: string | null };

/** Fetch the DB rows behind a set of delete-flagged Excel rows (chunked by URL length). */
async function fetchDeleteTargets(userId: string, eventIds: string[]): Promise<Map<string, DeleteTargetRow>> {
  const byId = new Map<string, DeleteTargetRow>();
  const CHUNK = 200;
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('events')
      .select('id, category_id, event_date, session_start, comment')
      .in('id', chunk)
      .eq('user_id', userId);
    if (error) throw new Error(`Delete analysis failed: ${error.message}`);
    for (const e of (data ?? []) as DeleteTargetRow[]) byId.set(e.id, e);
  }
  return byId;
}

/**
 * Dry run of the Delete? column: what disappears, WITHOUT touching anything.
 * Powers the delete guard in ExcelImportModal — deletion is irreversible, so it
 * gets its own list and its own confirmation, separate from the update guard.
 */
export async function analyzeDeletes(
  userId:         string,
  toDelete:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
): Promise<DeleteAnalysis> {
  if (toDelete.length === 0) return { deletes: [], notFoundCount: 0 };

  const eventIds = toDelete.map(r => r.event_id!).filter(Boolean);
  const byId     = await fetchDeleteTargets(userId, eventIds);

  const foundIds = [...byId.keys()];

  // Attribute + photo counts, so the user sees the weight of what they are removing
  const { data: attrRows, error: attrErr } = await fetchAllPagedIn<{ event_id: string }>(
    foundIds,
    (chunk, from, to) => supabase.from('event_attributes').select('event_id').in('event_id', chunk).order('id').range(from, to),
  );
  if (attrErr) throw new Error(`Delete analysis failed: ${String(attrErr)}`);

  const { data: photoRows, error: photoErr } = await fetchAllPagedIn<{ event_id: string }>(
    foundIds,
    (chunk, from, to) => supabase.from('event_attachments').select('event_id').in('event_id', chunk).order('id').range(from, to),
  );
  if (photoErr) throw new Error(`Delete analysis failed: ${String(photoErr)}`);

  const attrCounts  = new Map<string, number>();
  for (const a of attrRows)  attrCounts.set(a.event_id, (attrCounts.get(a.event_id) ?? 0) + 1);
  const photoCounts = new Map<string, number>();
  for (const p of photoRows) photoCounts.set(p.event_id, (photoCounts.get(p.event_id) ?? 0) + 1);

  // Per session (category_id + session_start): is every record of that session being deleted?
  // Only then does the parent chain fall — P2 says the parents belong to the whole
  // session, not to one leaf record.
  const sessionKeys = new Map<string, { categoryId: string; sessionStart: string; deletingIds: Set<string> }>();
  for (const id of foundIds) {
    const ev  = byId.get(id)!;
    const key = `${ev.category_id}__${ev.session_start ?? ''}`;
    if (!sessionKeys.has(key)) {
      sessionKeys.set(key, { categoryId: ev.category_id, sessionStart: ev.session_start ?? '', deletingIds: new Set() });
    }
    sessionKeys.get(key)!.deletingIds.add(id);
  }

  const lastOfSessionKeys = new Set<string>();
  for (const [key, info] of sessionKeys) {
    if (!info.sessionStart) continue;
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', info.categoryId)
      .eq('session_start', info.sessionStart);
    const existing = (data ?? []) as { id: string }[];
    if (existing.length > 0 && existing.every(e => info.deletingIds.has(e.id))) {
      lastOfSessionKeys.add(key);
    }
  }

  const deletes: DeletePreview[] = [];
  let notFoundCount = 0;

  for (const row of toDelete) {
    const ev = byId.get(row.event_id!);
    if (!ev) { notFoundCount++; continue; }

    const ssDate = ev.session_start ? new Date(ev.session_start) : null;
    deletes.push({
      eventId:      ev.id,
      sourceRow:    row._source_row,
      eventDate:    ev.event_date,
      sessionStart: ssDate ? `${pad2(ssDate.getHours())}:${pad2(ssDate.getMinutes())}` : '',
      categoryPath: categoriesDict[ev.category_id]?.full_path ?? row.category_path,
      comment:      ev.comment ?? '',
      attrCount:    attrCounts.get(ev.id) ?? 0,
      photoCount:   photoCounts.get(ev.id) ?? 0,
      lastOfSession: lastOfSessionKeys.has(`${ev.category_id}__${ev.session_start ?? ''}`),
      categoryId:   ev.category_id,
      sessionISO:   ev.session_start ?? '',
    });
  }

  return { deletes, notFoundCount };
}

export interface DeleteResult {
  deleted:        number;
  parentsDeleted: number;
  errors:         string[];
  warnings:       string[];
  /** Snapshot of what was removed — the report lists it, since it can no longer be exported */
  removed:        DeletePreview[];
}

/**
 * Execute the deletions flagged in the Delete? column.
 *
 * Deletes the flagged leaf records only, then drops the session's parent events
 * (chain_key = leaf category) once the last record of that session is gone —
 * same rule as AppHome.handleDeleteActivity (S104, Fable I.1). Deleting parents
 * earlier would break the chain for the records still there.
 */
export async function applyDeletes(
  userId:         string,
  toDelete:       ParsedImportRow[],
  categoriesDict: ExportCategoriesDict,
): Promise<DeleteResult> {
  const errors:   string[] = [];
  const warnings: string[] = [];
  if (toDelete.length === 0) return { deleted: 0, parentsDeleted: 0, errors, warnings, removed: [] };

  // Snapshot first: after the delete there is nothing left to describe
  const analysis = await analyzeDeletes(userId, toDelete, categoriesDict);
  if (analysis.notFoundCount > 0) {
    warnings.push(
      `${analysis.notFoundCount} row(s) marked ${DELETE_MARKER} no longer exist in the database — nothing to delete for them.`,
    );
  }
  const targetIds = analysis.deletes.map(d => d.eventId);
  if (targetIds.length === 0) return { deleted: 0, parentsDeleted: 0, errors, warnings, removed: [] };

  const ID_CHUNK = 100;
  const chunks = <T,>(arr: T[]): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += ID_CHUNK) out.push(arr.slice(i, i + ID_CHUNK));
    return out;
  };

  /** Delete an event set: storage files, attachments, attributes, then the events. */
  const deleteEvents = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;

    // Storage files behind the attachments (paged — a truncated read leaves orphan files)
    const { data: attachments, error: attErr } = await fetchAllPagedIn<{ url: string }>(
      ids,
      (chunk, from, to) => supabase.from('event_attachments').select('url').in('event_id', chunk).order('id').range(from, to),
    );
    if (attErr) {
      warnings.push(`Could not list attachments before deleting (files may stay in storage): ${String(attErr)}`);
    } else if (attachments.length > 0) {
      const paths = attachments
        .map(a => { const parts = a.url.split('/activity-attachments/'); return parts.length > 1 ? parts[1] : null; })
        .filter((p): p is string => p !== null);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from('activity-attachments').remove(paths);
        if (storageError) warnings.push(`Some attachment files could not be removed from storage: ${storageError.message}`);
      }
    }

    for (const chunk of chunks(ids)) {
      const { error: e1 } = await supabase.from('event_attachments').delete().in('event_id', chunk);
      if (e1) { errors.push(`Failed to delete attachments: ${e1.message}`); return 0; }
      const { error: e2 } = await supabase.from('event_attributes').delete().in('event_id', chunk);
      if (e2) { errors.push(`Failed to delete attribute values: ${e2.message}`); return 0; }
    }

    let removed = 0;
    for (const chunk of chunks(ids)) {
      // .select() so an RLS-blocked delete shows up as 0 rows instead of silent success (S107v)
      const { data, error } = await supabase
        .from('events').delete().in('id', chunk).eq('user_id', userId).select('id');
      if (error) { errors.push(`Failed to delete events: ${error.message}`); return removed; }
      removed += (data ?? []).length;
    }
    return removed;
  };

  const deleted = await deleteEvents(targetIds);
  if (errors.length > 0) return { deleted, parentsDeleted: 0, errors, warnings, removed: analysis.deletes };

  if (deleted < targetIds.length) {
    warnings.push(
      `${targetIds.length - deleted} record(s) were not deleted — the database refused them ` +
      `(you may not be the owner). Everything else was deleted.`,
    );
  }

  // Parent chain: only for the sessions whose last record just went.
  // Keys come straight from the DB rows read before the delete — no re-derivation
  // from Excel values, so a mismatch in date/time formatting cannot orphan a chain.
  let parentsDeleted = 0;
  const emptiedSessions = new Map<string, { leafCategoryId: string; sessionISO: string }>();
  for (const d of analysis.deletes) {
    if (!d.lastOfSession || !d.sessionISO) continue;
    emptiedSessions.set(`${d.categoryId}__${d.sessionISO}`, { leafCategoryId: d.categoryId, sessionISO: d.sessionISO });
  }

  for (const { leafCategoryId, sessionISO } of emptiedSessions.values()) {
    const { data: parents, error } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('chain_key', leafCategoryId)
      .eq('session_start', sessionISO);
    if (error) { warnings.push(`Could not clean up parent records for one session: ${error.message}`); continue; }

    const parentIds = (parents ?? []).map(p => (p as { id: string }).id);
    if (parentIds.length === 0) continue;
    parentsDeleted += await deleteEvents(parentIds);
  }

  return { deleted, parentsDeleted, errors, warnings, removed: analysis.deletes };
}

export interface ImportResult {
  created:  number;
  updated:  number;
  skipped:  number;
  /** S107w */
  deleted:  number;
  errors:   string[];
  warnings: string[];
  /** S107w: per-event result, feeds the auto-downloaded import report */
  outcomes: ImportOutcome[];
  /** S107w: what the Delete? column removed (cannot be re-exported) */
  removed:  DeletePreview[];
}

export async function importEventsFromExcel(
  userId:             string,
  file:               File,
  overwriteDecisions: Map<string, 'replace' | 'add' | 'skip'> = new Map(),
  currentUserEmail?:  string,
  foreignMode:        'skip' | 'import_as_mine' = 'skip',
  onProgress?:        (done: number, total: number) => void,
): Promise<ImportResult> {
  const empty = { created: 0, updated: 0, skipped: 0, deleted: 0, outcomes: [] as ImportOutcome[], removed: [] as DeletePreview[] };

  // Step 1: Parse file
  const parsed = await parseExcelFile(file, currentUserEmail, foreignMode);
  if (parsed.errors.length > 0) {
    return { ...empty, errors: parsed.errors, warnings: parsed.warnings };
  }
  if (parsed.toCreate.length === 0 && parsed.toUpdate.length === 0 && parsed.toDelete.length === 0) {
    // S107 D7: a file where every row matched its row_hash is a valid no-op, not an error
    if (parsed.untouchedCount > 0) {
      return { ...empty, skipped: parsed.untouchedCount, errors: [], warnings: parsed.warnings };
    }
    return { ...empty, errors: ['No events found in file'], warnings: [] };
  }

  // Step 2: Load categories + attr defs
  const categoriesDict = await loadCategoriesForExport(userId);
  const allCatIds      = Object.keys(categoriesDict);
  const attrDefs       = await loadAttrDefsForCategories(userId, allCatIds, categoriesDict);

  // Step 3 (S107w): deletions first — so a row can be deleted and its session
  // rebuilt by other rows of the same file in one pass. A failure here stops the
  // import before anything is created or updated.
  let deleteResult: DeleteResult = { deleted: 0, parentsDeleted: 0, errors: [], warnings: [], removed: [] };
  if (parsed.toDelete.length > 0) {
    deleteResult = await applyDeletes(userId, parsed.toDelete, categoriesDict);
    if (deleteResult.errors.length > 0) {
      return {
        ...empty,
        deleted:  deleteResult.deleted,
        removed:  deleteResult.removed,
        errors:   deleteResult.errors,
        warnings: [...parsed.warnings, ...deleteResult.warnings],
      };
    }
  }

  // Step 4: Smart reclassify (invalid event_ids → CREATE)
  const reclassified = await smartReclassify(userId, parsed.toCreate, parsed.toUpdate, categoriesDict);

  // Step 5: Validate
  const { validCreates, validUpdates, errors: validationErrors } = validateImportData(
    reclassified.toCreate,
    reclassified.toUpdate,
    categoriesDict,
  );

  if (validationErrors.length > 0) {
    return {
      ...empty,
      deleted:  deleteResult.deleted,
      removed:  deleteResult.removed,
      errors:   validationErrors,
      warnings: [...parsed.warnings, ...deleteResult.warnings, ...reclassified.warnings],
    };
  }

  // Step 6: Apply (s overwrite odlukama za kolizije)
  const result = await applyImportChanges(userId, validCreates, validUpdates, categoriesDict, attrDefs, overwriteDecisions, onProgress);

  return {
    created:  result.created,
    updated:  result.updated,
    skipped:  result.skipped + parsed.untouchedCount, // untouched rows (row_hash match) count as skipped
    deleted:  deleteResult.deleted,
    outcomes: result.outcomes,
    removed:  deleteResult.removed,
    errors:   result.errors,
    warnings: [...parsed.warnings, ...deleteResult.warnings, ...reclassified.warnings, ...result.warnings],
  };
}

// ─────────────────────────────────────────────
// Korak 7: Check for category paths in the Excel
// file that don't exist in the current DB.
// Returns missing paths + whether the file has
// a Structure sheet (for auto-creation offer).
// ─────────────────────────────────────────────

export interface MissingCategoriesResult {
  missingPaths:      string[];
  hasStructureSheet: boolean;
}

export async function checkMissingCategories(
  file:           File,
  categoriesDict: ExportCategoriesDict,
): Promise<MissingCategoriesResult> {
  const buffer = await file.arrayBuffer();
  const wb     = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Case-insensitive sheet name lookup (robustness for manually created files)
  const structureWs = wb.worksheets.find(ws => ws.name.toLowerCase() === 'structure');
  const hasStructureSheet = !!structureWs;

  const eventsWs = wb.worksheets.find(ws => ws.name.toLowerCase() === 'events') ?? wb.worksheets[0];
  if (!eventsWs) return { missingPaths: [], hasStructureSheet };

  // Skip stub sheet (no real events)
  const firstCell = cellStr(eventsWs.getRow(1).getCell(1).value);
  if (firstCell.includes('Export initiated from Structure tab')) {
    return { missingPaths: [], hasStructureSheet };
  }

  const { mapping, legendEndRow, error: legendError } = parseLegend(eventsWs);
  if (legendError) return { missingPaths: [], hasStructureSheet };

  const { headerRow, error: sectionError } = findEventDataSection(eventsWs, legendEndRow);
  if (sectionError) return { missingPaths: [], hasStructureSheet };

  const rows = parseDataRows(eventsWs, mapping, headerRow);

  const knownPaths = new Set<string>(
    Object.values(categoriesDict).map(info => `${info.area_name}||${info.full_path}`),
  );

  const missingSet = new Set<string>();
  for (const row of rows) {
    if (row.category_path && !knownPaths.has(`${row.area}||${row.category_path}`)) {
      missingSet.add(row.category_path);
    }
  }

  return {
    missingPaths: Array.from(missingSet),
    hasStructureSheet,
  };
}
