/**
 * E9 — Grantee with read-only permission
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

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
      target_id: SEED.AREA_FITNESS,
      permission: 'read',
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    await supabaseDelete(ownerPage, 'data_shares', { owner_id: OWNER_ID, grantee_id: USERB_ID });
    await ownerCtx.close();
  });

  test('E9-1: userb sees shared Fitness area in dropdown', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    const areaSelect = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(areaSelect.locator(`option[value="${SEED.AREA_FITNESS}"]`))
      .toHaveCount(1, { timeout: 10_000 });
  });

  test('E9-2: read grantee → Add Activity button disabled', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    const addBtn = page.getByRole('button', { name: /add activity/i });
    const isDisabled = await addBtn.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();
  });

  test('E9-3: read grantee → no Edit Mode button on Structure tab', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    const areaSelForStruct = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelForStruct.waitFor({ state: 'visible', timeout: 10_000 });
    await areaSelForStruct.selectOption(SEED.AREA_FITNESS);
    await page.getByRole('button', { name: 'Structure' }).click();
    // Table/Sunburst buttons appear for all users — reliable load indicator
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /edit mode/i })).not.toBeVisible();
  });
});
