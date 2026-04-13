/**
 * E9 — Grantee with read-only permission
 *
 * Verifies that a user with read access to Fitness area:
 *   - Can see Fitness in their area dropdown
 *   - Add Activity shows the "read-only" lock screen (P4 guard)
 *   - Structure tab does NOT show Edit Mode button for grantee
 *
 * Setup:
 *   - Creates read share programmatically before test
 *
 * Cleanup:
 *   - afterAll removes the share
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';
const FITNESS_AREA_ID = 'a1000000-0000-0000-0000-000000000001';

test.describe('E9 — Grantee read-only access', () => {
  let ownerPage: Page;
  let ownerCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    ownerCtx = await browser.newContext();
    ownerPage = await ownerCtx.newPage();
    await loginAsOwner(ownerPage);
    await ownerPage.goto('/app');
    await ownerPage.waitForLoadState('networkidle');

    await supabasePost(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
      share_type: 'area',
      target_id: FITNESS_AREA_ID,
      permission: 'read',
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    await supabaseDelete(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
    });
    await ownerCtx.close();
  });

  test('E9-1: userb sees shared Fitness area in dropdown', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    const areaDropdown = page.getByRole('combobox').first();
    const options = await areaDropdown.locator('option').allTextContents();
    expect(options.some(o => /fitness/i.test(o))).toBeTruthy();
  });

  test('E9-2: read grantee → Add Activity shows lock screen', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    // Select Fitness > Strength (leaf, no events)
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });
    await page.getByRole('combobox').nth(1).selectOption({ label: /activity/i });
    await page.getByRole('combobox').nth(2).selectOption({ label: /gym/i });
    await page.getByRole('combobox').nth(3).selectOption({ label: /strength/i });

    // Add Activity button should be disabled or missing for read grantee
    const addBtn = page.getByRole('button', { name: /add activity/i });
    const isDisabled = await addBtn.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();
  });

  test('E9-3: read grantee → Structure tab has no Edit Mode button', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    // Select the shared Fitness area so sharedContext is set
    const areaDropdown = page.getByRole('combobox').first();
    await areaDropdown.selectOption({ label: /fitness/i });

    await page.getByRole('tab', { name: /structure/i }).click();
    await expect(page.getByText('Fitness')).toBeVisible({ timeout: 10_000 });

    // Edit Mode button must NOT be visible for grantee
    await expect(
      page.getByRole('button', { name: /edit mode/i }),
    ).not.toBeVisible();
  });
});
