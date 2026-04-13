/**
 * E5 — Structure tab
 *
 * Tests Structure tab visibility, Edit Mode, Add Area, and Add Child logic.
 *
 * Preconditions (seed.sql):
 *   - Fitness area with: Activity > Gym > Strength (leaf, no events)
 *                                       > Cardio   (leaf, HAS events)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const PW_AREA_NAME = 'PW-TestArea';

test.describe('E5 — Structure tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    // Switch to Structure tab
    await page.getByRole('tab', { name: /structure/i }).click();
    await expect(page.getByText(/fitness/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('E5-1: Structure tab shows seed areas and categories', async ({ page }) => {
    await expect(page.getByText('Fitness')).toBeVisible();
    await expect(page.getByText('Cardio')).toBeVisible();
    await expect(page.getByText('Strength')).toBeVisible();
  });

  test('E5-2: Edit Mode toggle enables edit controls', async ({ page }) => {
    const editModeBtn = page.getByRole('button', { name: /edit mode/i });
    await editModeBtn.click();

    // Add Area button should appear
    await expect(page.getByRole('button', { name: /add area/i })).toBeVisible();
  });

  test('E5-3: Add Area → new area appears in table', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();
    await page.getByRole('button', { name: /add area/i }).click();

    // Fill in area name
    const nameInput = page.getByPlaceholder(/e\.g\. Health|area name/i).first();
    await nameInput.fill(PW_AREA_NAME);
    await page.getByRole('button', { name: /^create$/i }).click();

    // New area should appear in the structure table
    await expect(page.getByText(PW_AREA_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test('E5-4: Add Child on Cardio (leaf with events) → blocked state', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();

    // Hover over Cardio row to reveal Add Child button
    const cardioRow = page.locator('tr, [data-testid*="row"]').filter({ hasText: /cardio/i }).first();
    await cardioRow.hover();
    await cardioRow.getByRole('button', { name: /add child/i }).first().click();

    // Should show blocked state (cannot add child — leaf has events)
    await expect(
      page.getByText(/cannot add child|has events|blocked/i),
    ).toBeVisible({ timeout: 8_000 });

    // Create button should NOT be visible
    await expect(page.getByRole('button', { name: /^create$/i })).not.toBeVisible();
  });

  test('E5-5: Add Child on Strength (leaf without events) → create form shown', async ({ page }) => {
    await page.getByRole('button', { name: /edit mode/i }).click();

    const strengthRow = page.locator('tr, [data-testid*="row"]').filter({ hasText: /strength/i }).first();
    await strengthRow.hover();
    await strengthRow.getByRole('button', { name: /add child/i }).first().click();

    // Normal create form with name input
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible({ timeout: 8_000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up PW-TestArea if created
    await supabaseDelete(page, 'areas', { user_id: OWNER_ID, name: PW_AREA_NAME });
  });
});
