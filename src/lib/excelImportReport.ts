/**
 * Events Tracker – Import Report (S107w)
 * =======================================
 * Generated after every Excel import and downloaded automatically.
 *
 * The report is NOT a passive log: it is a normal export workbook containing
 * exactly the records the import created or updated — real `event_id`, valid
 * `row_hash`, working dropdowns, and the `Delete?` column already on it. So the
 * loop closes inside one file:
 *
 *     import → report downloads → mark the wrong row DELETE → import that file
 *
 * The three extra columns (Result / Source row / Changed) sit to the RIGHT of
 * every column the importer reads: fixed A–H, LEGEND-mapped attribute columns,
 * row_hash and Delete? are all located by letter or by header scan, and anything
 * further right is ignored (`parseDataRows` reads named columns only). That is
 * what makes the report re-importable rather than a dead end.
 *
 * Deleted records cannot be exported — they no longer exist — so they get their
 * own informational sheet instead.
 */

import ExcelJS from 'exceljs';
import {
  addActivitiesSheetsTo,
  buildAttrMeta,
  mergeSessionEvents,
  type RowAnnotations,
  type RowAnnotation,
} from './excelExport';
import { applyProfileToWorkbook, getProfileAttrOrder, type ExportProfile } from './exportProfile';
import { loadEventsByIdsForExport } from './excelDataLoader';
import { addFilterSheet, timestampSuffix, THIN_BORDER, HEADER_FONT } from './excelUtils';
import type { FilterSheetInfo } from './excelUtils';
import type { ImportOutcome } from './excelTypes';
import type { DeletePreview } from './excelImport';

export interface ImportReportInput {
  userId:      string;
  /** Name of the file that was imported */
  sourceFile:  string;
  outcomes:    ImportOutcome[];
  /** Records removed via the Delete? column (snapshot taken before deletion) */
  removed:     DeletePreview[];
  /** Rows skipped as unchanged — reported as a number only */
  skipped:     number;
  warnings:    string[];
  /**
   * Column layout to reuse — read from the imported file itself, not from
   * area settings. The report is the working file's continuation, so it has to
   * look like the file the user was just editing: same column order, same
   * groups collapsed, same widths. Without it the report opens fully expanded
   * and the columns that matter sit off-screen behind the frozen panes.
   */
  exportProfile?: ExportProfile | null;
  /** Profile name for the Filter sheet, when the imported file carried one. */
  profileName?:   string | null;
}

export interface ImportReportFile {
  buffer:   ArrayBuffer;
  filename: string;
}

const REPORT_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' },
};

/**
 * Build the report workbook. Returns null when there is nothing to report
 * (no creates, no updates, no deletions) — an empty file would only be noise.
 */
export async function buildImportReport(input: ImportReportInput): Promise<ImportReportFile | null> {
  const { userId, outcomes, removed } = input;
  if (outcomes.length === 0 && removed.length === 0) return null;

  const annotations: RowAnnotations = new Map<string, RowAnnotation>();
  for (const o of outcomes) {
    annotations.set(o.eventId, {
      result:    o.result,
      sourceRow: o.sourceRow,
      changed:   o.changed.join(', '),
    });
  }

  const bundle = await loadEventsByIdsForExport(userId, outcomes.map(o => o.eventId));
  const merged = mergeSessionEvents(bundle.events, bundle.categoriesDict);

  // Column order comes first (it decides which attribute lands in which column),
  // grouping and widths after the sheet exists — same order as createEventsExcel.
  // ⚠ The report covers only the categories the import touched, so its attribute
  //   set can be narrower than the profile's. applyProfileToWorkbook stops at the
  //   sheet's real attribute columns; it must never reach row_hash / Delete? /
  //   Result, which are what make this file re-importable.
  let attrColumnOrder: number[] | undefined;
  if (input.exportProfile) {
    const { attrMeta, attrColumns } = buildAttrMeta(bundle.attrDefs, bundle.categoriesDict);
    attrColumnOrder = getProfileAttrOrder(input.exportProfile, attrColumns, attrMeta);
  }

  const ts = timestampSuffix();

  // Composed in one workbook rather than post-processing a written file: an
  // ExcelJS load/save round trip is not guaranteed to preserve data validations,
  // conditional formatting and the hidden DropdownData sheet — and those are
  // exactly what makes the report editable.
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Events Tracker';
  wb.created = new Date();

  await addActivitiesSheetsTo(wb, merged, bundle.attrDefs, bundle.categoriesDict, 'desc', attrColumnOrder, annotations);
  if (input.exportProfile) {
    applyProfileToWorkbook(wb, input.exportProfile, bundle.attrDefs, bundle.categoriesDict);
  }
  // No Structure sheet: every category involved necessarily exists already.

  addSummarySheet(wb, input, merged.length);
  if (removed.length > 0) addDeletedSheet(wb, removed);

  const filterInfo: FilterSheetInfo = {
    exportType: `Import report — ${input.sourceFile}`,
    exportedAt: ts,
    area:       null,
    category:   null,
    dateFrom:   null,
    dateTo:     null,
    sortOrder:  'desc',
    exportProfile: input.profileName ?? undefined,
  };
  addFilterSheet(wb, filterInfo);

  return {
    buffer:   (await wb.xlsx.writeBuffer()) as ArrayBuffer,
    filename: `import_report_${ts}.xlsx`,
  };
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill      = REPORT_HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.border    = THIN_BORDER;
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  }
}

