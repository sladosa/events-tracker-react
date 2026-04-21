/**
 * E14 — Prefetch cache: Prev/Next navigacija ne trigerira nove DB fetchove
 *
 * Stvara 6 test eventa u Cardio kategoriji s različitim session_startovima.
 * Otvara ViewDetails na 3. eventu (ima 2 prethodna + 3 slijedeća = pokriva ±3 prefetch).
 * Provjerava da 1. i 2. Next klik ne trigeriraju fetch SPECIFIČNO za target session
 * (podaci trebaju biti u prefetch cache-u).
 *
 * Mjerna tehnika: page.on('request') broji Supabase /events? pozive koji sadrže
 * session_start=eq.<target> — background prefetch za OSTALE sessione se ne broji.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

// 6 test sessions — sve u budućnosti da ne collide s real datom.
// Aktivnosti su sortirane newest-first, pa u navigacijskoj listi:
//   index 0 = SESSIONS[5] (11:00), index 3 = SESSIONS[2] (08:00, start)
//   1. Next → index 4 = SESSIONS[1] (07:00)
//   2. Next → index 5 = SESSIONS[0] (06:00)
const SESSIONS = [
  '2030-01-01T06:00:00+00:00',  // ← E14-2 navigira ovdje (2. Next)
  '2030-01-01T07:00:00+00:00',  // ← E14-1 navigira ovdje (1. Next)
  '2030-01-01T08:00:00+00:00',  // ← startamo ovdje
  '2030-01-01T09:00:00+00:00',
  '2030-01-01T10:00:00+00:00',
  '2030-01-01T11:00:00+00:00',
];

const EV_IDS = SESSIONS.map((_, i) =>
  `e14e0000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
);

/** REST helper koji ne ovisi o localStorage — radi direktno s apikey */
async function restInsertEvent(
  request: import('@playwright/test').APIRequestContext,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/events`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data: payload,
  });
  if (!res.ok()) {
    throw new Error(`INSERT events failed: ${res.status()} ${await res.text()}`);
  }
}

async function restDeleteEvents(
  request: import('@playwright/test').APIRequestContext,
  accessToken: string,
  ids: string[],
): Promise<void> {
  const idList = ids.map(id => `"${id}"`).join(',');
  await request.delete(`${SUPABASE_URL}/rest/v1/events?id=in.(${idList})`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal',
    },
  });
}

async function getAccessToken(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: {
      email: process.env.PLAYWRIGHT_TEST_EMAIL!,
      password: process.env.PLAYWRIGHT_TEST_PASSWORD!,
    },
  });
  if (!res.ok()) throw new Error(`Auth failed: ${res.status()} ${await res.text()}`);
  const session = await res.json();
  return session.access_token;
}

/**
 * Checks whether a Supabase request URL is the MAIN navigation fetch for the specific target session.
 *
 * Matches ONLY the leaf events SELECT with full column list — i.e. what getOrFetchActivity fires
 * when there is a cache MISS. Excluded:
 *   - parent chain queries (events?select=id&...) — contain chain_key= param
 *   - event_attributes / event_attachments — excluded by name
 *   - useActivities list queries — don't have session_start=eq. at all
 *
 * The main fetch URL contains `select=id%2Ccategory_id` (percent-encoded comma).
 */
function isNavigationFetchFor(url: string, targetSession: string): boolean {
  if (!url.includes('/rest/v1/events?select=')) return false;
  if (url.includes('event_attributes') || url.includes('event_attachments')) return false;
  // Exclude parent chain queries — they use select=id only (no comma)
  if (!url.includes('select=id%2C')) return false;
  // Supabase encodes the param value — check both raw and encoded forms
  const encodedTarget = encodeURIComponent(targetSession);
  return (
    url.includes(`session_start=eq.${encodedTarget}`) ||
    url.includes(`session_start=eq.${targetSession}`)
  );
}

test.describe('E14 — Prefetch cache', () => {
  let accessToken = '';
  let leafCatId = '';   // populated in beforeAll by querying the real DB

  test.beforeAll(async ({ request }) => {
    accessToken = await getAccessToken(request);

    // Pronađi bilo koji leaf category koji pripada owner-u
    // (slug=cardio je leaf u user's Fitness area)
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/categories?slug=eq.cardio&user_id=eq.${OWNER_ID}&select=id,name&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } },
    );
    const cats = (await res.json()) as Array<{ id: string; name: string }>;
    if (!cats || cats.length === 0) {
      throw new Error('E14 setup: cardio category not found for owner — check seed or real data');
    }
    leafCatId = cats[0].id;

    for (let i = 0; i < SESSIONS.length; i++) {
      await restInsertEvent(request, accessToken, {
        id: EV_IDS[i],
        user_id: OWNER_ID,
        category_id: leafCatId,
        event_date: '2030-01-01',
        session_start: SESSIONS[i],
      });
    }
  });

  test.afterAll(async ({ request }) => {
    if (!accessToken) accessToken = await getAccessToken(request);
    await restDeleteEvents(request, accessToken, EV_IDS);
  });

  test('E14-1: 1. Next klik — nema events re-fetcha (cache hit)', async ({ page }) => {
    await loginAsOwner(page);

    // Target: SESSIONS[1] (07:00) = 1. Next od SESSIONS[2] u newest-first listi.
    const targetSession = SESSIONS[1];

    // Registriraj waitForResponse PRIJE page.goto da uhvatimo prefetch response
    // kad god se dogodi (ne postoji race-condition ako registriramo unaprijed).
    const targetPrefetchDone = page.waitForResponse(
      res => isNavigationFetchFor(res.url(), targetSession),
      { timeout: 20_000 },
    );

    // Otvori ViewDetails direktno za SESSIONS[2] (08:00).
    // U newest-first navigacijskoj listi to je index 3.
    // Prefetch pokriva array indekse: SESSIONS[1],SESSIONS[0] (Next) i SESSIONS[3-5] (Prev).
    const startUrl = `/app/view/${encodeURIComponent(SESSIONS[2])}?categoryId=${leafCatId}&userId=${OWNER_ID}`;
    await page.goto(startUrl);
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Loading activity...')).not.toBeVisible({ timeout: 10_000 });

    // Čekaj da initial load završi, a zatim pričekaj da prefetch za target session
    // vrati response (garantira da je cache populiran prije nego nastavimo).
    await page.waitForLoadState('networkidle');
    await targetPrefetchDone;
    await page.waitForTimeout(200);

    // Postavi listener NAKON što je prefetch za target session završen.
    // Bilježi SAMO navigation fetche — novi main events fetch za target = cache miss.
    const navigationFetches: string[] = [];
    const allEventsFetches: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/rest/v1/events?select=') && !url.includes('event_attributes') && !url.includes('event_attachments')) {
        allEventsFetches.push(url);
      }
      if (isNavigationFetchFor(url, targetSession)) {
        navigationFetches.push(url);
      }
    });

    const urlBefore = page.url();

    // Klikni Next
    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).not.toBeDisabled({ timeout: 5_000 });
    await nextBtn.click();

    // URL treba promijeniti brzo (cache hit = instantno)
    await expect(page).not.toHaveURL(urlBefore, { timeout: 1_000 });

    // Content treba biti vidljiv (cache hit = nema network waita, samo React render)
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Loading activity...')).not.toBeVisible({ timeout: 3_000 });

    // Kratko čekanje za eventualne race-condition fetche
    await page.waitForTimeout(300);

    console.log(`=== E14-1 all events fetches (${allEventsFetches.length}) ===\n` + allEventsFetches.join('\n'));
    console.log(`=== E14-1 navigation fetches for ${targetSession} (${navigationFetches.length}) ===\n` + navigationFetches.join('\n'));

    // Cache radi: 0 navigation fetcha za target session (bio prefetchan)
    expect(
      navigationFetches.length,
      `Očekivano 0 navigation fetcha za ${targetSession}, dobiveno ${navigationFetches.length}:\n${navigationFetches.join('\n')}`,
    ).toBe(0);
  });

  test('E14-2: 2. Next klik — nema events re-fetcha (cache hit)', async ({ page }) => {
    await loginAsOwner(page);

    // Start od 3. sessiona
    const startUrl = `/app/view/${encodeURIComponent(SESSIONS[2])}?categoryId=${leafCatId}&userId=${OWNER_ID}`;
    await page.goto(startUrl);
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Loading activity...')).not.toBeVisible({ timeout: 10_000 });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Klik 1 — navigira na SESSIONS[3] (trebao biti prefetchan)
    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).not.toBeDisabled({ timeout: 5_000 });
    const url1 = page.url();
    await nextBtn.click();
    await expect(page).not.toHaveURL(url1, { timeout: 1_000 });
    await expect(page.getByText('Loading activity...')).not.toBeVisible({ timeout: 3_000 });

    // Čekaj network idle (prefetch za SESSIONS[5] i eventualni ostali se settleaju)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Postavi listener tek nakon settlea — bilježi SAMO navigation fetch za SESSIONS[4]
    const targetSession = SESSIONS[0]; // 2030-01-01T06:00:00+00:00 (2. Next u newest-first listi)
    const navigationFetches: string[] = [];
    const allEventsFetches: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/rest/v1/events?select=') && !url.includes('event_attributes') && !url.includes('event_attachments')) {
        allEventsFetches.push(url);
      }
      if (isNavigationFetchFor(url, targetSession)) {
        navigationFetches.push(url);
      }
    });

    // Klik 2 — navigira na SESSIONS[4] (trebao biti prefetchan)
    const url2 = page.url();
    await nextBtn.click();
    await expect(page).not.toHaveURL(url2, { timeout: 1_000 });
    await expect(page.getByRole('heading', { name: /view activity/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Loading activity...')).not.toBeVisible({ timeout: 3_000 });

    await page.waitForTimeout(300);

    console.log(`=== E14-2 all events fetches (${allEventsFetches.length}) ===\n` + allEventsFetches.join('\n'));
    console.log(`=== E14-2 navigation fetches for ${targetSession} (${navigationFetches.length}) ===\n` + navigationFetches.join('\n'));

    // Cache radi: 0 navigation fetcha za target session (SESSIONS[4] bio prefetchan)
    expect(
      navigationFetches.length,
      `Očekivano 0 navigation fetcha za ${targetSession}, dobiveno ${navigationFetches.length}:\n${navigationFetches.join('\n')}`,
    ).toBe(0);
  });
});
