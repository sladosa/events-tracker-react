/**
 * T-S107w-1..3 — Delete? column + import report as a working file (S107w)
 *
 * The Excel roundtrip could add and modify records but not remove them, which
 * bites the moment someone adds a row by copying one: the copy becomes a real
 * event and there was no way to take it back. S107w closes that:
 *
 *   1. `Delete?` column in the export — pick DELETE, import, the record is gone
 *      (behind its own list and its own checkbox, separate from the update guard).
 *   2. The post-import report downloads automatically and is a NORMAL export file:
 *      real event_id, valid row_hash, Delete? dropdown already on it. So the fix
 *      for a bad row is: mark it DELETE in the report, import that same file.
 *
 * T-S107w-1: full loop — copy a row → import → report downloads → mark the new
 *            record DELETE in the report → import it → the record is gone.
 *            Also asserts Apply stays locked until the delete guard is ticked.
 * T-S107w-2: a value other than DELETE is an error, not a silent skip.
 * T-S107w-3: re-importing the report unchanged is a no-op (proves the extra
 *            Result/Source row/Changed columns don't break parsing).
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > Cardio (leaf, seed event)
 */

import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

// Each test gets its own comment AND its own session_start: a leftover row from a
// previous run would otherwise collide, and a collision turns Apply into "all
// skipped" — nothing created, no report, and a failure that looks like a bug.
const COMMENT_PREFIX = 'T-S107w throwaway row';
const DELETE_COMMENT = `${COMMENT_PREFIX} (delete)`;
const REPORT_COMMENT = `${COMMENT_PREFIX} (report)`;
const DELETE_TIME    = '23:41';
const REPORT_TIME    = '23:43';

async function restHeaders(page: Page): Promise<Record<string, string> | null> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, storageKey);
  if (!session?.access_token) return null;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function findEventIdByComment(page: Page, comment: string): Promise<string | null> {
  const headers = await restHeaders(page);
  if (!headers) return null;
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/events?comment=eq.${encodeURIComponent(comment)}&select=id`, { headers });
  const rows = await res.json();
  return rows?.[0]?.id ?? null;
}

async function eventExists(page: Page, eventId: string): Promise<boolean> {
  const headers = await restHeaders(page);
  if (!headers) return false;
  const res = await page.request.get(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=id`, { headers });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

/** Remove an event created by the test, attributes first (FK). */
async function deleteEvent(page: Page, eventId: string): Promise<void> {
  const headers = await restHeaders(page);
  if (!headers) return;
  await page.request.delete(`${SUPABASE_URL}/rest/v1/event_attributes?event_id=eq.${eventId}`,
    { headers: { ...headers, Prefer: 'return=minimal' } });
  await page.request.delete(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`,
    { headers: { ...headers, Prefer: 'return=minimal' } });
}

/**
 * Drop every leftover row this spec ever wrote (prefix match, not exact): an
 * aborted run leaves an event at the same session_start, and the next run then
 * collides instead of creating — which reads as a failure of the feature.
 */
async function cleanupTestRows(page: Page): Promise<void> {
  const headers = await restHeaders(page);
  if (!headers) return;
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/events?comment=like.${encodeURIComponent(COMMENT_PREFIX + '*')}&select=id`, { headers });
  const rows = await res.json();
  for (const r of (Array.isArray(rows) ? rows : [])) await deleteEvent(page, r.id);
}

/** Close whichever modal is open via its header × (page-level "Close" also matches the Help panel). */
async function closeModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: '×' }).first().click();
}

async function exportTemplate(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: /download excel/i }).first().click();
  const download = await downloadPromise;
  const filePath = path.join(mkdtempSync(path.join(tmpdir(), 'S107w-')), name);
  await download.saveAs(filePath);

  await page.getByRole('button', { name: '×' }).click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).not.toBeVisible({ timeout: 5_000 });
  return filePath;
}

