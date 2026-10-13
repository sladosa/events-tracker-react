/**
 * S170 — Structure broji evente JEDNIM upitom (sql/057), ne jednim po kategoriji.
 *
 * ZAŠTO POSTOJI (T-S141-1): `useStructureData` je slao `count: 'exact'` HEAD za
 * svaku kategoriju, a tok Structure → Edit Mode → Activities → Structure učita
 * strukturu više puta. Izmjereno S170 na TEST-u, isti tok: stari kod **156**
 * takvih zahtjeva, novi **0** (+ 2 RPC poziva).
 *
 * ⚠ Drugi test čuva FALLBACK: PROD prije migracije 057 nema funkciju
 *   (PostgREST `PGRST202`) — struktura se tada mora prikazati starim putem,
 *   ne pasti. Bez njega redoslijed „migracija pa deploy" bi bio uvjet.
 * ⚠ PROTUPROVJERA (S170): nad starim `useStructureData` prvi test pada (156 ≠ 0).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';

function countRequests(page: Page) {
  const c = { perCat: 0, rpc: 0 };
  page.on('request', r => {
    const u = r.url();
    if (r.method() === 'HEAD' && /\/rest\/v1\/events\?select=id&category_id=eq\./.test(u)) c.perCat++;
    if (/\/rpc\/rpc_category_event_counts/.test(u)) c.rpc++;
  });
  return c;
}

async function openStructureTwice(page: Page) {
  await loginAsOwner(page);
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Structure' }).click();
  await page.getByRole('button', { name: 'Table' }).click();
  const row = page.locator('[data-testid^="structure-row-"]').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Activities' }).click();
  await page.getByRole('button', { name: 'Structure' }).click();
  await expect(row).toBeVisible({ timeout: 30_000 });
}

test.describe('S170 — Structure: broj eventa po kategoriji', () => {
  test.setTimeout(90_000);

  test('jedan RPC, nijedan upit po kategoriji', async ({ page }) => {
    const c = countRequests(page);
    await openStructureTwice(page);
    expect(c.rpc, 'RPC je pozvan').toBeGreaterThan(0);
    expect(c.perCat, 'nijedan count po kategoriji').toBe(0);
  });

  test('baza bez funkcije (PGRST202) ⇒ stari put, struktura se prikaže', async ({ page }) => {
    await page.route(/\/rpc\/rpc_category_event_counts/, route => route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function', details: null, hint: null }),
    }));
    const c = countRequests(page);
    await openStructureTwice(page);
    expect(c.perCat, 'fallback broji po kategoriji').toBeGreaterThan(0);
  });
});
