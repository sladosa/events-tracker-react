/**
 * E3 — Edit Activity
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > Cardio (leaf, seed event 2026-01-01)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

test.describe('E3 — Edit Activity', () => {
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

  test('E3-1: open Edit Activity from list → form loads', async ({ page }) => {
    const activityRow = page.locator('tr').filter({ hasText: 'Cardio' }).first();
    await activityRow.hover();
    // Actions button has only an img inside (no text) — locate by position in last cell
    await activityRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /edit/i }).click();

    await expect(page).toHaveURL(/\/app\/edit/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /save|finish/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('E3-2: navigate home from edit → back to /app', async ({ page }) => {
    const activityRow = page.locator('tr').filter({ hasText: 'Cardio' }).first();
    await activityRow.hover();
    await activityRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /edit/i }).click();

    await expect(page).toHaveURL(/\/app\/edit/, { timeout: 10_000 });
    // Save is disabled when no changes made — use Home button to navigate back
    await page.getByRole('button', { name: /home/i }).click();

    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });
  });
});
