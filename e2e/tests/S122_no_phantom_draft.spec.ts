/**
 * T-S122-1 — an Add screen nobody typed into must not leave a resumable draft.
 *
 * THE BUG (measured on PROD 29.08.2026, while verifying T-S121-3)
 *   Once auto-save actually worked (S121), it started writing drafts for forms
 *   the user had never touched: the Add screen fills itself with defaults
 *   (`default_value`, preset, `default_map`), and the interval's first tick
 *   writes unconditionally. So: open Add → wait 6 s → back button → the next
 *   Add offers "Resume Previous Session?" over a draft containing nothing of
 *   yours (`Events: 0`).
 *
 *   Harmless in the data, corrosive in the hand: the dialog that is supposed to
 *   mean "your unfinished entry survived" started appearing when nothing had
 *   been entered — and a prompt that cries wolf is one the user learns to
 *   dismiss without reading, on the day it is telling the truth.
 *
 * WHY THE SECOND TEST EXISTS
 *   "No draft appears" would pass just as well if drafts could never be written
 *   at all — which is precisely the bug S121 fixed, and a test that cannot fail
 *   guards nothing (S120 lesson). The second test types one character and
 *   demands the dialog, so the pair pins both edges: nothing typed ⇒ silence,
 *   something typed ⇒ protection.
 */
import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const DRAFT_KEY = 'et_activity_draft';

/** Comfortably past two auto-save ticks (AUTO_SAVE_INTERVAL is 5 s). */
const PAST_TICKS_MS = 12_000;

test.setTimeout(120_000);

/** Open Add Activity for the seed strength category. */
async function openAdd(page: import('@playwright/test').Page): Promise<void> {
  await selectFilterPath(page, SEED.AREA_FITNESS, [
    SEED.CAT_ACTIVITY,
    SEED.CAT_GYM,
    SEED.CAT_STRENGTH,
  ]);
  const addBtn = page.getByRole('button', { name: /add activity/i });
  await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
  await addBtn.click();
  await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });
}

test.describe('T-S122-1 — untouched Add screen leaves no draft', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    // A draft from an earlier run would decide the outcome instead of the code.
    await page.evaluate(key => localStorage.removeItem(key), DRAFT_KEY);
  });

  test('opened, never typed into, left with the back button — no resume offered', async ({ page }) => {
    await openAdd(page);

    // Long enough for several ticks. The form fills itself with defaults in the
    // meantime — that is exactly the content the guard must refuse to store.
    await page.waitForTimeout(PAST_TICKS_MS);

    expect(
      await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY),
      'a draft was written for a form the user never touched',
    ).toBeNull();

    await page.goBack();
    await expect(page).toHaveURL(/\/app(?!\/add)/, { timeout: 10_000 });

    await openAdd(page);
    await expect(page.getByText(/resume previous session/i)).toHaveCount(0);
  });

  test('one character typed, same exit — the resume IS offered', async ({ page }) => {
    await openAdd(page);

    await page.getByPlaceholder(/felt strong today/i).fill(`T-S122-1 ${Date.now()}`);
    await expect
      .poll(() => page.evaluate(key => localStorage.getItem(key), DRAFT_KEY), { timeout: PAST_TICKS_MS })
      .not.toBeNull();

    await page.goBack();
    await expect(page).toHaveURL(/\/app(?!\/add)/, { timeout: 10_000 });

    await openAdd(page);
    await expect(page.getByText(/resume previous session/i)).toBeVisible({ timeout: 10_000 });

    // Leave nothing behind for the next run (or the next test in this file).
    await page.getByRole('button', { name: /^discard$/i }).click();
    await page.getByRole('button', { name: /yes, discard/i }).click();
    await expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  });
});
