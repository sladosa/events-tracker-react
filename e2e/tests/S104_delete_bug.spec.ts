/**
 * T-S104-1 — Delete Activity bug (Fable I.1)
 *
 * Bug: handleDeleteActivity() in AppHome.tsx used to delete ALL events matching
 * (session_start + user_id), ignoring category — so deleting one activity at a
 * given time also deleted any other activity chain sharing that same session_start.
 * Fix: filter by (category_id = leafCategoryId OR chain_key = leafCategoryId).
 *
 * Scenario: seed two leaf chains (Cardio + Strength, both children of Gym) at the
 * SAME session_start, each with its own Gym/Activity parent events (chain_key
 * discriminated). Delete the Cardio chain via the UI and verify only Cardio's
 * leaf + parent events are removed — Strength's chain must remain untouched.
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > {Strength, Cardio} (leaves)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, supabasePost, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

// Fixed session shared by both chains — far enough in the future to avoid any
// collision with other seed/test data.
const EVENT_DATE = '2031-03-10';
const SESSION_START = '2031-03-10T09:00:00+00:00';

test.describe('T-S104-1 — Delete Activity scopes to its own chain', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    // Must navigate to the app origin before any page.evaluate-based REST helper
    // (supabasePost/Get/Delete read the injected session from localStorage).
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    // Seed leaf + parent events for BOTH chains at the same session_start.
    // Leaf events carry no chain_key (matches AddActivityPage behaviour);
    // parent events carry chain_key = their leaf's category_id.
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_CARDIO,
      event_date: EVENT_DATE, session_start: SESSION_START,
      comment: 'T-S104-1 cardio leaf', created_at: SESSION_START,
    });
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_GYM,
      event_date: EVENT_DATE, session_start: SESSION_START,
      chain_key: SEED.CAT_CARDIO, created_at: SESSION_START,
    });
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_ACTIVITY,
      event_date: EVENT_DATE, session_start: SESSION_START,
      chain_key: SEED.CAT_CARDIO, created_at: SESSION_START,
    });

    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_STRENGTH,
      event_date: EVENT_DATE, session_start: SESSION_START,
      comment: 'T-S104-1 strength leaf', created_at: SESSION_START,
    });
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_GYM,
      event_date: EVENT_DATE, session_start: SESSION_START,
      chain_key: SEED.CAT_STRENGTH, created_at: SESSION_START,
    });
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: SEED.CAT_ACTIVITY,
      event_date: EVENT_DATE, session_start: SESSION_START,
      chain_key: SEED.CAT_STRENGTH, created_at: SESSION_START,
    });

    // Filter to Gym level so both Cardio and Strength leaf rows are visible together
    await selectFilterPath(page, SEED.AREA_FITNESS, [SEED.CAT_ACTIVITY, SEED.CAT_GYM]);
  });

  test('T-S104-1: deleting Cardio chain leaves Strength chain intact', async ({ page }) => {
    await expect(page.getByText('T-S104-1 cardio leaf').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('T-S104-1 strength leaf').first()).toBeVisible({ timeout: 10_000 });

    // Open the Cardio row's action menu → Delete Activity → confirm
    const cardioRow = page.locator('tr').filter({ hasText: 'T-S104-1 cardio leaf' }).first();
    await cardioRow.hover();
    await cardioRow.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /delete activity/i }).click();
    await page.getByRole('button', { name: /yes, delete/i }).click();

    // Cardio row gone, Strength row still present in the UI
    await expect(page.getByText('T-S104-1 cardio leaf')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText('T-S104-1 strength leaf').first()).toBeVisible();

    // Cardio chain fully removed (leaf + both parents, chain_key-scoped)
    const cardioLeafRemaining = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_CARDIO, session_start: SESSION_START });
    expect(cardioLeafRemaining).toHaveLength(0);

    const cardioParentsRemaining = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, chain_key: SEED.CAT_CARDIO, session_start: SESSION_START });
    expect(cardioParentsRemaining).toHaveLength(0);

    // Strength chain untouched (leaf + both parents still present)
    const strengthLeaf = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_STRENGTH, session_start: SESSION_START });
    expect(strengthLeaf).toHaveLength(1);

    const strengthParents = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, chain_key: SEED.CAT_STRENGTH, session_start: SESSION_START });
    expect(strengthParents).toHaveLength(2); // Gym + Activity
  });

  test.afterEach(async ({ page }) => {
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, category_id: SEED.CAT_CARDIO, session_start: SESSION_START });
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, category_id: SEED.CAT_STRENGTH, session_start: SESSION_START });
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, chain_key: SEED.CAT_CARDIO, session_start: SESSION_START });
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, chain_key: SEED.CAT_STRENGTH, session_start: SESSION_START });
  });
});
