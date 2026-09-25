/**
 * S149 — filter restore has a deadline; a request with no answer must not lock
 * the filter panel.
 *
 * WHY THIS TEST EXISTS
 *   `FilterContext.doRestore` is a chain of `await`s against the database. Until
 *   S149 it had no limit, so ONE request that never answered left `isRestoring`
 *   true for good: the filter panel drew only "Restoring filter…", with no
 *   message and no way out — only F5 helped. Seen live on `dev:prod` (S147), and
 *   unanswered requests are measured, not hypothetical (T-S140: 24 of 347 in one
 *   E2E run had `status: -1`).
 *
 *   The test makes every `categories` request hang forever — the exact condition
 *   — and asks that the panel unlocks, keeps the Area, and SAYS what happened.
 */
import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

// Seed row (e2e/setup/seed.sql) -- L2, because the Category select offers L1+L2 only
const CAT_L2 = 'c1000000-0000-0000-0000-000000000002';

test.setTimeout(120_000);

test('S149-1: restore that never gets an answer gives up, keeps the Area, and says so', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/app');
  await page.waitForLoadState('networkidle');

  // Filter panel selects, in order: 0 Shortcuts, 1 Area, 2 Category (v. e16)
  const areaSelect = page.locator('select').nth(1);
  const catSelect  = page.locator('select').nth(2);
  await areaSelect.selectOption({ label: 'Fitness' });
  await expect(page.getByText('Fitness > All Categories').first()).toBeVisible();
  await catSelect.selectOption(CAT_L2);
  const fitnessId = await areaSelect.inputValue();

  // The restore reads what was saved, so wait until the category is in storage.
  await expect.poll(() => page.evaluate((cat) => Object.keys(localStorage)
    .some(k => k.startsWith('events-tracker-filter-state') && (localStorage.getItem(k) ?? '').includes(cat)),
    CAT_L2), { timeout: 15_000 }).toBe(true);

  // Every categories request now waits forever — no answer, no error.
  await page.route('**/rest/v1/categories*', () => new Promise<void>(() => {}));
  try {
    await page.reload();

    const restoring = page.getByText('Restoring filter');
    await expect(restoring).toBeVisible({ timeout: 10_000 });
    // RESTORE_DEADLINE_MS is 8 s; the old code stayed here for good.
    await expect(restoring).toBeHidden({ timeout: 15_000 });

    await expect(page.getByText('Baza nije odgovorila na vrijeme')).toBeVisible();
    // The Area survives (its id came from storage, not from the database) …
    expect(await page.locator('select').nth(1).inputValue()).toBe(fitnessId);
    // … and the panel is usable again: the Area select is enabled.
    await expect(page.locator('select').nth(1)).toBeEnabled();
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});
