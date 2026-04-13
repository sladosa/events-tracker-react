/**
 * E10 — Revoke access
 *
 * After revoke:
 *   - userb@test.com no longer sees Fitness area in their dropdown
 *
 * This test creates a share, verifies grantee sees it, owner revokes it,
 * then verifies grantee no longer sees the area.
 *
 * Note: uses two separate browser contexts (owner + grantee) sequentially.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';
const FITNESS_AREA_ID = 'a1000000-0000-0000-0000-000000000001';

test.describe('E10 — Revoke access', () => {
  let ownerPage: Page;
  let ownerCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Create a write share as the owner (programmatically)
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
      permission: 'write',
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    // Ensure cleanup even if test fails
    await supabaseDelete(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
    });
    await ownerCtx.close();
  });

  test('E10-1: before revoke — userb sees Fitness area', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    const areaDropdown = page.getByRole('combobox').first();
    const options = await areaDropdown.locator('option').allTextContents();
    expect(options.some(o => /fitness/i.test(o))).toBeTruthy();
  });

  test('E10-2: owner revokes access via Share modal', async ({ page }) => {
    // Use fresh owner page for UI test
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    // Open Manage Access modal via Structure tab
    await page.getByRole('tab', { name: /structure/i }).click();
    await expect(page.getByText('Fitness')).toBeVisible({ timeout: 10_000 });

    const fitnessRow = page.locator('tr, [data-testid*="row"]').filter({ hasText: /^fitness$/i }).first();
    await fitnessRow.hover();
    await fitnessRow.getByRole('button', { name: /menu|options|⋮|more/i }).first().click();
    await page.getByRole('menuitem', { name: /manage access/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });

    // userb should be in Active access list — click Revoke
    await expect(
      page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!),
    ).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /revoke/i }).first().click();

    await expect(page.getByText(/access revoked/i)).toBeVisible({ timeout: 8_000 });
  });

  test('E10-3: after revoke — userb no longer sees Fitness area', async ({ page }) => {
    // Wait a moment for the revoke to propagate (RLS is immediate on Supabase)
    await page.waitForTimeout(1_000);

    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });

    const areaDropdown = page.getByRole('combobox').first();
    const options = await areaDropdown.locator('option').allTextContents();

    // Fitness should no longer be available to userb
    expect(options.some(o => /^fitness$/i.test(o.trim()))).toBeFalsy();
  });
});
