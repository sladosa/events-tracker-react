/**
 * E13 — Add Category Between + Collapse Level
 *
 * Preconditions (seed data):
 *   - Fitness area contains: Activity (L1) > Gym (L2) > [Strength (L3), Cardio (L3)]
 *   - Gym is non-leaf (has children) so "Add Between" and "Collapse Level" appear in its ⋮ menu
 *   - SEED.CAT_GYM = c1000000-0000-0000-0000-000000000002
 *
 * Tests:
 *   E13-1: Add Between on Gym → inserts "Mid Level" between Gym and its children
 *   E13-2: Collapse Level on Mid Level → removes it, children move back to Gym
 *
 * The tests run in serial order (E13-2 consumes the state created by E13-1).
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, supabaseDelete } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const MID_LEVEL_SLUG = 'mid_level';
const MID_LEVEL_NAME = 'Mid Level';

// ── Cleanup helper ───────────────────────────────────────────────────────────
// Deletes Mid Level category (if it exists) and restores Strength + Cardio
// back to Gym as their parent_category_id.

async function cleanupMidLevel(page: import('@playwright/test').Page) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const session = await page.evaluate(
    (key: string) => { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; },
    storageKey,
  );
  if (!session?.access_token) return;

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  // Find Mid Level category
  const midLevels = await supabaseGet(page, 'categories', {
    slug: MID_LEVEL_SLUG,
    area_id: SEED.AREA_FITNESS,
  }, 'id') as Array<{ id: string }>;

  if (midLevels.length === 0) return;

  const midId = midLevels[0].id;

  // Find children of Mid Level (Strength and Cardio may now point to it)
  const midChildren = await supabaseGet(page, 'categories', {
    area_id: SEED.AREA_FITNESS,
  }, 'id,parent_category_id') as Array<{ id: string; parent_category_id: string }>;

  const needsReparent = midChildren.filter(c => c.parent_category_id === midId);

  // Re-parent them back to Gym and restore level to 3
  for (const child of needsReparent) {
    await page.request.patch(
      `${SUPABASE_URL}/rest/v1/categories?id=eq.${child.id}`,
      {
        headers,
        data: { parent_category_id: SEED.CAT_GYM, level: 3 },
      },
    );
  }

  // Delete Mid Level's parent events (should be empty, but clean up anyway)
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/events?category_id=eq.${midId}`,
    { headers },
  );

  // Delete Mid Level category
  await supabaseDelete(page, 'categories', { id: midId });
}

// ── Navigate to Structure tab, Mine segment ──────────────────────────────────

async function goToStructure(page: import('@playwright/test').Page) {
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Structure' }).click();
  await expect(page.getByText('Mine')).toBeVisible({ timeout: 8_000 });
}

// ── Open the ⋮ menu for a specific category row ──────────────────────────────

async function openRowMenu(page: import('@playwright/test').Page, categoryId: string) {
  const row = page.locator(`[data-testid="structure-row-${categoryId}"]`);
  await expect(row).toBeVisible({ timeout: 8_000 });
  await row.getByRole('button', { name: 'Actions' }).click();
}

// ============================================================================

test.describe.serial('E13 — Add Between + Collapse Level', () => {

  test.beforeAll(async ({ browser }) => {
    // Clean up any leftover state from previous runs
    const page = await browser.newPage();
    await loginAsOwner(page);
    await page.goto('/app');
    await cleanupMidLevel(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    // Safety cleanup in case a test left Mid Level behind
    const page = await browser.newPage();
    await loginAsOwner(page);
    await page.goto('/app');
    await cleanupMidLevel(page);
    await page.close();
  });

  // ── E13-1: Add Between ────────────────────────────────────────────────────

  test('E13-1: Add Between on Gym inserts Mid Level between Gym and its children', async ({ page }) => {
    await loginAsOwner(page);
    await goToStructure(page);

    // Enter Edit Mode
    await page.getByRole('button', { name: /edit mode/i }).click();
    await expect(page.getByRole('button', { name: /exit edit/i })).toBeVisible({ timeout: 5_000 });

    // Open ⋮ menu on Gym row
    await openRowMenu(page, SEED.CAT_GYM);

    // Click Add Between
    await page.getByRole('button', { name: /add between/i }).click();
    await expect(page.getByText('↕️ Add Category Between')).toBeVisible({ timeout: 5_000 });

    // Info box should mention Gym and 2 children
    await expect(page.getByText(/between Gym/i)).toBeVisible();

    // Type the new name
    await page.getByPlaceholder(/upper body/i).fill(MID_LEVEL_NAME);

    // Slug preview should update
    await expect(page.getByText(MID_LEVEL_SLUG)).toBeVisible();

    // Click Insert Level
    await page.getByRole('button', { name: /insert level/i }).click();

    // Panel should close and Mid Level row should appear
    await expect(page.getByText('↕️ Add Category Between')).not.toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(new RegExp(`Fitness.*Activity.*Gym.*${MID_LEVEL_NAME}`, 'i'))
        .or(page.locator('[data-testid]').filter({ hasText: MID_LEVEL_NAME })),
    ).toBeVisible({ timeout: 10_000 });

    // Verify Strength is still visible (now under Mid Level)
    await expect(page.getByText(/Strength/)).toBeVisible();
  });

  // ── E13-2: Collapse Level ─────────────────────────────────────────────────

  test('E13-2: Collapse Level on Mid Level removes it and children move back to Gym', async ({ page }) => {
    await loginAsOwner(page);
    await goToStructure(page);

    // Enter Edit Mode
    await page.getByRole('button', { name: /edit mode/i }).click();
    await expect(page.getByRole('button', { name: /exit edit/i })).toBeVisible({ timeout: 5_000 });

    // Mid Level node should be visible — find it by text in the structure table
    const midLevelRows = await supabaseGet(page, 'categories', {
      slug: MID_LEVEL_SLUG,
      area_id: SEED.AREA_FITNESS,
    }, 'id') as Array<{ id: string }>;

    expect(midLevelRows.length).toBe(1);
    const midId = midLevelRows[0].id;

    // Open ⋮ menu on Mid Level row
    await openRowMenu(page, midId);

    // Click Collapse Level
    await page.getByRole('button', { name: /collapse level/i }).click();
    await expect(page.getByText('↑ Collapse Level')).toBeVisible({ timeout: 5_000 });

    // Modal should describe what will happen
    await expect(page.getByText(/Removing.*Mid Level/i)).toBeVisible();
    await expect(page.getByText(/children.*move up.*Gym/i)).toBeVisible();

    // Confirm collapse
    await page.getByRole('button', { name: /^Collapse Level$/i }).click();

    // Modal should close
    await expect(page.getByText('↑ Collapse Level')).not.toBeVisible({ timeout: 10_000 });

    // Mid Level row should be gone
    await expect(
      page.locator(`[data-testid="structure-row-${midId}"]`),
    ).not.toBeVisible({ timeout: 10_000 });

    // Strength should still be visible (now back under Gym)
    await expect(page.getByText(/Strength/)).toBeVisible();

    // Verify in DB: Mid Level is deleted
    const remaining = await supabaseGet(page, 'categories', {
      slug: MID_LEVEL_SLUG,
      area_id: SEED.AREA_FITNESS,
    }, 'id') as Array<{ id: string }>;
    expect(remaining.length).toBe(0);

    // Verify Strength parent is back to Gym
    const strengthRows = await supabaseGet(page, 'categories', {
      id: SEED.CAT_STRENGTH,
    }, 'parent_category_id') as Array<{ parent_category_id: string }>;
    expect(strengthRows[0].parent_category_id).toBe(SEED.CAT_GYM);
  });
});