async function startImport(page: Page, filePath: string): Promise<void> {
  await page.getByRole('button', { name: /📤 import/i }).click();
  await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
  await page.locator('input[type="file"]').setInputFiles(filePath);
}

/** Click Apply and capture the auto-downloaded import report. */
async function applyAndSaveReport(page: Page, name: string): Promise<string> {
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.getByRole('button', { name: /apply import/i }).click();
  const download = await downloadPromise;
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), 'S107w-report-')), name);
  await download.saveAs(reportPath);
  await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });
  return reportPath;
}

function findHeaderRow(ws: ExcelJS.Worksheet): number {
  let headerRow = -1;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRow !== -1) return;
    if (String(row.getCell(1).value ?? '').trim().toLowerCase() === 'event_id') headerRow = rowNumber;
  });
  expect(headerRow).toBeGreaterThan(0);
  return headerRow;
}

/** Column index of a trailing marker column (row_hash / Delete?) by header text. */
function findMarkerCol(ws: ExcelJS.Worksheet, headerRow: number, header: string): number {
  let found = -1;
  ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, col) => {
    if (found === -1 && String(cell.value ?? '').trim() === header) found = col;
  });
  return found;
}

/** Add a throwaway event by copying the first data row (the S107-3 pattern). */
async function makeCopiedRowFile(
  templatePath: string, outName: string, comment: string, sessionTime: string,
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('Events');
  if (!ws) throw new Error('Events sheet not found');

  const headerRow = findHeaderRow(ws);
  const source    = ws.getRow(headerRow + 1);
  const lastRow   = ws.lastRow?.number ?? headerRow + 1;
  const copy      = ws.getRow(lastRow + 1);
  source.eachCell({ includeEmpty: true }, (cell, col) => { copy.getCell(col).value = cell.value; });
  copy.getCell(5).value = sessionTime;       // session_start — avoid a collision
  copy.getCell(8).value = comment;
  copy.commit();

  const outPath = path.join(mkdtempSync(path.join(tmpdir(), 'S107w-copy-')), outName);
  await wb.xlsx.writeFile(outPath);
  return outPath;
}

