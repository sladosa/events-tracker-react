/**
 * T-S104-2 — Shared upsertParentEvent() (Fable I.2, S104 unification)
 *
 * Originally scoped as a unit test, but this repo has no unit-test runner
 * (Playwright E2E against real TEST Supabase is the only test tooling here —
 * see docs/PLAYWRIGHT_E2E_GUIDE.md). Converted to E2E per session decision.
 *
 * Verifies the shared parentEventLoader.upsertParentEvent(), now used by both
 * AddActivityPage and EditActivityPage:
 *   1. P2 anchor: Add Activity on Strength (no attribute_definitions seeded on
 *      Gym/Activity in this TEST project) still creates Gym + Activity parent
 *      events with the correct chain_key — the anchor is created even with 0 attrs.
 *   2. Upsert-not-duplicate: Edit Activity (re-saving the same session) must
 *      UPDATE the existing parent events, not INSERT a second pair.
 *
 * Preconditions (seed.sql): Fitness > Activity > Gym > Strength (leaf, no events)
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('T-S104-2 — Shared parent-event upsert (anchor + no-duplicate)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  });

  test('T-S104-2: Add creates P2 anchor parents; Edit updates them without duplicating', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    // ── Add Activity ──
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    const catSelect = page.locator('select').filter({
      has: page.locator('option[value=""]'),
    }).last();
    await expect(catSelect).not.toBeDisabled({ timeout: 5_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    await page.getByPlaceholder(/felt strong today/i).fill('T-S104-2 add note');
    const finishBtn = page.getByRole('button', { name: /finish/i }).first();
    await expect(finishBtn).not.toBeDisabled({ timeout: 5_000 });
    await finishBtn.click();
    await page.getByRole('button', { name: /go to home/i }).click();
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });

    // ── Verify P2 anchor: Gym + Activity parent events exist, chain_key = Strength ──
    const leafEvents = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_STRENGTH }, 'id,session_start');
    expect(leafEvents.length).toBeGreaterThan(0);
    const sessionStart = (leafEvents[leafEvents.length - 1] as { session_start: string }).session_start;

    const gymParentsAfterAdd = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_GYM, chain_key: SEED.CAT_STRENGTH, session_start: sessionStart }, 'id');
    expect(gymParentsAfterAdd).toHaveLength(1);

    const activityParentsAfterAdd = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_ACTIVITY, chain_key: SEED.CAT_STRENGTH, session_start: sessionStart }, 'id');
    expect(activityParentsAfterAdd).toHaveLength(1);

    const gymParentId = (gymParentsAfterAdd[0] as { id: string }).id;
    const activityParentId = (activityParentsAfterAdd[0] as { id: string }).id;

    // ── Edit Activity: change the note, save again ──
    const row = page.locator('tr').filter({ hasText: 'T-S104-2 add note' }).first();
    await row.hover();
    await row.locator('td').last().getByRole('button').click();
    await page.getByRole('button', { name: /edit/i }).click();
    await expect(page).toHaveURL(/\/app\/edit/, { timeout: 10_000 });

    await page.getByPlaceholder(/felt strong today/i).fill('T-S104-2 edited note');
    const saveBtn = page.getByRole('button', { name: /save|finish/i }).first();
    await expect(saveBtn).not.toBeDisabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(page).toHaveURL(/\/app\/view/, { timeout: 15_000 });

    // ── Verify upsert, not duplicate: still exactly 1 Gym + 1 Activity parent, same IDs ──
    const gymParentsAfterEdit = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_GYM, chain_key: SEED.CAT_STRENGTH, session_start: sessionStart }, 'id');
    expect(gymParentsAfterEdit).toHaveLength(1);
    expect((gymParentsAfterEdit[0] as { id: string }).id).toBe(gymParentId);

    const activityParentsAfterEdit = await supabaseGet(page, 'events',
      { user_id: OWNER_ID, category_id: SEED.CAT_ACTIVITY, chain_key: SEED.CAT_STRENGTH, session_start: sessionStart }, 'id');
    expect(activityParentsAfterEdit).toHaveLength(1);
    expect((activityParentsAfterEdit[0] as { id: string }).id).toBe(activityParentId);
  });

  test.afterEach(async ({ page }) => {
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, category_id: SEED.CAT_STRENGTH });
    await supabaseDelete(page, 'events', { user_id: OWNER_ID, chain_key: SEED.CAT_STRENGTH });
  });
});
