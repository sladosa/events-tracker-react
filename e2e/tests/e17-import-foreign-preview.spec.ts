/**
 * E17 — "Import as mine" preview tells the truth (BUG-S118-PREVIEWMODE).
 *
 * The modal parses the file BEFORE asking what to do with foreign rows, so the
 * first pass can only assume `skip`. On a file exported by someone else that
 * leaves nothing to import — the preview said `0 New / 0 Modify` right when the
 * user was deciding, and the collision check ran over an empty set, so
 * "Import as mine" had no protection against importing the same file twice.
 *
 * This test exports a real file, rewrites its User column to another address so
 * every row is foreign, and checks what the preview claims after the choice.
 * It never applies the import — nothing is written.
 */
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import path from 'path';
import os from 'os';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

test.setTimeout(90_000);

test('E17-1: preview after "Import as mine" is not 0 New / 0 Modify', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  await selectFilterPath(page, SEED.AREA_FITNESS);

  // 1. Export the area to a real workbook
  await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('button', { name: /download excel/i }).first().click();
  const download = await downloadPromise;

  // The export modal stays open over the toolbar after the download.
  await page.getByRole('button', { name: '×' }).first().click();
  await expect(page.getByRole('heading', { name: /export to excel/i })).toBeHidden();

  const src = path.join(os.tmpdir(), `e17-src-${Date.now()}.xlsx`);
  const foreign = path.join(os.tmpdir(), `e17-foreign-${Date.now()}.xlsx`);
  await download.saveAs(src);

  // 2. Rewrite the User column so every data row belongs to someone else.
  //    The column is found by header text, not by position — the layout is
  //    configurable per Area and a hard-coded index would silently rewrite the
  //    wrong column, which looks exactly like a passing test.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);
  const ws = wb.getWorksheet('Events') ?? wb.worksheets[0];
  let headerRow = 0;
  let userCol = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 20) && !userCol; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell, c) => {
      const v = String(cell.value ?? '').trim().toLowerCase();
      if (v === 'user' || v === 'user_email' || v === 'email') { headerRow = r; userCol = c; }
    });
  }
  expect(userCol, 'User column not found in export — layout changed?').toBeGreaterThan(0);

  let rewritten = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.getCell(2).value) continue;            // no Area = not a data row
    row.getCell(userCol).value = process.env.PLAYWRIGHT_TEST_EMAIL_B!;
    rewritten++;
  }
  expect(rewritten, 'export had no data rows to make foreign').toBeGreaterThan(0);
  await wb.xlsx.writeFile(foreign);

  // 3. Import it and choose "Import as mine"
  await page.getByRole('button', { name: /📤 import|^import$/i }).first().click();
  await page.locator('input[type="file"]').setInputFiles(foreign);

  await expect(page.getByText(/multi-user file detected/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('radio', { name: /import as mine/i })
    .or(page.locator('input[value="import_as_mine"]')).first().check();
  await page.getByRole('button', { name: /continue/i }).click();

  // 4. What the user must see. These rows are copies of events that already
  //    exist, so the honest answer is a collision list — the guard that catches
  //    importing the same file twice. Before the fix the preview was computed in
  //    `skip` mode, so there was nothing to collide with: no list, no warning,
  //    `0 New / 0 Modify`, and Apply would have inserted duplicates in silence.
  const collisionRows = page.getByText(/existing event in DB/i);
  await expect(collisionRows.first()).toBeVisible({ timeout: 30_000 });
  expect(await collisionRows.count(), 'every foreign row should be flagged as a collision')
    .toBe(rewritten);

  console.log(`E17: ${rewritten} foreign rows -> ${await collisionRows.count()} collisions detected`);
});
