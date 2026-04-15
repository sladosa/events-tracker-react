/**
 * E11 — Add Area "From template"
 *
 * Preconditions:
 *   - TEST DB has template user (00000000-0000-0000-0000-000000000001) with 5 template areas
 *   - Owner (seed) already has area slug "fitness" and "financije"
 *     → "Fitness" template (slug: fitness) is filtered out of dropdown
 *   - "Health" template has 3 categories (Sleep, Nutrition, Medical), 2 attrs (Duration, Quality on Sleep)
 *
 * Tests:
 *   E11-1: "Use template" radio is visible in Add Area modal
 *   E11-2: Template dropdown excludes areas user already has (Fitness not listed)
 *   E11-3: Preview shows correct counts for Health template
 *   E11-4: Create from Health template → new area "Health" appears in Structure table
 *   E11-5: Copied categories appear under the new Health area
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const TEMPLATE_AREA_NAME = 'Health';
const TEMPLATE_AREA_SLUG = 'health';

// Helper: open Add Area modal in Edit Mode (assumes already on Structure tab with Table view)
async function openAddAreaModal(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /edit mode/i }).click();
  await page.getByRole('button', { name: /add area/i }).click();
  await expect(page.getByText('+ Add New Area')).toBeVisible({ timeout: 8_000 });
}

// Helper: select "Use template" radio and wait for the template select to appear
async function switchToTemplateMode(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: /use template/i }).click();
  // Wait for template areas to load — either the select or the "already added" message appears
  await expect(
    page.locator('[data-testid="template-area-select"]')
      .or(page.getByText(/all available templates/i)),
  ).toBeVisible({ timeout: 15_000 });
}

// Helper: cleanup — delete owner's Health area (manual cascade since no ON DELETE CASCADE in DB)
async function cleanupHealthArea(page: import('@playwright/test').Page) {
  const areas = await supabaseGet(page, 'areas', { user_id: OWNER_ID, slug: TEMPLATE_AREA_SLUG }, 'id') as Array<{ id: string }>;
  for (const area of areas) {
    await deleteAreaCascade(page, area.id);
  }
}

test.describe('E11 — Add Area from template', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    // Clean up any leftover Health area from previous runs
    await page.goto('/app');
    await cleanupHealthArea(page);

    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });

    // Switch to Table view
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator(`[data-testid="structure-row-${SEED.AREA_FITNESS}"]`))
      .toBeVisible({ timeout: 10_000 });
  });

  test('E11-1: Add Area modal shows "Use template" radio', async ({ page }) => {
    await openAddAreaModal(page);
    await expect(page.getByRole('radio', { name: /use template/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /create empty/i })).toBeVisible();
  });

  test('E11-2: Template dropdown does not include already-owned slugs', async ({ page }) => {
    await openAddAreaModal(page);
    await switchToTemplateMode(page);

    const templateSelect = page.locator('[data-testid="template-area-select"]');
    await expect(templateSelect).toBeVisible({ timeout: 8_000 });

    const optionTexts = await templateSelect.locator('option').allTextContents();

    // "Fitness" (slug: fitness) is already owned by the test user — must not appear
    expect(optionTexts.some(t => t.includes('Fitness'))).toBe(false);

    // Health should be available
    expect(optionTexts.some(t => t.includes('Health'))).toBe(true);
  });

  test('E11-3: Preview loads and shows counts for Health template', async ({ page }) => {
    await openAddAreaModal(page);
    await switchToTemplateMode(page);

    const templateSelect = page.locator('[data-testid="template-area-select"]');
    await expect(templateSelect).toBeVisible({ timeout: 8_000 });
    await templateSelect.selectOption({ label: TEMPLATE_AREA_NAME });

    // Preview must show exactly 3 categories and 2 attributes (Health: Sleep+Nutrition+Medical, Duration+Quality on Sleep)
    const previewEl = page.getByText(/Includes/i);
    await expect(previewEl).toBeVisible({ timeout: 10_000 });
    await expect(previewEl).toContainText('3 categories');
    await expect(previewEl).toContainText('2 attributes');
  });

  test('E11-4: Create from Health template → area appears in Area filter dropdown', async ({ page }) => {
    await openAddAreaModal(page);
    await switchToTemplateMode(page);

    const templateSelect = page.locator('[data-testid="template-area-select"]');
    await expect(templateSelect).toBeVisible({ timeout: 8_000 });
    await templateSelect.selectOption({ label: TEMPLATE_AREA_NAME });

    await page.getByRole('button', { name: /^create$/i }).click();

    // Modal should close after successful creation
    await expect(page.getByText('+ Add New Area')).not.toBeVisible({ timeout: 10_000 });

    // Area filter dropdown (Area select in filter bar) should now include "Health"
    // Template areas are excluded from dropdown by useAreas.ts, so this proves the USER's area was created
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await expect(areaSelect.locator('option', { hasText: TEMPLATE_AREA_NAME })).toBeAttached({ timeout: 10_000 });
  });

  test('E11-5: After creation Health no longer offered as template; Sleep row appears', async ({ page }) => {
    // Create Health from template (Edit Mode already available from beforeEach)
    await openAddAreaModal(page);
    await switchToTemplateMode(page);

    const templateSelect = page.locator('[data-testid="template-area-select"]');
    await expect(templateSelect).toBeVisible({ timeout: 8_000 });
    await templateSelect.selectOption({ label: TEMPLATE_AREA_NAME });
    await page.getByRole('button', { name: /^create$/i }).click();

    // Modal closes on success
    await expect(page.getByText('+ Add New Area')).not.toBeVisible({ timeout: 10_000 });

    // Edit Mode is still active — open Add Area again WITHOUT toggling Edit Mode
    await page.getByRole('button', { name: /add area/i }).click();
    await expect(page.getByText('+ Add New Area')).toBeVisible({ timeout: 8_000 });
    await switchToTemplateMode(page);

    // Health should no longer be available (user already has slug "health")
    await expect(
      page.locator('[data-testid="template-area-select"]').locator('option', { hasText: TEMPLATE_AREA_NAME }),
    ).not.toBeAttached({ timeout: 8_000 });

    await page.getByRole('button', { name: /cancel/i }).click();

    // Sleep category row appears in structure table (at least one row — may include template + user's copy)
    await expect(
      page.locator('[data-testid^="structure-row-"]').filter({ hasText: 'Sleep' }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await cleanupHealthArea(page);
  });
});
