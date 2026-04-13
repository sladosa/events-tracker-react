/**
 * E7 — Share Management UI
 *
 * Tests the owner's ability to invite a user via ShareManagementModal.
 *
 * Preconditions (seed.sql):
 *   - Fitness area (owner: owner@test.com)
 *   - userb@test.com exists in TEST Supabase
 *
 * Cleanup:
 *   - afterEach revokes any share/invite created for userb@test.com
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';
const FITNESS_AREA_ID = 'a1000000-0000-0000-0000-000000000001';

async function openManageAccessModal(page: import('@playwright/test').Page) {
  // Structure tab → ⋮ menu on Fitness area → Manage Access
  await page.getByRole('tab', { name: /structure/i }).click();
  await expect(page.getByText('Fitness')).toBeVisible({ timeout: 10_000 });

  // Hover over the Fitness area row to reveal the ⋮ menu button
  const fitnessRow = page.locator('tr, [data-testid*="row"]').filter({ hasText: /^fitness$/i }).first();
  await fitnessRow.hover();
  await fitnessRow.getByRole('button', { name: /menu|options|⋮|more/i }).first().click();
  await page.getByRole('menuitem', { name: /manage access/i }).click();

  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/Share "Fitness"/i)).toBeVisible();
}

test.describe('E7 — Share Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('tab', { name: /activities/i })).toBeVisible({ timeout: 15_000 });
  });

  test('E7-1: Manage Access modal opens from Structure tab ⋮ menu', async ({ page }) => {
    await openManageAccessModal(page);

    // Modal sections present
    await expect(page.getByText(/active access/i)).toBeVisible();
    await expect(page.getByText(/invite someone/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email@example\.com/i)).toBeVisible();
  });

  test('E7-2: invite existing user (userb@test.com) → appears in Active access', async ({ page }) => {
    await openManageAccessModal(page);

    await page.getByPlaceholder(/email@example\.com/i).fill(process.env.PLAYWRIGHT_TEST_EMAIL_B!);
    // Default permission is "write"
    await page.getByRole('button', { name: /^invite$/i }).click();

    // Toast: "Access granted to ..."
    await expect(page.getByText(/access granted/i)).toBeVisible({ timeout: 8_000 });

    // userb@test.com now listed in Active access
    await expect(
      page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /revoke/i }).first()).toBeVisible();
  });

  test('E7-3: Revoke access → user removed from Active access list', async ({ page }) => {
    // First create the share programmatically so we have something to revoke
    // (We do it via the UI to test the full flow)
    await openManageAccessModal(page);
    await page.getByPlaceholder(/email@example\.com/i).fill(process.env.PLAYWRIGHT_TEST_EMAIL_B!);
    await page.getByRole('button', { name: /^invite$/i }).click();
    await expect(page.getByText(/access granted/i)).toBeVisible({ timeout: 8_000 });

    // Now revoke
    await page.getByRole('button', { name: /revoke/i }).first().click();

    // Toast: "Access revoked for ..."
    await expect(page.getByText(/access revoked/i)).toBeVisible({ timeout: 8_000 });

    // userb@test.com no longer in the list (or "No active shares" shown)
    await expect(
      page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up any shares between owner and userb for Fitness area
    await supabaseDelete(page, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
    });
    await supabaseDelete(page, 'share_invites', {
      owner_id: OWNER_ID,
    });
  });
});
