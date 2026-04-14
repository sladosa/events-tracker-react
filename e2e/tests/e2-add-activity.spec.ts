/**
 * E2 — Add Activity
 *
 * Preconditions (seed.sql):
 *   - Fitness > Activity > Gym > Strength (leaf, no events)
 *
 * Cleanup: afterEach deletes any event created during the test
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('E2 — Add Activity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  });

  test('E2-1: select leaf category → Add Activity button enabled', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    // Button is always in DOM but disabled until leaf category detected (async fetch)
    await expect(page.getByRole('button', { name: /add activity/i })).not.toBeDisabled({ timeout: 10_000 });
  });

  test('E2-2: save new activity → appears in activities list', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    // Wait for category select to settle (async leaf-detection side-effects can
    // briefly re-trigger isLoading on the select; stability before clicking)
    const catSelect = page.locator('select').filter({
      has: page.locator('option[value=""]'),
    }).last();
    await expect(catSelect).not.toBeDisabled({ timeout: 5_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    // Fill in Event Note to enable Finish button
    // (canFinish requires at least one of: touched attr / note / photo)
    await page.getByPlaceholder(/felt strong today/i).fill('PW test note');
    const finishBtn = page.getByRole('button', { name: /finish/i }).first();
    await expect(finishBtn).not.toBeDisabled({ timeout: 5_000 });
    await finishBtn.click();

    // Success dialog appears — click "Go to Home"
    await page.getByRole('button', { name: /go to home/i }).click();

    // Back to /app
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });

    // Strength appears in list
    await expect(page.getByText(/strength/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      category_id: SEED.CAT_STRENGTH,
    });
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      chain_key: SEED.CAT_STRENGTH,
    });
  });
});