test.describe('T-S107w — Delete? column + import report', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_CARDIO,
    ]);
    await expect(page.getByText('Cardio').first()).toBeVisible({ timeout: 10_000 });
    await cleanupTestRows(page);
  });

  test('T-S107w-1: report → mark DELETE → import removes exactly that record', async ({ page }) => {
    test.setTimeout(240_000);

    // ── Step 1: create a throwaway event by copying a row ──
    const templatePath = await exportTemplate(page, 'S107w_template.xlsx');
    const copiedPath   = await makeCopiedRowFile(templatePath, 'S107w_copied.xlsx', DELETE_COMMENT, DELETE_TIME);

    await startImport(page, copiedPath);
    await expect(page.getByText('New events to create')).toBeVisible({ timeout: 60_000 });
    const reportPath = await applyAndSaveReport(page, 'S107w_report.xlsx');

    let createdId = await findEventIdByComment(page, DELETE_COMMENT);
    expect(createdId).toBeTruthy();

    // The report must be a real export of exactly that record — not a log
    await expect(page.getByTestId('import-report-note')).toBeVisible();
    await closeModal(page);

    try {
      // ── Step 2: mark it DELETE in the report itself ──
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(reportPath);
      const ws = wb.getWorksheet('Events');
      if (!ws) throw new Error('Events sheet not found in report');

      const headerRow = findHeaderRow(ws);
      const deleteCol = findMarkerCol(ws, headerRow, 'Delete?');
      expect(deleteCol).toBeGreaterThan(0);

      // The report holds only the record just created
      const dataRow = ws.getRow(headerRow + 1);
      expect(String(dataRow.getCell(1).value ?? '')).toBe(createdId);
      expect(String(dataRow.getCell(8).value ?? '')).toBe(DELETE_COMMENT);

      dataRow.getCell(deleteCol).value = 'DELETE';
      dataRow.commit();

      const markedPath = path.join(mkdtempSync(path.join(tmpdir(), 'S107w-del-')), 'S107w_marked.xlsx');
      await wb.xlsx.writeFile(markedPath);

      // ── Step 3: import it — guard first, Apply locked until acknowledged ──
      await startImport(page, markedPath);
      await expect(page.getByText(/1 event will be permanently deleted/i)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('delete-guard-list').getByText(DELETE_COMMENT)).toBeVisible();

      const applyBtn = page.getByRole('button', { name: /apply import/i });
      await expect(applyBtn).toBeDisabled();
      await page.getByTestId('delete-guard-ack').check();
      await expect(applyBtn).toBeEnabled();

      await applyBtn.click();
      await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });
      const deletedStat = page.getByText('Events deleted', { exact: true }).locator('xpath=preceding-sibling::p[1]');
      await expect(deletedStat).toHaveText('1');

      // ── Step 4: it is really gone ──
      expect(await eventExists(page, createdId!)).toBe(false);
      createdId = null;
    } finally {
      if (createdId) await deleteEvent(page, createdId);
    }
  });

  test('T-S107w-2: any value other than DELETE is rejected, nothing is imported', async ({ page }) => {
    test.setTimeout(180_000);

    const templatePath = await exportTemplate(page, 'S107w_template2.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.getWorksheet('Events');
    if (!ws) throw new Error('Events sheet not found');

    const headerRow = findHeaderRow(ws);
    const deleteCol = findMarkerCol(ws, headerRow, 'Delete?');
    expect(deleteCol).toBeGreaterThan(0);
    ws.getRow(headerRow + 1).getCell(deleteCol).value = 'TRUE';   // the classic fill-down survivor
    ws.getRow(headerRow + 1).commit();

    const badPath = path.join(mkdtempSync(path.join(tmpdir(), 'S107w-bad-')), 'S107w_bad_value.xlsx');
    await wb.xlsx.writeFile(badPath);

    await startImport(page, badPath);
    await expect(page.getByText(/import error/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/only DELETE .* or an empty cell are accepted/i)).toBeVisible();
    // No Apply button at all — the file never reached the ready state
    await expect(page.getByRole('button', { name: /apply import/i })).toHaveCount(0);
  });

  test('T-S107w-3: re-importing the report unchanged is a no-op', async ({ page }) => {
    test.setTimeout(240_000);

    // Produce a report by creating one throwaway record (1 row in the report)
    const templatePath = await exportTemplate(page, 'S107w_template3.xlsx');
    const copiedPath   = await makeCopiedRowFile(templatePath, 'S107w_copied3.xlsx', REPORT_COMMENT, REPORT_TIME);

    await startImport(page, copiedPath);
    await expect(page.getByText('New events to create')).toBeVisible({ timeout: 60_000 });
    const reportPath = await applyAndSaveReport(page, 'S107w_report3.xlsx');
    const createdId  = await findEventIdByComment(page, REPORT_COMMENT);
    await closeModal(page);

    try {
      // The report carries the annotation columns; import must ignore them and
      // recognise the row as untouched via row_hash.
      await startImport(page, reportPath);
      await expect(page.getByText('Unchanged (skipped)')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/will be modified/i)).not.toBeVisible();
      await expect(page.getByText(/will be permanently deleted/i)).not.toBeVisible();

      const applyBtn = page.getByRole('button', { name: /apply import/i });
      await expect(applyBtn).toBeEnabled();
      await applyBtn.click();

      await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });
      const createdStat = page.getByText('Events created', { exact: true }).locator('xpath=preceding-sibling::p[1]');
      await expect(createdStat).toHaveText('0');
      const updatedStat = page.getByText('Events updated', { exact: true }).locator('xpath=preceding-sibling::p[1]');
      await expect(updatedStat).toHaveText('0');
    } finally {
      if (createdId) await deleteEvent(page, createdId);
    }
  });
});
