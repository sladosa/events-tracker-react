/**
 * E8 — Grantee with write permission
 *
 * Verifies that a user with write access to Fitness area can:
 *   - See Fitness in their area dropdown
 *   - Add Activity (no lock screen)
 *
 * Setup:
 *   - Creates write share programmatically before test
 *   - Runs as userb@test.com
 *
 * Cleanup:
 *   - afterAll removes the share and any events created by userb
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';
const FITNESS_AREA_ID = 'a1000000-0000-0000-0000-000000000001';

test.describe('E8 — Grantee write access', () => {
  let ownerPage: Page;
  let ownerCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Create write share using owner's session
    ownerCtx = await browser.newContext();
    ownerPage = await ownerCtx.newPage();
    await loginAsOwner(ownerPage);
    // Navigate once to initialise localStorage
    await ownerPage.goto('/app');
    await ownerPage.waitForLoadState('networkidle');

    await supabasePost(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
      share_type: 'area',
      target_id: FITNESS_AREA_ID,
      permission: 'write',
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    await supabaseDelete(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
    });
    // Delete any events created by userb in the Fitness area leaf categories
    await supabaseDelete(ownerPage, 'events', { user_id: USERB_ID });
    await ownerCtx.close();
  });

  test('E8-1: userb sees shared Fitness area in dropdown', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    const areaDropdown = page.getByRole('combobox').first();
    const options = await areaDropdown.locator('option').allTextContents();
    expect(options.some(o => /fitness/i.test(o))).toBeTruthy();
  });

  test('E8-2: userb can navigate to Add Activity (no lock screen)', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /strength/i });

    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    // Should NOT show the "read-only" lock screen
    await expect(page.getByText(/read.only|no write permission|locked/i)).not.toBeVisible();

    // Save / Finish button should be available
    await expect(page.getByRole('button', { name: /finish|save/i }).first()).toBeVisible({ timeout: 8_000 });
  });
});
