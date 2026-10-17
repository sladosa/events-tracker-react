/**
 * S133 — Structure tab mora prikazati STVARAN broj eventa (BUG-S132-EVENTCOUNT)
 *
 * Do S133 je `useStructureData` brojao evente u pregledniku: povukao bi
 * `events?select=category_id` BEZ `.range()` i BEZ `.order()` pa prebrojao
 * vraćeno. PostgREST reže na 1000 redaka bez greške — izmjereno 10.09.2026.:
 * PROD 1000 od 12.199, TEST 1000 od 3.727. Dakle app je računao nad 8–27 %
 * podataka i pisao rezultat kao da je cijeli.
 *
 * ⚠ Nije kozmetika. `node.eventCount` je BRAVA: `StructureAddChildPanel:123`
 *   ne da dodati dijete leafu koji ima evente (pravilo iz S24). Lažna nula je
 *   otključava, i nigdje ne piše zašto. `StructureDeleteModal` je bio pošteđen
 *   jer već radi vlastiti `count: 'exact'`.
 *
 * ⚠ MJERI SE BROJ, NE ZNAČKA — i to je naučeno na vlastitoj pogrešci. Prva
 *   verzija ovog testa tvrdila je samo da leaf s eventima nema značku
 *   „no events yet". Prošla je i s VRAĆENIM pokvarenim upitom: na TEST-u
 *   `Garmin_data` ima 3.624 od ukupno 3.727 eventa, pa je onih odrezanih 1000
 *   redaka ionako gotovo sve iz te kategorije — brojka ispadne ~1000, značka
 *   se ne pojavi, i test je zadovoljan. Na PROD-u je prozor slučajno pao
 *   drugdje i dao nulu; da smo se oslonili na značku, čuvali bismo TU
 *   slučajnost. Zato se sada uspoređuje ISPISAN BROJ s onim što baza vrati.
 *   (Razred S120: „test koji nikad ne pada ne čuva ništa".)
 *
 * ⚠ Broj je vidljiv u `CategoryDetailPanel` („N events"), a panel se otvara
 *   kroz ⋮ → „View details" — redak sam nema `onClick`.
 */

import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;

async function session(page: import('@playwright/test').Page) {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  const raw = await page.evaluate((k: string) => localStorage.getItem(k), `sb-${ref}-auth-token`);
  const sess = raw ? JSON.parse(raw) : null;
  if (!sess?.access_token) throw new Error('Nema sesije — login nije prošao');
  return {
    userId: sess.user.id as string,
    headers: { apikey: ANON, Authorization: `Bearer ${sess.access_token}`, 'Content-Type': 'application/json' },
  };
}

async function trueCount(page: import('@playwright/test').Page, categoryId: string): Promise<number> {
  const { headers } = await session(page);
  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/events?select=id&category_id=eq.${categoryId}`,
    { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } },
  );
  return Number(res.headers()['content-range'].split('/')[1]);
}

/**
 * S172: vlastita Area s N eventa (iznad reza od 1000), pod E2E vlasnikom.
 * Do S172 je test posuđivao `Garmin_data` iz Areje ručnog testera koju je E2E račun
 * vidio preko sharea — kad je share (s pravom) uklonjen, test je izgubio podatke.
 * E2E račun ne smije ovisiti o tuđim podacima (e2e/CLAUDE.md).
 */
const N_EVENTS = 1100;
async function seedArea(page: import('@playwright/test').Page) {
  const { userId, headers } = await session(page);
  const rep = { ...headers, Prefer: 'return=representation' };
  const tag = Date.now().toString(36);
  const [area] = await (await page.request.post(`${SUPABASE_URL}/rest/v1/areas`, {
    headers: rep, data: { user_id: userId, name: `S133 broj ${tag}`, slug: `s133-broj-${tag}`, sort_order: 90 },
  })).json();
  const [cat] = await (await page.request.post(`${SUPABASE_URL}/rest/v1/categories`, {
    headers: rep, data: { user_id: userId, area_id: area.id, name: 'Brojanje', slug: `brojanje-${tag}`, level: 1, sort_order: 1 },
  })).json();
  const base = Date.UTC(2025, 0, 1, 8, 0);
  const rows = Array.from({ length: N_EVENTS }, (_, i) => {
    const t = new Date(base + i * 60_000).toISOString();
    return { user_id: userId, category_id: cat.id, event_date: t.slice(0, 10), session_start: t };
  });
  const ins = await page.request.post(`${SUPABASE_URL}/rest/v1/events`, { headers, data: rows });
  if (!ins.ok()) throw new Error(`upis eventa: ${ins.status()} ${await ins.text()}`);
  return { areaId: area.id as string, catId: cat.id as string };
}

async function dropArea(page: import('@playwright/test').Page, areaId: string, catId: string) {
  const { headers } = await session(page);
  await page.request.delete(`${SUPABASE_URL}/rest/v1/events?category_id=eq.${catId}`, { headers });
  await page.request.delete(`${SUPABASE_URL}/rest/v1/categories?id=eq.${catId}`, { headers });
  await page.request.delete(`${SUPABASE_URL}/rest/v1/areas?id=eq.${areaId}`, { headers });
}

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

/** ⋮ → stavka. Preuzeto iz e5: refetch liste zna zatvoriti tek otvoren meni (S122). */
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
    } catch { /* meni zatvoren scrollom — pokušaj opet */ }
  }
  throw new Error(`Stavka ${item} se nikad nije pojavila u ⋮ meniju`);
}

test.describe('S133 — broj eventa na Structure tabu', () => {
  test('T-S133-1: Structure pokazuje broj koji baza stvarno ima, ne odrezan', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 20_000 });

    const { areaId, catId } = await seedArea(page);
    try {
    const anchor = { id: catId, count: await trueCount(page, catId) };

    // Padne li sidro ispod 1000, test i dalje mjeri „ekran = istina", ali VIŠE
    // NE ČUVA rez — i to mora reći naglas, ne tiho oslabiti.
    expect(anchor.count,
      'sidro mora biti iznad PostgREST reza od 1000 da bi test čuvao bug').toBeGreaterThan(1000);
    // Lista Area se puni pri učitavanju — nova Area traži svjež prikaz.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Structure' }).click();
    await page.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('button', { name: 'Mine', exact: true }).click();

    // ⚠ Prvi prolaz plaća hladan start Vite dev servera (~1900 modula), pa se
    //   prvo čeka da tablica uopće postoji, a tek onda mjeri sadržaj.
    await expect(page.locator('[data-testid^="structure-row-"]').first())
      .toBeVisible({ timeout: 30_000 });

    const row = page.locator(`[data-testid="structure-row-${anchor.id}"]`);
    await expect(row).toBeVisible();
    await clickRowMenuItem(page, row, /view details/i);

    await expect(
      page.getByText(`${anchor.count} events`, { exact: false }),
      `panel mora pisati ${anchor.count}, a ne odrezanu brojku`,
    ).toBeVisible({ timeout: 15_000 });
    } finally {
      await dropArea(page, areaId, catId);
    }
  });
});
