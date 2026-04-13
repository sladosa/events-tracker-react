/**
 * E3 — Edit Activity
 *
 * Tests editing an existing event (the seed Cardio event).
 *
 * Preconditions (seed.sql):
 *   - Fitness > Activity > Gym > Cardio (leaf, has seed event 2026-01-01)
 *
 * Note: we navigate to the edit page for session_start = 2026-01-01T10:00:00+00:00
 * but we use the Activities list to find and click Edit.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

test.describe('E3 — Edit Activity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });
  });

  test('E3-1: open Edit Activity from list → form loads correctly', async ({ page }) => {
    // Select Fitness > Cardio filter to see the seed event
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /cardio/i });

    // Wait for activity row to appear
    await expect(page.getByText(/cardio/i).first()).toBeVisible({ timeout: 10_000 });

    // Click the ⋮ menu on the activity row and select Edit
    const activityRow = page.locator('tr, [data-testid="activity-row"]').filter({ hasText: /cardio/i }).first();
    await activityRow.hover();
    await activityRow.getByRole('button', { name: /menu|options|⋮/i }).first().click();
    await page.getByRole('menuitem', { name: /edit/i }).click();

    // Should navigate to /app/edit/...
    await expect(page).toHaveURL(/\/app\/edit/, { timeout: 10_000 });

    // Edit Activity page loads with amber styling
    await expect(
      page.getByRole('button', { name: /save|finish/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E3-2: save Edit Activity without changes → back to /app', async ({ page }) => {
    // Navigate directly to Cardio filter
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /cardio/i });

    await expect(page.getByText(/cardio/i).first()).toBeVisible({ timeout: 10_000 });

    const activityRow = page.locator('tr, [data-testid="activity-row"]').filter({ hasText: /cardio/i }).first();
    await activityRow.hover();
    await activityRow.getByRole('button', { name: /menu|options|⋮/i }).first().click();
    await page.getByRole('menuitem', { name: /edit/i }).click();

    await expect(page).toHaveURL(/\/app\/edit/, { timeout: 10_000 });

    // Save without changes
    await page.getByRole('button', { name: /save|finish/i }).first().click();

    // Back to activities list
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });
  });
});
