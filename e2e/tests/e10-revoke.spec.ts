/**
 * E10 — Revoke access
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

test.describe('E10 — Revoke access', () => {
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
      target_id: SEED.AREA_FITNESS,
      permission: 'write',
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    await supabaseDelete(ownerPage, 'data_shares', { owner_id: OWNER_ID, grantee_id: USERB_ID });
    await ownerCtx.close();
  });

  test('E10-1: before revoke — userb sees Fitness area', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    const areaSelect = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(areaSelect.locator(`option[value="${SEED.AREA_FITNESS}"]`))
      .toHaveCount(1, { timeout: 10_000 });
  });

  test('E10-2: owner revokes access via Share modal', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Structure tab → Table view → Fitness row ⋮ → Manage Access
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Table' }).click();

    const fitnessRow = page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`);
    await expect(fitnessRow).toBeVisible({ timeout: 10_000 });
    await fitnessRow.hover();
    await fitnessRow.getByRole('button').last().click();
    await page.getByRole('button', { name: /manage access/i }).click();

    // Modal is a plain <div> — identified by heading
    await expect(page.getByRole('heading', { name: /share.*fitness/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!, { exact: true })).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /revoke/i }).first().click();
    await expect(page.getByText(/access revoked/i)).toBeVisible({ timeout: 8_000 });
  });

  test('E10-3: after revoke — userb no longer sees Fitness area', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    const areaSelect = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(areaSelect.locator(`option[value="${SEED.AREA_FITNESS}"]`))
      .toHaveCount(0, { timeout: 10_000 });
  });
});
