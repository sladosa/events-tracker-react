/**
 * T-S121-2 — a failed Area-config read must announce itself, not impersonate
 * an Area that has no config.
 *
 * THE BUG (BUG-S121-AREACTX, seen on PROD 28.08.2026)
 *   Saša opened Financije and the Overview tab, the account abbreviations, the
 *   amounts and the "Write access" banner were all gone. Nothing was wrong with
 *   the data — `areas.settings` held every key, the share was active, the query
 *   answered in 0,18–0,27 s. One read had failed, and two independent loaders
 *   had each turned that into "there is nothing here":
 *
 *     useAreaDashboard      — error branch actively set config/listColumns null
 *     FilterContext.resolve — fire-and-forget async; a rejection went nowhere,
 *                             so selectedArea/sharedContext just stayed null
 *
 *   Neither retried, and both only re-run when the Area changes — so one blip
 *   held until F5. Worse than the missing tab: `disableSavePlus` reads
 *   `selectedArea?.settings?.disable_save_plus === true`, so a null area brought
 *   `Save +` BACK to an Area that deliberately switched it off. The app did not
 *   just look different, it behaved differently, silently.
 *
 * BOTH DIRECTIONS, because either half alone would be a test that cannot fail:
 *   1. a TRANSIENT failure must be swallowed by the retry — no bar, no fuss
 *   2. a PERSISTENT failure must raise the bar — absence is never reported as
 *      "this Area has no config"
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

/** Reads of ONE Area row — `…/areas?select=…&id=eq.<uuid>`. Both loaders look
 *  like this (`select=*` and `select=name,settings`), which is why in the real
 *  incident they failed together.
 *
 *  ⚠ Deliberately NOT every `areas` read: the filter dropdown lists areas with
 *    `select=*` and no `id=eq.`, so blocking that too would leave nothing to
 *    select and the test would fail before reaching what it means to check. */
const AREAS_READ = /\/rest\/v1\/areas\?select=[^&]*&id=eq\./;

const NOTICE = /Nisam uspio učitati postavke ove Aree/;

/** Fail the first `n` reads of `areas`, then let everything through. */
async function failFirstAreaReads(page: Page, n: number): Promise<() => number> {
  let seen = 0;
  await page.route(AREAS_READ, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    seen++;
    if (seen <= n) {
      // 503 is what a stalled instance looks like from the client's side.
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  return () => seen;
}

/**
 * Fail every single-Area read for `ms`, then let everything through.
 *
 * ⚠ A TIME window, not a count, and that is the whole point. `useAreaDashboard`
 *   is mounted in three components at once, so a count-based window ("fail the
 *   first 2") cannot say WHICH loader ate the failures — and a run where the
 *   two failures landed on the other two instances would pass without retrying
 *   anything. Every loader's first attempt happens inside the same instant, so
 *   a short window fails all of them and only a genuine retry (300 ms, then
 *   600 ms of backoff) can land outside it.
 */
async function failAreaReadsFor(page: Page, ms: number): Promise<() => number> {
  // ⚠ The window opens on the FIRST intercepted read, not when the route is
  //   installed. Installing it and counting from there was wrong: selecting the
  //   Area in the dropdown takes longer than the window, so every read arrived
  //   after it had closed and NOTHING was ever failed — the test then passed on
  //   broken code, which is the exact failure mode it exists to prevent.
  let until: number | null = null;
  let failed = 0;
  await page.route(AREAS_READ, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (until === null) until = Date.now() + ms;
    if (Date.now() < until) {
      failed++;
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  return () => failed;
}

test.describe('T-S121-2 — Area config read failure', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  });

  test('a transient failure is absorbed by the retry — the config still arrives', async ({ page }) => {
    // A purpose-built Area with a dashboard, because the ASSERTION has to be an
    // outcome, not an absence. "No notice" alone passes on the broken code too
    // (there the bar does not exist), so this checks the thing the user lost:
    // the Overview tab, which exists only when `settings.dashboard` was read.
    const areaId = randomUUID();
    const areaName = `S121 ctx w${test.info().workerIndex}`;
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: areaName,
      slug: `s121-ctx-${areaId.slice(0, 6)}`, sort_order: 92,
      settings: {
        dashboard: {
          widgets: [{
            type: 'balance_by_group', title: 'Stanje', group_by: 'racun',
            plus: 'uplata', minus: 'isplata', unit: '€', filters: [],
          }],
        },
      },
    });

    try {
      await page.goto('/app');
      await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

      // Every loader's first attempt lands inside this window; the retries do not.
      const failed = await failAreaReadsFor(page, 700);

      const areaSelect = page.locator('select').filter({
        has: page.locator('option[value=""]', { hasText: 'All Areas' }),
      });
      await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
      await areaSelect.selectOption(areaId);

      // The config survived the failed reads ⇒ the retry did its job.
      await expect(page.getByRole('button', { name: /Overview/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(NOTICE)).toHaveCount(0);
      expect(failed(), 'no read was ever failed — the test proved nothing')
        .toBeGreaterThan(0);
    } finally {
      await deleteAreaCascade(page, areaId);
    }
  });

  test('a persistent failure raises the notice instead of pretending there is no config', async ({ page }) => {
    await failFirstAreaReads(page, 999);

    await selectFilterPath(page, SEED.AREA_FITNESS, [SEED.CAT_ACTIVITY]);

    await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 20_000 });
    // The point of the wording: the user must not conclude their data is gone.
    await expect(page.getByText(/Podaci su netaknuti/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Pokušaj ponovno/ })).toBeVisible();
  });

  test('the retry button clears the notice once the reads succeed again', async ({ page }) => {
    let failing = true;
    await page.route(AREAS_READ, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (failing) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      }
      return route.fallback();
    });

    await selectFilterPath(page, SEED.AREA_FITNESS, [SEED.CAT_ACTIVITY]);
    await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 20_000 });

    failing = false;
    await page.getByRole('button', { name: /Pokušaj ponovno/ }).click();

    await expect(page.getByText(NOTICE)).toHaveCount(0, { timeout: 20_000 });
  });
});
