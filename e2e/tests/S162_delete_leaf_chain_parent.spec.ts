/**
 * T-S162-4 — Structure Delete leafa mora obrisati i P2 RODITELJSKE evente lanca
 *
 * Nađeno u ručnom T-S162-3 (05.10.2026., TEST): nov leaf `Medical > S162 probe`,
 * jedan redak kroz Add, pa Structure → Delete. Modal je obrisao leaf event, a
 * kategoriju NIJE: „Some records could not be removed".
 * Uzrok: Add uz leaf event upiše i roditeljski event na `Medical` s
 * `chain_key = <leaf>` (P2). Event živi IZVAN brisanog podstabla, pa ga
 * `cascadeDelete` (traži samo `category_id ∈ podstablo`) ne vidi — a FK
 * `events.chain_key → categories` brani brisanje kategorije.
 * Brisanje AKTIVNOSTI to zna od S104 (`category_id OR chain_key`); Structure
 * brisanje nije znalo.
 *
 * Scenarij: nov leaf pod Gym + leaf event + roditeljski eventi na Gym i
 * Activity (chain_key = nov leaf). Delete kroz UI ⇒ kategorija i SVA TRI eventa
 * nestaju; Cardio lanac (seed) ostaje netaknut.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, supabasePost, supabaseDelete } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const LEAF_ID = 'c1620000-0000-0000-0000-000000000001';
const EVENT_DATE = '2031-04-11';
const SESSION_START = '2031-04-11T09:00:00+00:00';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

/** ⋮ → stavka (obrazac iz e5/S133: refetch zna zatvoriti tek otvoren meni). */
async function clickRowMenuItem(page: Page, row: Locator, item: RegExp): Promise<void> {
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const actionsBtn = row.getByRole('button', { name: /actions/i });
  for (let attempt = 0; attempt < 3; attempt++) {
    await actionsBtn.click();
    const menuItem = page.getByRole('button', { name: item });
    try {
      await menuItem.waitFor({ state: 'visible', timeout: 1_500 });
      await menuItem.click();
      return;
    } catch { /* meni zatvoren — pokušaj opet */ }
  }
  throw new Error(`Stavka ${item} se nikad nije pojavila u ⋮ meniju`);
}

async function cleanup(page: Page): Promise<void> {
  await supabaseDelete(page, 'events', { chain_key: LEAF_ID });
  await supabaseDelete(page, 'events', { category_id: LEAF_ID });
  await supabaseDelete(page, 'categories', { id: LEAF_ID });
}

test.describe('T-S162-4 — Structure Delete i P2 roditeljski eventi', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 20_000 });
    await cleanup(page);   // ostatak prekinutog runa (fiksni ID-jevi)

    await supabasePost(page, 'categories', {
      id: LEAF_ID, user_id: OWNER_ID, area_id: SEED.AREA_FITNESS,
      parent_category_id: SEED.CAT_GYM, name: 'S162 chain leaf', slug: 's162_chain_leaf',
      level: 3, sort_order: 90,
    });
    await supabasePost(page, 'events', {
      user_id: OWNER_ID, category_id: LEAF_ID,
      event_date: EVENT_DATE, session_start: SESSION_START, created_at: SESSION_START,
      comment: 'T-S162-4 leaf',
    });
    for (const parent of [SEED.CAT_GYM, SEED.CAT_ACTIVITY]) {
      await supabasePost(page, 'events', {
        user_id: OWNER_ID, category_id: parent,
        event_date: EVENT_DATE, session_start: SESSION_START, created_at: SESSION_START,
        chain_key: LEAF_ID,
      });
    }
  });

  test.afterEach(async ({ page }) => { await cleanup(page); });

  test('T-S162-4: Delete leafa briše i roditeljske evente njegovog lanca', async ({ page }) => {
    const parentsBefore = await supabaseGet(page, 'events', { chain_key: LEAF_ID }, 'id');
    expect(parentsBefore.length, 'seed: dva roditeljska eventa').toBe(2);

    await page.getByRole('button', { name: 'Structure' }).click();
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('button', { name: /edit mode/i }).click();

    const row = page.locator(`[data-testid="structure-row-${LEAF_ID}"]`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await clickRowMenuItem(page, row, /\bDelete$/);   // „🗑️ Delete“ (ikona je dio imena)

    // Leaf ima event ⇒ blokirani put s ponudom backupa; backup ovdje nije predmet.
    await page.getByRole('button', { name: /delete without backup/i }).click();

    await expect(row).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/some records could not be removed/i)).toHaveCount(0);

    expect(await supabaseGet(page, 'categories', { id: LEAF_ID }, 'id'), 'kategorija obrisana').toHaveLength(0);
    expect(await supabaseGet(page, 'events', { chain_key: LEAF_ID }, 'id'), 'roditeljski eventi obrisani').toHaveLength(0);
    expect(await supabaseGet(page, 'events', { category_id: LEAF_ID }, 'id'), 'leaf event obrisan').toHaveLength(0);
    expect(await supabaseGet(page, 'categories', { id: SEED.CAT_CARDIO }, 'id'), 'susjedni leaf netaknut').toHaveLength(1);
  });
});
