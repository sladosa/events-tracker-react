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
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

async function openManageAccessModal(page: import('@playwright/test').Page) {
  // Structure tab → switch to Table view → ⋮ menu on Fitness area → Manage Access
  await page.getByRole('button', { name: 'Structure' }).click();
  await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Table' }).click();

  // Wait for Fitness seed area row (identified by data-testid)
  const fitnessRow = page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`);
  await expect(fitnessRow).toBeVisible({ timeout: 10_000 });
  await fitnessRow.hover();
  // ⋮ action button has only an img inside (no text) — last button in the row
  await fitnessRow.getByRole('button').last().click();
  // Dropdown items are plain buttons, not menuitem role
  await page.getByRole('button', { name: /manage access/i }).click();

  // Modal identified by its heading (no role="dialog" on container)
  await expect(page.getByRole('heading', { name: /share.*fitness/i })).toBeVisible({ timeout: 8_000 });
}

test.describe('E7 — Share Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
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

    // Email invitation modal appears — dismiss it to proceed
    await expect(page.getByRole('button', { name: /dismiss/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /dismiss/i }).click();

    // /!\ NE ocekuj toast Access granted -- nikad nije ni postojao na ovom putu.
    //     `handleInvite` na uspjehu ne zove `toast.success` nego otvara messageBox s
    //     tekstom pozivnice za kopiranje (ShareManagementModal.tsx:122-140). Tvrdnja je
    //     ostala iz dizajna PRIJE messageBoxa -- isti spec dva retka iznad taj messageBox
    //     vec odbacuje. Vodila se kao bug E7-2/E7-3, tj. kao izostanak poruke.
    //     Izmjereno S139: stringa nema u `src/`, i uspjesan put nema nijedan toast.

    // userb@test.com now listed in Active access
    // Use exact:true to avoid strict mode conflict with other occurrences of the same address
    await expect(
      page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!, { exact: true }),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /revoke/i }).first()).toBeVisible();
  });

  test('E7-3: Revoke access → user removed from Active access list', async ({ page }) => {
    await openManageAccessModal(page);
    await page.getByPlaceholder(/email@example\.com/i).fill(process.env.PLAYWRIGHT_TEST_EMAIL_B!);
    await page.getByRole('button', { name: /^invite$/i }).click();

    // Email invitation modal appears — dismiss it
    await expect(page.getByRole('button', { name: /dismiss/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /dismiss/i }).click();

    // /!\ NE ocekuj toast Access granted -- nikad nije ni postojao na ovom putu.
    //     `handleInvite` na uspjehu ne zove `toast.success` nego otvara messageBox s
    //     tekstom pozivnice za kopiranje (ShareManagementModal.tsx:122-140). Tvrdnja je
    //     ostala iz dizajna PRIJE messageBoxa -- isti spec dva retka iznad taj messageBox
    //     vec odbacuje. Vodila se kao bug E7-2/E7-3, tj. kao izostanak poruke.
    //     Izmjereno S139: stringa nema u `src/`, i uspjesan put nema nijedan toast.

    // /!\ ISPRAVAK VLASTITE TVRDNJE (S139). Ovdje je najprije stajalo da je E7-3
    //     "poceo padati" zbog maknute tvrdnje o toastu, koja je usput sluzila kao
    //     tocka sinkronizacije. To je bila HIPOTEZA napisana kao nalaz, i mjerenje
    //     ju je opovrglo: pustena je verzija speca od PRIJE sesije
    //     (`git show fd07840:e2e/tests/e7-share.spec.ts`) i ona pada DVA testa
    //     (E7-2 i E7-3), dok ova pada JEDAN (E7-3).
    //     => E7-3 je padao i prije ikakve izmjene -- nije regresija; a uklanjanje
    //        fantomske tvrdnje je E7-2 popravilo.
    //     Cekanje ispod OSTAJE, ali kao ono sto jest: klik na gumb koji jos ne
    //     postoji nije provjera nego utrka. Ono NE popravlja E7-3 i ne smije se
    //     tako citati -- uzrok E7-3 je i dalje neutvrdjen (v. CLAUDE.md Open bugs).
    const revokeBtn = page.getByRole('button', { name: /revoke/i }).first();
    await expect(revokeBtn).toBeVisible({ timeout: 8_000 });

    // Now revoke
    await revokeBtn.click();

    // Revoke confirmation dialog appears — confirm it
    await expect(page.getByRole('button', { name: /confirm revoke/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /confirm revoke/i }).click();

    // Toast: "Access revoked for ..."
    await expect(page.getByText(/revoked/i)).toBeVisible({ timeout: 8_000 });

    // No active shares remain — Revoke button gone is the reliable indicator
    // (email text still appears in toasts, so we check button absence instead)
    await expect(page.getByRole('button', { name: /revoke/i })).not.toBeVisible({ timeout: 5_000 });
  });

  test.afterEach(async ({ page }) => {
    await supabaseDelete(page, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
    });
    await supabaseDelete(page, 'share_invites', {
      owner_id: OWNER_ID,
    });
  });
});