function addSummarySheet(wb: ExcelJS.Workbook, input: ImportReportInput, exportedRows: number): void {
  const ws = wb.addWorksheet('ImportReport');
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 70;

  const title = ws.addRow(['IMPORT REPORT', '']);
  title.getCell(1).font = { bold: true, size: 14 };
  ws.addRow([]);

  const created = input.outcomes.filter(o => o.result === 'Created').length;
  const updated = input.outcomes.filter(o => o.result === 'Updated').length;

  const rows: [string, string | number][] = [
    ['Imported file', input.sourceFile],
    ['Created',       created],
    ['Updated',       updated],
    ['Deleted',       input.removed.length],
    ['Unchanged',     input.skipped],
    ['Rows on the Events sheet', exportedRows],
  ];
  for (const [k, v] of rows) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font   = { bold: true };
    r.getCell(1).border = THIN_BORDER;
    r.getCell(2).border = THIN_BORDER;
  }

  ws.addRow([]);
  const how = [
    'The Events sheet holds the records this import created or changed — nothing else.',
    'It is a normal export file: you can edit it and import it straight back.',
    'To undo a record: put DELETE in its "Delete?" column and import this same file.',
    'Result / Source row / Changed (far right) describe what the import did; they are ignored on re-import.',
  ];
  for (const line of how) {
    const r = ws.addRow(['', line]);
    r.getCell(2).alignment = { wrapText: true };
  }

  if (input.warnings.length > 0) {
    ws.addRow([]);
    const wHeader = ws.addRow(['Warnings', '']);
    wHeader.getCell(1).font = { bold: true };
    for (const w of input.warnings) {
      const r = ws.addRow(['', w]);
      r.getCell(2).alignment = { wrapText: true };
    }
  }
}

function addDeletedSheet(wb: ExcelJS.Workbook, removed: DeletePreview[]): void {
  const ws = wb.addWorksheet('Deleted');

  const note = ws.addRow(['These records were DELETED and cannot be restored from this file — it is a record of what went, not a way back.']);
  note.getCell(1).font = { italic: true, color: { argb: 'FF9C0006' } };
  ws.addRow([]);

  const headers = ['event_id', 'event_date', 'session_start', 'Category_Path', 'comment', 'attributes', 'photos', 'Source row', 'Parents removed'];
  const header = ws.addRow(headers);
  styleHeaderRow(header, headers.length);

  for (const d of removed) {
    const r = ws.addRow([
      d.eventId,
      d.eventDate,
      d.sessionStart,
      d.categoryPath,
      d.comment,
      d.attrCount,
      d.photoCount,
      d.sourceRow,
      d.lastOfSession ? 'yes (last record of its session)' : '',
    ]);
    for (let c = 1; c <= headers.length; c++) r.getCell(c).border = THIN_BORDER;
  }

  const widths = [38, 12, 13, 32, 30, 11, 8, 11, 30];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}
