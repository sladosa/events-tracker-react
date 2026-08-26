/**
 * T-S100-1 — an import row lands in the Area its `Area` column names, even when
 * another Area has a category with the identical path (BUG-S99-IMPORT).
 *
 * WHY THIS IS NOT HISTORY
 *   On PROD, `Financije_all` and `Financije_old` BOTH have a `Transakcija`
 *   category, and batch 2024 / 2023 are still to be imported. A path alone is
 *   not unique, so if resolution ever fell back to "first path that matches",
 *   rows would land in the wrong Area — and the import would report a perfectly
 *   healthy count while doing it. That is the S113 class: convincing number,
 *   wrong content.
 *
 * The code keys categories by `${area_name}||${full_path}` in all eleven places,
 * and every caller of getHierarchyLevels passes `row.area`. This test is what
 * turns that reading into a measurement.
 *
 * ⚠ WHY BOTH DIRECTIONS. The first version imported one file, into A, and passed
 *   even with resolution deliberately reduced to a bare path — because with a
 *   bare key one of the two twins wins the dictionary, and it happened to be A.
 *   A coin toss is not a test. Importing into BOTH twins is: path-only
 *   resolution sends both files to the same category, so one side must fail.
 *
 * ⚠ There is a bare-path fallback left in `getHierarchyLevels` (excelImport.ts,
 *   `if (!areaName) pathToId[info.full_path] = id`). It is unreachable today
 *   because the parser does not treat a row without `Area` as a row at all
 *   (S113). If that ever relaxes, this test is the one that will notice.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const SHARED_PATH = 'Transakcija';
const MARK = `S100 twin ${Date.now()}`;

test.setTimeout(180_000);

interface Made { areaId: string; catId: string; areaName: string }

async function makeArea(page: Page, label: string): Promise<Made> {
  const areaId = randomUUID();
  const catId = randomUUID();
  const areaName = `S100 ${label} ${areaId.slice(0, 6)}`;
  await supabasePost(page, 'areas', {
    id: areaId, user_id: OWNER_ID, name: areaName,
    slug: `s100-${label.toLowerCase()}-${areaId.slice(0, 6)}`, sort_order: 92,
  });
  // Same NAME in both areas on purpose — that is what makes the paths collide.
  await supabasePost(page, 'categories', {
    id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
    name: SHARED_PATH, slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
  });
  return { areaId, catId, areaName };
}

test.describe('T-S100-1 — two Areas, one category path', () => {
  let A: Made, B: Made;

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    A = await makeArea(page, 'A');
    B = await makeArea(page, 'B');
    // One event in A, so its export has a real data row to copy.
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: A.catId,
      event_date: '2026-03-03', session_start: '2026-03-03T09:00:00+00:00',
      comment: 'S100 seed',
    });
    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (A) await deleteAreaCascade(page, A.areaId);
    if (B) await deleteAreaCascade(page, B.areaId);
  });

  test('T-S100-1: the row goes to the Area named in column Area, not to the twin', async ({ page }) => {
    await selectFilterPath(page, A.areaId, [A.catId]);

    // Export A
    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();
    const dir = mkdtempSync(path.join(tmpdir(), 'S100-'));
    const file = path.join(dir, 'a.xlsx');
    await (await dl).saveAs(file);
    await page.getByRole('button', { name: '×' }).first().click();

    // Copy the data row into a new event (blank id, new time, own comment).
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Events')!;
    let header = -1;
    ws.eachRow((row, n) => {
      if (header === -1 && String(row.getCell(1).value ?? '').toLowerCase().includes('event_id')) header = n;
    });
    expect(header, 'header row not found in export').toBeGreaterThan(0);

    const src = ws.getRow(header + 1);
    expect(String(src.getCell(2).value ?? ''), 'exported row must carry the Area name').toBe(A.areaName);
    expect(String(src.getCell(3).value ?? '')).toBe(SHARED_PATH);

    const copy = ws.getRow((ws.lastRow?.number ?? header + 1) + 1);
    src.eachCell({ includeEmpty: true }, (cell, col) => { copy.getCell(col).value = cell.value; });
    copy.getCell(1).value = null;        // no event_id → CREATE
    copy.getCell(5).value = '23:31';     // free minute
    copy.getCell(8).value = MARK;
    copy.commit();
    const out = path.join(dir, 'a_copy.xlsx');
    await wb.xlsx.writeFile(out);

    // Import
    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(out);
    const applyBtn = page.getByRole('button', { name: /apply import/i });
    await expect(applyBtn).toBeEnabled({ timeout: 60_000 });
    await applyBtn.click();
    await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });

    // Where did it land? Ask the database, not the modal — the modal's count is
    // exactly the thing that would look healthy while the row went astray.
    const inA = await supabaseGet(page, 'events', { comment: MARK }, 'id,category_id');
    expect(inA, 'the row imported into A was not created at all').toHaveLength(1);
    expect((inA[0] as { category_id: string }).category_id,
      `row for "${A.areaName}" landed in the twin`).toBe(A.catId);

    // ── Same file, Area column rewritten to the twin ──
    const markB = `${MARK} B`;
    copy.getCell(2).value = B.areaName;
    copy.getCell(8).value = markB;
    copy.getCell(5).value = '23:37';
    copy.commit();
    const outB = path.join(dir, 'b_copy.xlsx');
    await wb.xlsx.writeFile(outB);

    await page.goto('/app');
    await selectFilterPath(page, B.areaId, [B.catId]);
    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(outB);
    const applyB = page.getByRole('button', { name: /apply import/i });
    await expect(applyB).toBeEnabled({ timeout: 60_000 });
    await applyB.click();
    await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 60_000 });

    const inB = await supabaseGet(page, 'events', { comment: markB }, 'id,category_id');
    expect(inB, 'the row imported into B was not created at all').toHaveLength(1);
    expect((inB[0] as { category_id: string }).category_id,
      `row for "${B.areaName}" landed in A — resolution ignored the Area column`).toBe(B.catId);
  });
});
