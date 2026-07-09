/**
 * T-S107-1 / T-S107-2 — row_hash skip + update-guard (S107, D7)
 *
 * S107 added two safety layers to the Excel roundtrip:
 *   1. row_hash skip: export writes a fingerprint per row; on import, a row whose
 *      recomputed fingerprint matches was NOT touched in Excel → skipped entirely
 *      (no DB reads/writes). A stale export can never revert app-side changes.
 *   2. update-guard: before Apply, every UPDATE row is dry-run diffed against the
 *      DB and shown as an explicit old→new list; Apply stays DISABLED until the
 *      user ticks the acknowledgement checkbox (anti "yes-to-all").
 *
 * T-S107-1: export → re-import the file unmodified → everything is skipped as
 *           unchanged, nothing is created or updated.
 * T-S107-2: export → edit one comment in Excel → import shows the guard with the
 *           exact change, Apply is locked until acknowledged, then updates exactly 1.
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > Cardio (leaf, seed event 2026-01-01)
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

const GUARD_COMMENT = 'T-S107 guard edit';

/** Restore a leaf event's comment via REST (cleanup — keeps seed data stable for E3/E4). */
async function patchComment(page: Page, eventId: string, comment: string | null): Promise<void> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, storageKey);
  if (!session?.access_token) return;

  await page.request.patch(
    `${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      data: { comment },
    },
  );
}

/** Export the current filter selection and return a saved .xlsx path.
 *  download.path() has no extension — the import modal rejects it — so saveAs. */
async function exportTemplate(page: Page): Promise<string> {
  await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await page.getByRole('button', { name: /download excel/i }).first().click();
  const download = await downloadPromise;
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'S107-export-'));
  const templatePath = path.join(tmpDir, 'S107_template.xlsx');
  await download.saveAs(templatePath);

  await page.getByRole('button', { name: '×' }).click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).not.toBeVisible({ timeout: 5_000 });
  return templatePath;
}

/** Open the import modal and feed it a file. */
async function startImport(page: Page, filePath: string): Promise<void> {
  await page.getByRole('button', { name: /📤 import/i }).click();
  await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
  await page.locator('input[type="file"]').setInputFiles(filePath);
}

/** Find the EVENT DATA header row in an exported workbook. */
function findHeaderRow(ws: ExcelJS.Worksheet): number {
  let headerRow = -1;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRow !== -1) return;
    if (String(row.getCell(1).value ?? '').trim().toLowerCase() === 'event_id') headerRow = rowNumber;
  });
  expect(headerRow).toBeGreaterThan(0);
  return headerRow;
}

test.describe('T-S107 — row_hash skip + update-guard', () => {
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
  });

  test('T-S107-1: re-importing an unmodified export is a complete no-op (all rows skipped)', async ({ page }) => {
    test.setTimeout(120_000);

    const templatePath = await exportTemplate(page);
    await startImport(page, templatePath);

    // Ready state: no update-guard (nothing modified), unchanged counter visible
    await expect(page.getByText('Unchanged (skipped)')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/will be modified/i)).not.toBeVisible();

    const applyBtn = page.getByRole('button', { name: /apply import/i });
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();

    // Done: nothing created, nothing updated, everything skipped
    await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });
    const createdStat = page.getByText('Events created', { exact: true }).locator('xpath=preceding-sibling::p[1]');
    await expect(createdStat).toHaveText('0');
    const updatedStat = page.getByText('Events updated', { exact: true }).locator('xpath=preceding-sibling::p[1]');
    await expect(updatedStat).toHaveText('0');
    await expect(page.getByText('Unchanged', { exact: true })).toBeVisible();
  });

  test('T-S107-2: editing one row triggers the update-guard; Apply locked until acknowledged', async ({ page }) => {
    test.setTimeout(180_000);

    const templatePath = await exportTemplate(page);

    // Edit the comment of the first data row in Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet('Events');
    if (!ws) throw new Error('Events sheet not found in exported template');

    const headerRow   = findHeaderRow(ws);
    const dataRow     = ws.getRow(headerRow + 1);
    const eventId     = String(dataRow.getCell(1).value ?? '');
    const oldComment  = dataRow.getCell(8).value == null ? null : String(dataRow.getCell(8).value);
    expect(eventId).toBeTruthy();

    dataRow.getCell(8).value = GUARD_COMMENT;
    dataRow.commit();

    const tmpDir = mkdtempSync(path.join(tmpdir(), 'S107-guard-'));
    const modifiedPath = path.join(tmpDir, 'S107_guard_edit.xlsx');
    await workbook.xlsx.writeFile(modifiedPath);

    try {
      await startImport(page, modifiedPath);

      // Update-guard appears with exactly this change, Apply is disabled
      await expect(page.getByText(/1 existing event will be modified/i)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('update-guard-list').getByText(GUARD_COMMENT)).toBeVisible();

      const applyBtn = page.getByRole('button', { name: /apply import/i });
      await expect(applyBtn).toBeDisabled();

      // Acknowledge → Apply unlocks → exactly 1 update
      await page.getByTestId('update-guard-ack').check();
      await expect(applyBtn).toBeEnabled();
      await applyBtn.click();

      await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });
      const updatedStat = page.getByText('Events updated', { exact: true }).locator('xpath=preceding-sibling::p[1]');
      await expect(updatedStat).toHaveText('1');
      const createdStat = page.getByText('Events created', { exact: true }).locator('xpath=preceding-sibling::p[1]');
      await expect(createdStat).toHaveText('0');
    } finally {
      // Restore the original comment so seed data stays stable for E3/E4
      await patchComment(page, eventId, oldComment);
    }
  });
});
