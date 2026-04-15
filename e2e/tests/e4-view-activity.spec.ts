/**
 * E4 — View Activity + Prev/Next navigation
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > Cardio (seed event 2026-01-01)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

test.describe('E4 — View Activity', () => {
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

  test('E4-1: open View Activity → details page shown', async ({ page }) => {
    const activityRow = page.locator('tr').filter({ hasText: 'Cardio' }).first();
    await activityRow.hover();
    await activityRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Cardio').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /edit activity/i })).toBeVisible();
  });

  test('E4-2: View Activity → Back button returns to /app', async ({ page }) => {
    const activityRow = page.locator('tr').filter({ hasText: 'Cardio' }).first();
    await activityRow.hover();
    await activityRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /back to list/i }).click();
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 10_000 });
  });

  test('E4-3: Prev/Next buttons present on View Activity page', async ({ page }) => {
    const activityRow = page.locator('tr').filter({ hasText: 'Cardio' }).first();
    await activityRow.hover();
    await activityRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 10_000 });

    // Buttons are "◀ Prev" and "Next ▶" — may be disabled but must be present
    await expect(page.getByRole('button', { name: /prev/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });
});
