/**
 * E2 — Add Activity
 *
 * Tests the full Add Activity flow for a leaf category without existing events.
 * Uses the Strength leaf (c1000000-0000-0000-0000-000000000003) which has no events.
 *
 * Preconditions (seed.sql):
 *   - Fitness > Activity > Gym > Strength (leaf, no events)
 *
 * Cleanup:
 *   - afterEach deletes any event created during the test via Supabase REST
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('E2 — Add Activity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });
  });

  test('E2-1: select leaf category → Add Activity button enabled', async ({ page }) => {
    // Select Fitness area
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });

    // Progressive selector — drill down to Strength
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /strength/i });

    // Add Activity button should appear
    await expect(
      page.getByRole('button', { name: /add activity/i }),
    ).toBeVisible();
  });

  test('E2-2: save new activity → appears in activities list', async ({ page }) => {
    // Navigate to Add Activity for Strength via the URL + category param
    // First select the category in the filter to get the Add Activity button
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /strength/i });

    await page.getByRole('button', { name: /add activity/i }).click();
    await expect(page).toHaveURL(/\/app\/add/);

    // Add Activity page loaded — Finish / Save button visible
    await expect(
      page.getByRole('button', { name: /finish|save/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Submit the form (no required attributes in seed data)
    await page.getByRole('button', { name: /finish|save/i }).first().click();

    // Redirected back to /app
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });

    // The Strength leaf should now appear in the activities list
    await expect(
      page.getByText(/strength/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up events we may have created (all events for Strength that aren't seed events)
    // We target category c1000000-0000-0000-0000-000000000003 (Strength)
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      category_id: 'c1000000-0000-0000-0000-000000000003',
    });
    // Also clean parent events created via chain (Activity + Gym with chain_key = Strength UUID)
    // These are identified by chain_key = Strength category id
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      chain_key: 'c1000000-0000-0000-0000-000000000003',
    });
  });
});
