/**
 * E5 — Structure tab
 *
 * Preconditions (seed.sql):
 *   Fitness > Activity > Gym > Strength (leaf, no events)
 *                             > Cardio   (leaf, HAS events)
 *
 * CategoryChainRow renders <div data-testid="structure-row-<id>"> — used for row selection.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const PW_AREA_NAME = 'PW-TestArea';

test.describe('E5 — Structure tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });

    // Structure tab defaults to Sunburst — switch to Table view
    await page.getByRole('button', { name: 'Table' }).click();
    // Wait for seed area row to appear
    await expect(page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`))
      .toBeVisible({ timeout: 10_000 });
  });

  test('E5-1: Structure tab shows seed areas and categories', async ({ page }) => {
    await expect(page.locator(`[data-testid="structure-row-${SEED.CAT_CARDIO}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="structure-row-${SEED.CAT_STRENGTH}"]`)).toBeVisible();
  });

  test('E5-2: Edit Mode toggle enables Add Area button', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();
    await expect(page.getByRole('button', { name: /add area/i })).toBeVisible();
  });

  test('E5-3: Add Area → new area appears in table', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();
    await page.getByRole('button', { name: /add area/i }).click();

    await page.getByPlaceholder(/e\.g\. Health|area name/i).first().fill(PW_AREA_NAME);
    await page.getByRole('button', { name: /^create$/i }).click();

    // New area row appears — scope to structure rows (data-testid prefix) to avoid
    // strict mode conflict with hidden dropdown <option> that also contains the name
    await expect(
      page.locator('[data-testid^="structure-row-"]').filter({ hasText: PW_AREA_NAME }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E5-4: Add Child on Cardio (leaf with events) → blocked state', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();

    const cardioRow = page.locator(`[data-testid="structure-row-${SEED.CAT_CARDIO}"]`);
    await cardioRow.hover();
    await cardioRow.getByRole('button').last().click();
    await page.getByRole('button', { name: /add child/i }).click();

    await expect(
      page.getByText(/cannot add child|has events|blocked/i).first(),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /^create$/i })).not.toBeVisible();
  });

  test('E5-5: Add Child on Strength (leaf without events) → create form', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();

    const strengthRow = page.locator(`[data-testid="structure-row-${SEED.CAT_STRENGTH}"]`);
    await strengthRow.hover();
    await strengthRow.getByRole('button').last().click();
    await page.getByRole('button', { name: /add child/i }).click();

    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible({ timeout: 8_000 });
  });

  test.afterEach(async ({ page }) => {
    await supabaseDelete(page, 'areas', { user_id: OWNER_ID, name: PW_AREA_NAME });
  });
});
