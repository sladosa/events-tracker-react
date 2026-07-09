/**
 * T-S104-3 — Excel Import progress bar (Fable Q3 + Q4)
 *
 * Large imports (Diary migration target: 7000+ rows) used to run with zero
 * feedback while applyImportChanges() sequentially inserted event_attributes
 * one at a time — the UI looked "frozen". S104 added:
 *   - Q3: batched event_attributes INSERT (excelImport.ts)
 *   - Q4: onProgress(done, total) callback → progress bar in ExcelImportModal
 *
 * This test exports the existing Cardio seed row as a real, correctly-formatted
 * template (Legend + headers), clones it into ~500 brand-new CREATE rows (future
 * dates, no collisions), re-imports that file, and verifies the progress bar
 * becomes visible with a matching total and that the import completes with the
 * expected created count (i.e. it doesn't hang or silently drop rows).
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

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
// Each cloned row is a distinct session (own Gym+Activity parent chain, no shared
// parents) — deliberately the worst case for per-session parent-upsert overhead,
// so 150 rows against a remote TEST DB already takes ~2 minutes. Large enough to
// prove the progress bar increments meaningfully; not the full 7000-row Diary target.
const CLONE_COUNT = 150;
const FUTURE_YEAR = 2032; // far enough out to guarantee zero collisions with other data

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

/**
 * Date-scoped delete (gte filter) — supabaseDelete() in fixtures/auth.ts only
 * supports eq filters. Needed here because a plain category_id/chain_key match
 * would also delete the ORIGINAL seed Cardio event (2026-01-01) that E3/E4 rely on.
 */
async function deleteFutureTestRows(page: Page, matchField: 'category_id' | 'chain_key'): Promise<void> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const session = await page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, storageKey);
  if (!session?.access_token) return;

  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/events?user_id=eq.${OWNER_ID}&${matchField}=eq.${SEED.CAT_CARDIO}&event_date=gte.${FUTURE_YEAR}-01-01`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        Prefer: 'return=minimal',
      },
    },
  );
}

test.describe('T-S104-3 — Import progress bar on a large batch', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    // Guarantee a clean slate even if a previous run crashed before its afterEach ran.
    await deleteFutureTestRows(page, 'category_id');
    await deleteFutureTestRows(page, 'chain_key');
  });

  test('T-S104-3: 500-row import shows progress and completes without freezing', async ({ page }) => {
    test.setTimeout(300_000); // collision check + apply against remote TEST DB genuinely takes longer than the default 30s
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_CARDIO,
    ]);
    await expect(page.getByText('Cardio').first()).toBeVisible({ timeout: 10_000 });

    // ── 1. Export the real, correctly-formatted template for this category ──
    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();
    const download = await downloadPromise;
    const templatePath = await download.path();
    expect(templatePath).toBeTruthy();

    // Close the export modal
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).not.toBeVisible({ timeout: 5_000 });

    // ── 2. Clone the exported data row into CLONE_COUNT new CREATE rows ──
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath!);
    const ws = workbook.getWorksheet('Events');
    if (!ws) throw new Error('Events sheet not found in exported template');

    let headerRow = -1;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (headerRow !== -1) return;
      if (String(row.getCell(1).value ?? '').trim().toLowerCase() === 'event_id') headerRow = rowNumber;
    });
    expect(headerRow).toBeGreaterThan(0);

    const templateRowNum = headerRow + 1;
    const templateRow = ws.getRow(templateRowNum);
    const area = String(templateRow.getCell(2).value ?? '');
    const categoryPath = String(templateRow.getCell(3).value ?? '');
    const userEmail = templateRow.getCell(7).value ?? null;
    expect(area).toBeTruthy();
    expect(categoryPath).toBeTruthy();

    let nextRowNum = ws.lastRow ? ws.lastRow.number + 1 : templateRowNum + 1;
    const baseDate = new Date(Date.UTC(FUTURE_YEAR, 0, 1)); // real Date arithmetic — avoids manual month/day overflow bugs
    for (let i = 0; i < CLONE_COUNT; i++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const row = ws.getRow(nextRowNum);
      row.getCell(1).value = null;              // event_id — blank = CREATE
      row.getCell(2).value = area;
      row.getCell(3).value = categoryPath;
      row.getCell(4).value = dateStr;            // event_date
      row.getCell(5).value = '09:00';            // session_start
      row.getCell(6).value = '09:00:01';         // created_at
      row.getCell(7).value = userEmail;
      row.getCell(8).value = `T-S104-3 row ${i}`; // comment
      row.commit();
      nextRowNum++;
    }

    const tmpDir = mkdtempSync(path.join(tmpdir(), 'S104-import-'));
    const modifiedPath = path.join(tmpDir, 'S104_large_import.xlsx');
    await workbook.xlsx.writeFile(modifiedPath);

    // ── 3. Feed the modified file into the Import modal ──
    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });

    await page.locator('input[type="file"]').setInputFiles(modifiedPath);

    // Wait for parse + collision-check to settle, then Apply.
    // 500-row collision check does a per-row DB query — genuinely slower than 20s.
    const applyBtn = page.getByRole('button', { name: /apply import/i });
    await expect(applyBtn).toBeVisible({ timeout: 60_000 });
    await applyBtn.click();

    // ── 4. Progress bar should appear with the correct total while applying ──
    // Total = CLONE_COUNT new rows. The pre-existing template row is untouched in
    // Excel, so the S107 row_hash skip drops it at parse time — it never reaches
    // applyImportChanges (before S107 it was an UPDATE candidate → total was +1).
    const expectedTotal = CLONE_COUNT;
    await expect(page.getByText(new RegExp(`/ ${expectedTotal} rows`))).toBeVisible({ timeout: 15_000 });

    // ── 5. Import completes (doesn't hang) — Done screen shows the created count ──
    await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 120_000 });
    const createdStat = page.getByText('Events created', { exact: true }).locator('xpath=preceding-sibling::p[1]');
    await expect(createdStat).toHaveText(String(CLONE_COUNT));
  });

  test.afterEach(async ({ page }) => {
    // Date-scoped cleanup only — must NOT touch the original seed Cardio event
    // (2026-01-01) that E3/E4 depend on.
    await deleteFutureTestRows(page, 'category_id'); // synthetic Cardio leaves
    await deleteFutureTestRows(page, 'chain_key');    // synthetic Gym/Activity parents
  });
});
