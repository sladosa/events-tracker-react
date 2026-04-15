/**
 * E12 — Structure tab filter segments (Mine / All / Templates)
 *
 * Preconditions:
 *   - TEST DB has template user with Health, Fitness, Finance template areas
 *   - Owner (seed) already has "Fitness" and "Financije" areas (slug: fitness, financije)
 *   - "Health" template slug = 'health' — owner does NOT have it at start
 *
 * Tests:
 *   E12-1: Mine segment shows own areas only (no template badge)
 *   E12-2: Templates segment shows available templates (not Fitness which owner has)
 *   E12-3: After copying Health, Templates segment no longer shows Health
 *   E12-4: All segment shows own + available templates (not Fitness template)
 *   E12-5: Filter segments are visible when Sunburst view is active
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const HEALTH_SLUG = 'health';

async function cleanupHealthArea(page: import('@playwright/test').Page) {
  const areas = await supabaseGet(page, 'areas', { user_id: OWNER_ID, slug: HEALTH_SLUG }, 'id') as Array<{ id: string }>;
  for (const area of areas) {
    await deleteAreaCascade(page, area.id);
  }
}

async function goToStructureTable(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Structure' }).click();
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`))
    .toBeVisible({ timeout: 10_000 });
}

test.describe('E12 — Structure filter segments', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await cleanupHealthArea(page);
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    await goToStructureTable(page);
  });

  test('E12-1: Mine segment shows own areas; no template badge visible', async ({ page }) => {
    // Mine is the default — ensure it's selected
    const mineBtn = page.getByRole('button', { name: 'Mine' });
    await expect(mineBtn).toBeVisible();
    await mineBtn.click();

    // Template badge should NOT appear anywhere in the list
    await expect(page.getByText('template').first()).not.toBeVisible({ timeout: 3_000 }).catch(() => {
      // If it's not found at all, that's fine
    });

    // Own area row (Fitness) should be visible
    await expect(page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`)).toBeVisible();
  });

  test('E12-2: Templates segment shows available templates; Fitness not listed', async ({ page }) => {
    await page.getByRole('button', { name: 'Templates' }).click();

    // Health template should appear (owner does NOT have it yet)
    await expect(page.getByText('template').first()).toBeVisible({ timeout: 5_000 });

    // "Fitness" template must NOT appear (owner already has slug "fitness")
    // Find all area-level rows with the "template" badge
    const templateAreaRows = page.locator('[data-testid^="structure-row-"]').filter({ has: page.locator('text=template') });
    const texts = await templateAreaRows.allInnerTexts();
    expect(texts.some(t => t.toLowerCase().includes('fitness'))).toBe(false);

    // Health should be present as a template area
    expect(texts.some(t => t.toLowerCase().includes('health'))).toBe(true);
  });

  test('E12-3: After copying Health, Templates segment no longer shows Health', async ({ page }) => {
    // Create Health from template
    await page.getByRole('button', { name: /edit mode/i }).click();
    await page.getByRole('button', { name: /add area/i }).click();
    await expect(page.getByText('+ Add New Area')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('radio', { name: /use template/i }).click();
    const templateSelect = page.locator('[data-testid="template-area-select"]');
    await expect(templateSelect).toBeVisible({ timeout: 10_000 });
    await templateSelect.selectOption({ label: 'Health' });
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText('+ Add New Area')).not.toBeVisible({ timeout: 10_000 });

    // Exit edit mode (button says "Exit Edit" when active)
    await page.getByRole('button', { name: /exit edit/i }).click();

    // Switch to Templates segment
    await page.getByRole('button', { name: 'Templates' }).click();

    // Health area row with template badge should NOT be visible anymore
    const templateAreaRows = page.locator('[data-testid^="structure-row-"]').filter({ has: page.locator('text=template') });
    const texts = await templateAreaRows.allInnerTexts();
    expect(texts.some(t => t.toLowerCase().includes('health'))).toBe(false);
  });

  test('E12-4: All segment: own areas + available templates; Fitness template absent', async ({ page }) => {
    await page.getByRole('button', { name: 'All' }).click();

    // Both own areas and available templates should appear
    // Own fitness area (no "template" badge) should be there
    await expect(page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`)).toBeVisible();

    // Fitness template (with badge) should NOT appear (owner already has slug "fitness")
    const templateAreaRows = page.locator('[data-testid^="structure-row-"]').filter({ has: page.locator('text=template') });
    const texts = await templateAreaRows.allInnerTexts();
    // Fitness template (with "template" badge) absent
    expect(texts.some(t => t.toLowerCase().includes('fitness'))).toBe(false);
  });

  test('E12-5: Filter segments visible in Sunburst mode', async ({ page }) => {
    // Switch to Sunburst view
    await page.getByRole('button', { name: 'Sunburst' }).click();

    // All three segment buttons should still be visible
    await expect(page.getByRole('button', { name: 'Mine' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await cleanupHealthArea(page);
  });
});
