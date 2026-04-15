/**
 * Filter selection helpers for Playwright E2E tests.
 *
 * The ProgressiveCategorySelector renders:
 *   combobox[0] = ⚡ Shortcuts
 *   combobox[1] = Area  (label: "Area")
 *   combobox[2] = Category  ← single select, options reload on each pick
 *
 * Seed data UUIDs (owner@test.com):
 *   Fitness area    a1000000-0000-0000-0000-000000000001
 *   Financije area  a1000000-0000-0000-0000-000000000002
 *   Activity (L1)   c1000000-0000-0000-0000-000000000001
 *   Gym      (L2)   c1000000-0000-0000-0000-000000000002
 *   Strength (L3)   c1000000-0000-0000-0000-000000000003  ← leaf, no events
 *   Cardio   (L3)   c1000000-0000-0000-0000-000000000004  ← leaf, HAS events
 */

import type { Page } from '@playwright/test';

export const SEED = {
  AREA_FITNESS:   'a1000000-0000-0000-0000-000000000001',
  AREA_FINANCIJE: 'a1000000-0000-0000-0000-000000000002',
  CAT_ACTIVITY:   'c1000000-0000-0000-0000-000000000001',
  CAT_GYM:        'c1000000-0000-0000-0000-000000000002',
  CAT_STRENGTH:   'c1000000-0000-0000-0000-000000000003',
  CAT_CARDIO:     'c1000000-0000-0000-0000-000000000004',
} as const;

/**
 * Select area and drill down through category levels.
 *
 * @param page       Playwright Page
 * @param areaId     Area UUID from SEED
 * @param categoryIds Category UUIDs to drill through in order (L1 → L2 → ... → leaf)
 */
export async function selectFilterPath(
  page: Page,
  areaId: string,
  categoryIds: string[] = [],
): Promise<void> {
  // Identify the Area select by its fixed "All Areas" default option.
  // This is more robust than nth() which depends on order of other selects.
  const areaSelect = page.locator('select').filter({
    has: page.locator('option[value=""]', { hasText: 'All Areas' }),
  });
  await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
  await areaSelect.selectOption(areaId);

  // Category select: identified by its "All Categories" or "Select..." default option.
  // It's a single select that reloads options after each pick.
  const catSelect = page.locator('select').filter({
    has: page.locator('option[value=""]'),
  }).last();

  for (const catId of categoryIds) {
    // Wait for the specific option to appear (async after each selection)
    await page.locator(`select option[value="${catId}"]`).waitFor({ state: 'attached', timeout: 10_000 });
    await catSelect.selectOption(catId);
  }
}
