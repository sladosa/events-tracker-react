/**
 * E6 — Excel Export
 *
 * Verifies export dialog opens and .xlsx download is triggered.
 *
 * ExcelExportModal is a plain <div> (no role="dialog") — identify by heading.
 * Structure Export directly triggers download without modal.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

test.describe('E6 — Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  });

  test('E6-1: Export button opens Export modal', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS);

    const exportBtn = page.getByRole('button', { name: /📥 export|^export$/i });
    await expect(exportBtn.first()).toBeVisible({ timeout: 8_000 });
    await exportBtn.first().click();

    // Modal identified by its heading (no role="dialog" on container)
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
  });

  test('E6-2: Export triggers .xlsx download', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS);

    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test('E6-3: Structure Export triggers .xlsx download', async ({ page }) => {
    await page.getByRole('button', { name: 'Structure' }).click();
    // Wait for Structure tab toolbar (Edit Mode button is unique to Structure tab)
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /export/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});
