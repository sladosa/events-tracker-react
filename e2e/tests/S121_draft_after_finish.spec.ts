/**
 * T-S121-1 — a finished session must not leave a draft behind.
 *
 * THE BUG (found on PROD 28.08.2026, Saša's own entry)
 *   `finish()` called `clearDraft()` but not `stopAutoSave()`. The auto-save
 *   interval kept running and, 15 s later, wrote the draft back to
 *   localStorage — carrying the values of the event that had *just been saved*.
 *   The next Add Activity found a draft, offered "Resume Previous Session?",
 *   and Resume + Finish produced a DUPLICATE: 2,70 € recorded twice, at
 *   session_start 09:51 and 09:53.
 *
 *   It was not a rare race — it was the ONLY thing that interval ever did.
 *   Measured: during entry the effect arming it re-runs on every render, so the
 *   15 s countdown never elapses. `finish()` calls `endSession()`, the stopwatch
 *   stops, the re-renders stop, the last-armed interval finally survives — and
 *   fires 15 s later, on top of the draft `clearDraft()` had just removed.
 *
 * WHY PHASE A USES Save+
 *   Asserting only "no draft after Finish" would pass even if nothing could ever
 *   write a draft — a test that cannot fail guards nothing (S120 lesson). So the
 *   test first writes one through Save+, the path that genuinely works, and only
 *   then checks that Finish clears it and nothing puts it back.
 *
 *   ⚠ Phase A uses Save+ rather than waiting for the auto-save interval ON
 *   PURPOSE: it must hold even if the interval's timing changes. Auto-save
 *   itself was separately broken and is now fixed (BUG-S121-AUTOSAVE) — it
 *   never fired during entry, because the effect arming it re-ran on every
 *   render and restarted the countdown. That is why its one and only tick in a
 *   whole session landed after Finish, on the draft just cleared.
 *
 * VERIFIED IN BOTH DIRECTIONS (measured, not reasoned): with the fix reverted,
 * the draft reappears 15 s after Finish (385 B, one `[AutoSave] Draft saved`);
 * with it, it never returns and no tick is logged.
 */
import { test, expect } from '@playwright/test';
import { loginAsOwner, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const DRAFT_KEY = 'et_activity_draft';

/** Wait past several auto-save ticks (AUTO_SAVE_INTERVAL is 5 s). Generous on
 *  purpose: the point is that NO tick ever writes after Finish, and the margin
 *  must survive someone tuning the interval later. */
const PAST_ONE_TICK_MS = 16_000;

// One ~19 s wait plus login, navigation and two saves.
test.setTimeout(120_000);

test.describe('T-S121-1 — Finish must not leave a resumable draft', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    // A draft left by an earlier run would make phase A pass for the wrong reason.
    await page.evaluate(key => localStorage.removeItem(key), DRAFT_KEY);
  });

  test('a draft can be written, and Finish leaves none behind', async ({ page }) => {
    await selectFilterPath(page, SEED.AREA_FITNESS, [
      SEED.CAT_ACTIVITY,
      SEED.CAT_GYM,
      SEED.CAT_STRENGTH,
    ]);

    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    const catSelect = page.locator('select').filter({
      has: page.locator('option[value=""]'),
    }).last();
    await expect(catSelect).not.toBeDisabled({ timeout: 5_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    // Something in the form, so the session has content worth drafting.
    await page.getByPlaceholder(/felt strong today/i).fill(`T-S121-1 ${Date.now()}`);

    // ── Phase A — a draft CAN be written, and is ─────────────────────────────
    // Save+ writes it explicitly (AddActivityPage.tsx). Without this the rest of
    // the test would be vacuous: "no draft" proves nothing if nothing writes one.
    await page.getByRole('button', { name: /^save \+$/i }).click();
    await expect
      .poll(() => page.evaluate(key => localStorage.getItem(key), DRAFT_KEY), { timeout: 10_000 })
      .not.toBeNull();

    // ── Phase B — Finish clears it, and nothing writes it back ────────────────
    const finishBtn = page.getByRole('button', { name: /finish/i }).first();
    await expect(finishBtn).not.toBeDisabled({ timeout: 5_000 });
    await finishBtn.click();

    // Success dialog = the page is still mounted, which is exactly the window in
    // which the stray tick used to fire. Stay here and let it pass.
    await expect(page.getByRole('button', { name: /go to home/i })).toBeVisible({ timeout: 15_000 });

    await expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();

    await page.waitForTimeout(PAST_ONE_TICK_MS);

    expect(
      await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY),
      'a draft reappeared after Finish — auto-save is resurrecting it (the 28.08.2026 duplicate bug)',
    ).toBeNull();

    // ── Phase C — and the user is not offered a resume on the next entry ──────
    await page.getByRole('button', { name: /go to home/i }).click();
    await expect(page).toHaveURL(/\/app$|\/app\?/, { timeout: 15_000 });

    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    await expect(page.getByText(/resume previous session/i)).toHaveCount(0);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(key => localStorage.removeItem(key), DRAFT_KEY);
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      category_id: SEED.CAT_STRENGTH,
    });
    await supabaseDelete(page, 'events', {
      user_id: OWNER_ID,
      chain_key: SEED.CAT_STRENGTH,
    });
  });
});
