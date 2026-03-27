/**
 * excelUtils.ts — Shared Excel utilities
 * ========================================
 * Foundation layer for the unified workbook format.
 * Used by: excelExport.ts, structureExcel.ts, excelBackup.ts
 *
 * Exports:
 *   - Shared fill/font/border constants
 *   - colLetter()       — 1→A, 27→AA
 *   - timestampSuffix() — "20260326_142307"
 *   - addFilterSheet()  — writes the 5th sheet (Filter) to a workbook
 */

import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────
// Fill constants (canonical colours for unified workbook format)
// ─────────────────────────────────────────────────────────────

/** Read-only / auto-calculated columns */
export const PINK_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' },
};

/** Key identifier columns (edit carefully) */
export const YELLOW_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' },
};

/** Freely editable columns */
export const BLUE_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' },
};

/** Dependency / DependsOn columns */
export const GREEN_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' },
};

/** Attribute columns in Events sheet (inherited from excelExport) */
export const ORANGE_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' },
};

/** Backup info row marker (Row 6 in Structure sheet) */
export const BACKUP_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' },
};

// ─────────────────────────────────────────────────────────────
// Font / border constants
// ─────────────────────────────────────────────────────────────

/** White bold — used on dark header rows */
export const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
};

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin' },
  bottom: { style: 'thin' },
  left:   { style: 'thin' },
  right:  { style: 'thin' },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert 1-based column index → Excel letter notation.
 * colLetter(1) → "A", colLetter(27) → "AA"
 */
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

/**
 * Return a compact timestamp string for use in filenames.
 * Format: "YYYYMMDD_HHmmss"  e.g. "20260326_142307"
 */
export function timestampSuffix(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Format a timestamp suffix back to a human-readable string.
 *  "20260321_142307" → "2026-03-21 14:23:07"
 */
export function formatTimestampSuffix(ts: string): string {
  return ts.replace(
    /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/,
    '$1-$2-$3 $4:$5:$6',
  );
}

// ─────────────────────────────────────────────────────────────
// Filter sheet
// ─────────────────────────────────────────────────────────────

export interface FilterSheetInfo {
  /** Label shown in "Export type" row */
  exportType: 'Activities' | 'Structure' | 'Full Backup';
  /**
   * Timestamp suffix (from timestampSuffix()) used for "Exported at".
   * If omitted, a fresh suffix is generated.
   */
  exportedAt?: string;
  /** Area name or null → displayed as "All" */
  area?: string | null;
  /** Category path or null → displayed as "All" */
  category?: string | null;
  /** YYYY-MM-DD — lower bound of the export filter, or null → "All time" */
  dateFrom?: string | null;
  /** YYYY-MM-DD — upper bound of the export filter, or null → "All time" */
  dateTo?: string | null;
  /** Human-readable period label, e.g. "Last 3 months" */
  periodLabel?: string;
  /** Sort order shown to the user */
  sortOrder?: 'asc' | 'desc';
  /**
   * Backup-mode: date of the first event record in the database.
   * Displayed as "All time (first: YYYY-MM-DD)" when dateFrom is null.
   */
  firstRecord?: string;
  /**
   * Backup-mode: date of the last event record in the database.
   * Displayed as "All time (last: YYYY-MM-DD)" when dateTo is null.
   */
  lastRecord?: string;
}

const FILTER_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' },
};

const FILTER_KEY_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' },
};

/**
 * Add the "Filter" sheet (5th sheet in the unified workbook) to wb.
 * Call this after all other sheets have been added.
 */
export function addFilterSheet(
  wb: ExcelJS.Workbook,
  info: FilterSheetInfo,
): void {
  const ws = wb.addWorksheet('Filter');

  // Column widths
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 40;

  // Header row
  const header = ws.addRow(['Filter / Export Info', '']);
  header.getCell(1).fill = FILTER_HEADER_FILL;
  header.getCell(1).font = HEADER_FONT;
  header.getCell(2).fill = FILTER_HEADER_FILL;
  ws.mergeCells(`A1:B1`);
  header.height = 20;

  const ts = info.exportedAt ?? timestampSuffix();

  const rows: [string, string][] = [
    ['Export type',  info.exportType],
    ['Exported at',  formatTimestampSuffix(ts)],
    ['Area',         info.area ?? 'All'],
    ['Category',     info.category ?? 'All'],
    ['Date From',    _fmtDate(info.dateFrom, 'first', info.firstRecord)],
    ['Date To',      _fmtDate(info.dateTo,   'last',  info.lastRecord)],
    ['Period label', info.periodLabel ?? (info.exportType === 'Full Backup' ? 'All time at export' : '')],
    ['Sort order',   info.sortOrder === 'asc' ? 'Oldest first' : 'Newest first'],
  ];

  for (const [key, value] of rows) {
    const row = ws.addRow([key, value]);
    row.getCell(1).fill = FILTER_KEY_FILL;
    row.getCell(1).font = { bold: true };
    row.getCell(1).border = THIN_BORDER;
    row.getCell(2).border = THIN_BORDER;
  }
}

/** Format a date field for the Filter sheet. */
function _fmtDate(
  date: string | null | undefined,
  bound: 'first' | 'last',
  recordDate: string | undefined,
): string {
  if (date) return date;
  if (recordDate) return `All time (${bound}: ${recordDate})`;
  return 'All time';
}
