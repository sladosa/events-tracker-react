/**
 * E15 — Revoke with events: dialog + grantee "Take your data" banner
 *
 * Setup (beforeAll):
 *   1. Owner creates data_share for userb on Fitness (write)
 *   2. UserB creates 2 Cardio events (leaf) + parent chains (Activity, Gym)
 *      — only possible while share is active (RLS)
 *
 * Tests:
 *   E15-1: Revoke shows dialog with event count when grantee has events
 *   E15-2: Revoke-only path → share removed, events become orphan
 *   E15-3: Grantee WriteGranteeBanner shows "Take your data" button
 *
 * Cleanup (afterAll):
 *   - Delete orphan userb events (owner can do this via orphan RLS after share revoke)
 *   - Attempt share cleanup (may already be gone after E15-2)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsOwner, loginAsUserB, supabasePost, supabaseDelete } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

// Hardcoded UUIDs for E15 events (avoid collisions across test runs)
const E15_EVENTS = {
  LEAF_1:    'e3000000-0000-0000-0000-000000000001',
  LEAF_2:    'e3000000-0000-0000-0000-000000000002',
  PARENT_A1: 'e3000000-0000-0000-0000-000000000003', // Activity session 1
  PARENT_G1: 'e3000000-0000-0000-0000-000000000004', // Gym session 1
  PARENT_A2: 'e3000000-0000-0000-0000-000000000005', // Activity session 2
  PARENT_G2: 'e3000000-0000-0000-0000-000000000006', // Gym session 2
};

test.describe('E15 — Revoke with events + Take your data banner', () => {
  let ownerPage: Page;
  let ownerCtx: BrowserContext;
  let userbPage: Page;
  let userbCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Setup owner session
    ownerCtx = await browser.newContext();
    ownerPage = await ownerCtx.newPage();
    await loginAsOwner(ownerPage);

    // Setup userb session (needed to create events via RLS)
    userbCtx = await browser.newContext();
    userbPage = await userbCtx.newPage();
    await loginAsUserB(userbPage);

    // Navigate both pages so addInitScript runs and session lands in localStorage
    await ownerPage.goto('/');
    await ownerPage.waitForLoadState('domcontentloaded');
    await userbPage.goto('/');
    await userbPage.waitForLoadState('domcontentloaded');

    // 1. Create share: owner → userb, Fitness, write
    await supabasePost(ownerPage, 'data_shares', {
      owner_id: OWNER_ID,
      grantee_id: USERB_ID,
      share_type: 'area',
      target_id: SEED.AREA_FITNESS,
      permission: 'write',
    }, 'return=minimal');

    // 2. Create userb events in Cardio (leaf) — 2 sessions
    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.LEAF_1,
      user_id: USERB_ID,
      category_id: SEED.CAT_CARDIO,
      event_date: '2030-06-01',
      session_start: '2030-06-01T08:00:00+00:00',
    }, 'return=minimal');

    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.LEAF_2,
      user_id: USERB_ID,
      category_id: SEED.CAT_CARDIO,
      event_date: '2030-06-02',
      session_start: '2030-06-02T08:00:00+00:00',
    }, 'return=minimal');

    // Parent chain session 1 (Activity + Gym)
    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.PARENT_A1,
      user_id: USERB_ID,
      category_id: SEED.CAT_ACTIVITY,
      event_date: '2030-06-01',
      session_start: '2030-06-01T08:00:00+00:00',
      chain_key: SEED.CAT_CARDIO,
    }, 'return=minimal');
    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.PARENT_G1,
      user_id: USERB_ID,
      category_id: SEED.CAT_GYM,
      event_date: '2030-06-01',
      session_start: '2030-06-01T08:00:00+00:00',
      chain_key: SEED.CAT_CARDIO,
    }, 'return=minimal');

    // Parent chain session 2
    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.PARENT_A2,
      user_id: USERB_ID,
      category_id: SEED.CAT_ACTIVITY,
      event_date: '2030-06-02',
      session_start: '2030-06-02T08:00:00+00:00',
      chain_key: SEED.CAT_CARDIO,
    }, 'return=minimal');
    await supabasePost(userbPage, 'events', {
      id: E15_EVENTS.PARENT_G2,
      user_id: USERB_ID,
      category_id: SEED.CAT_GYM,
      event_date: '2030-06-02',
      session_start: '2030-06-02T08:00:00+00:00',
      chain_key: SEED.CAT_CARDIO,
    }, 'return=minimal');
  });

  test.afterAll(async () => {
    // Clean up events — owner can delete orphan events (020_orphan_rls.sql policy)
    const eventIds = Object.values(E15_EVENTS).join(',');
    const projectRef = new URL(process.env.VITE_SUPABASE_URL!).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    const session = await ownerPage.evaluate(
      (key: string) => { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; },
      storageKey,
    );
    if (session?.access_token) {
      await ownerPage.request.delete(
        `${process.env.VITE_SUPABASE_URL}/rest/v1/events?id=in.(${eventIds})`,
        {
          headers: {
            apikey: process.env.VITE_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: 'return=minimal',
          },
        },
      );
    }
    // Share may already be gone (E15-2 revokes it), ignore error
    await supabaseDelete(ownerPage, 'data_shares', { owner_id: OWNER_ID, grantee_id: USERB_ID });
    await ownerCtx.close();
    await userbCtx.close();
  });

  // ── E15-1: Revoke dialog appears when grantee has events ──────────────────

  test('E15-1: Revoke shows event-count dialog when grantee has events', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Open Share modal via Structure tab → Fitness row ⋮ → Manage Access
    await page.getByRole('button', { name: 'Structure' }).click();
    await page.getByRole('button', { name: 'Table' }).click();
    const fitnessRow = page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`);
    await expect(fitnessRow).toBeVisible({ timeout: 10_000 });
    await fitnessRow.hover();
    await fitnessRow.getByRole('button').last().click();
    await page.getByRole('button', { name: /manage access/i }).click();
    await expect(page.getByRole('heading', { name: /share.*fitness/i })).toBeVisible({ timeout: 8_000 });

    // Click Revoke for userb — should show dialog (not immediate revoke)
    await page.getByRole('button', { name: /revoke/i }).first().click();

    // Dialog must appear with event count and 3 radio options
    await expect(page.getByText(/has.*events in this area/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/revoke only/i)).toBeVisible();
    await expect(page.getByText(/claim events/i)).toBeVisible();
    await expect(page.getByText(/delete events/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /confirm revoke/i })).toBeVisible();

    // Cancel — do NOT revoke yet (preserve state for E15-2 and E15-3)
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await expect(page.getByText(/has.*events in this area/i)).not.toBeVisible({ timeout: 5_000 });
    // Share is still active
    await expect(page.getByText(process.env.PLAYWRIGHT_TEST_EMAIL_B!)).toBeVisible();
  });

  // ── E15-3: Grantee sees "Take your data" button on WriteGranteeBanner ────

  test('E15-3: Write grantee sees "Take your data" button on the shared area banner', async ({ page }) => {
    await loginAsUserB(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Select Fitness area — grantee should see the green WriteGranteeBanner
    const areaSelect = page.locator('select').filter({ has: page.locator('option[value=""]', { hasText: 'All Areas' }) });
    await areaSelect.waitFor({ state: 'visible', timeout: 10_000 });
    await areaSelect.selectOption(SEED.AREA_FITNESS);

    // WriteGranteeBanner (green) with "Take your data" button
    await expect(page.getByRole('button', { name: /take your data/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/your events are stored in/i)).toBeVisible();
  });

  // ── E15-2: Revoke-only path removes share, events become orphan ───────────

  test('E15-2: Revoke-only: share removed, orphan banner appears for owner', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Open Share modal
    await page.getByRole('button', { name: 'Structure' }).click();
    await page.getByRole('button', { name: 'Table' }).click();
    const fitnessRow = page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`);
    await expect(fitnessRow).toBeVisible({ timeout: 10_000 });
    await fitnessRow.hover();
    await fitnessRow.getByRole('button').last().click();
    await page.getByRole('button', { name: /manage access/i }).click();
    await expect(page.getByRole('heading', { name: /share.*fitness/i })).toBeVisible({ timeout: 8_000 });

    // Revoke → dialog
    await page.getByRole('button', { name: /revoke/i }).first().click();
    await expect(page.getByText(/has.*events in this area/i)).toBeVisible({ timeout: 10_000 });

    // Default is "Revoke only" — confirm
    await expect(page.locator('input[name="revokeAction"][value="revoke_only"]')).toBeChecked();
    await page.getByRole('button', { name: /confirm revoke/i }).click();

    // Toast confirmation
    await expect(page.getByText(/access revoked/i)).toBeVisible({ timeout: 8_000 });

    // Modal now shows no active shares
    await expect(page.getByText(/no active shares/i)).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Close' }).first().click();

    // Activities tab → OrphanBanner should appear (userb events now orphaned)
    await page.getByRole('button', { name: 'Activities' }).click();
    await expect(page.getByText(/no longer ha.*access/i)).toBeVisible({ timeout: 15_000 });
  });
});
