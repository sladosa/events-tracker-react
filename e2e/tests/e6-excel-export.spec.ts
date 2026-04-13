/**
 * E6 — Excel Export (roundtrip — export side)
 *
 * Verifies that the export dialog opens and the download is triggered.
 * Full roundtrip (import) requires file picker automation — covered manually.
 *
 * Preconditions:
 *   - At least one event exists (seed Cardio event)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

test.describe('E6 — Excel Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });
  });

  test('E6-1: Export button opens Export modal', async ({ page }) => {
    // Select Fitness to ensure there are events visible
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });

    // Find Export button (Activities tab)
    const exportBtn = page.getByRole('button', { name: /export/i });
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });
    await exportBtn.click();

    // Export modal should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/export|download/i).first()).toBeVisible();
  });

  test('E6-2: Export triggers file download', async ({ page }) => {
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });

    const exportBtn = page.getByRole('button', { name: /export/i });
    await exportBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Listen for the download event and click the download button inside the modal
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });

    // The export modal has a "Download" or "Export" button inside
    await page.getByRole('dialog').getByRole('button', { name: /download|export/i }).first().click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test('E6-3: Structure Export triggers file download', async ({ page }) => {
    // Switch to Structure tab
    await page.getByRole('tab', { name: /structure/i }).click();
    await expect(page.getByText(/fitness/i).first()).toBeVisible({ timeout: 10_000 });

    const exportBtn = page.getByRole('button', { name: /export/i });
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await exportBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/structure.*\.xlsx$|\.xlsx$/i);
  });
});
