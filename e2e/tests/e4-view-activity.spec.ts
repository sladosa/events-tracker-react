/**
 * E4 — View Activity + Prev/Next navigation
 *
 * Preconditions (seed.sql):
 *   - Fitness > Activity > Gym > Cardio (leaf with seed event 2026-01-01)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

test.describe('E4 — View Activity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    // Select Fitness > Cardio filter
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /cardio/i });

    await expect(page.getByText(/cardio/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('E4-1: open View Activity → details page shown', async ({ page }) => {
    const activityRow = page.locator('tr, [data-testid="activity-row"]').filter({ hasText: /cardio/i }).first();
    await activityRow.hover();
    await activityRow.getByRole('button', { name: /menu|options|⋮/i }).first().click();
    await page.getByRole('menuitem', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });

    // View Details page — shows category name in heading or breadcrumb
    await expect(page.getByText(/cardio/i).first()).toBeVisible({ timeout: 8_000 });

    // Edit button present for own events
    await expect(page.getByRole('link', { name: /edit/i })).toBeVisible();
  });

  test('E4-2: View Activity → Back button returns to /app', async ({ page }) => {
    const activityRow = page.locator('tr, [data-testid="activity-row"]').filter({ hasText: /cardio/i }).first();
    await activityRow.hover();
    await activityRow.getByRole('button', { name: /menu|options|⋮/i }).first().click();
    await page.getByRole('menuitem', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });

    // Navigate back
    await page.getByRole('link', { name: /back/i }).click();
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 10_000 });
  });

  test('E4-3: Prev/Next buttons visible on View Activity page', async ({ page }) => {
    const activityRow = page.locator('tr, [data-testid="activity-row"]').filter({ hasText: /cardio/i }).first();
    await activityRow.hover();
    await activityRow.getByRole('button', { name: /menu|options|⋮/i }).first().click();
    await page.getByRole('menuitem', { name: /view/i }).click();

    await expect(page).toHaveURL(/\/app\/view/, { timeout: 10_000 });

    // Prev and Next nav buttons should be present (may be disabled if only 1 event)
    const prevBtn = page.getByRole('button', { name: /prev/i });
    const nextBtn = page.getByRole('button', { name: /next/i });

    // At least one should exist in the DOM
    const prevCount = await prevBtn.count();
    const nextCount = await nextBtn.count();
    expect(prevCount + nextCount).toBeGreaterThan(0);
  });
});
