/**
 * E8 — Grantee with write permission
 *
 * Setup: creates write share programmatically before tests.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

test.describe('E8 — Grantee write access', () => {
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
    await supabaseDelete(ownerPage, 'events', { user_id: USERB_ID });
    await ownerCtx.close();
  });

  test('E8-1: userb sees shared Fitness area in dropdown', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Check that the shared Fitness area option (by UUID) exists in the Area dropdown
    const areaSelect = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(areaSelect.locator(`option[value="${SEED.AREA_FITNESS}"]`))
      .toHaveCount(1, { timeout: 10_000 });
  });

  test('E8-2: userb can navigate to Add Activity (no lock screen)', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    const catSelect = page.locator('select').filter({
      has: page.locator('option[value=""]'),
    }).last();
    await expect(catSelect).not.toBeDisabled({ timeout: 5_000 });
    await addBtn.click();

    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });
    await expect(page.getByText(/read.only|no write permission|locked/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /finish|save/i }).first()).toBeVisible({ timeout: 8_000 });
  });
});
