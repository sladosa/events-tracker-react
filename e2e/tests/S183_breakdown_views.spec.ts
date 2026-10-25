/**
 * S183 — prekidač pogleda na „Kamo ide novac": Bucketi | Namjena | Tip (RAZREZ §18).
 *
 * ZASTO OVAJ SPEC
 *   Model pogleda čuvaju unit testovi (`breakdownModel.test.mjs` §10–11). Ovo mjeri
 *   pločicu u aplikaciji: prekidač postoji, pogled Namjena slaže iste retke (isti
 *   Ušlo / Izašlo), fond je ispisan, drill postoji SAMO na čvoru Namjene, os
 *   „po naplati" nestaje na Prihodima a sažetak se pri tom ne mijenja (odluka 6A),
 *   i izbor pogleda preživi drill i povratak.
 *
 *   RPC odgovor je PODMETNUT snimkom s 4 dimenzije (TEST 25.10.2026., This Year,
 *   `src/lib/__tests__/fixtures/breakdown_financije_2026_namjena.json`) — E2E korisnik
 *   nije vlasnik `Financije_all`. Config je pravi (`set_breakdown.py` istog dana).
 *   Stari config (bez `views`) i dalje čuva `S165_breakdown_tile.spec.ts`.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const FX = JSON.parse(readFileSync(
  join(process.cwd(), 'src', 'lib', '__tests__', 'fixtures', 'breakdown_financije_2026_namjena.json'), 'utf8'));

const SALDO = {
  type: 'balance_by_group', title: 'Stanje po računu', group_by: 'racun',
  plus: 'uplata', minus: 'isplata', unit: '€',
};

type Asked = { p_group_slugs: string[]; p_date_from: string | null; p_date_to: string | null };
async function mockRpc(page: Page): Promise<Asked[]> {
  const asked: Asked[] = [];
  await page.route(/\/rest\/v1\/rpc\/rpc_area_breakdown/, async route => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    asked.push(body);
    const rows = body.p_date_slug === 'datum_naplate' ? FX.naplata : FX.kupnja;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  return asked;
}

test.describe('S183 — pogledi pločice Kamo ide novac', () => {
  test.setTimeout(90_000);
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S183 pogledi w${test.info().workerIndex}`,
      slug: `s183-pogledi-${areaId.slice(0, 6)}`, sort_order: 94,
      settings: {
        dashboard: { widgets: [SALDO, FX.widget] },
        groupings: { 'Vrsta troška': FX.grouping },
        default_period: 'this-year',
      },
    });
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  async function openOverview(page: Page) {
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);
    const strip = page.locator('div.p-1.shadow-sm.border-gray-100');
    await expect(strip.locator('> button')).toHaveCount(3, { timeout: 15_000 });
    await strip.locator('> button').first().click();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('heading', { name: /Kamo ide novac/ }).click();
  }

  test('široki ekran: Bucketi zadano, Namjena iste brojke, fond, drill samo na Namjeni, os po strani', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const asked = await mockRpc(page);
    await openOverview(page);

    // Zadani pogled = Bucketi (prvi u `views`), bez „Koka razno" (odluka 1A).
    await expect(page.getByText('36.148,05 €').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /razno$/ })).toHaveCount(0);
    // Jedan upit nosi sva tri pogleda: namjena je 4. dimenzija.
    expect(asked[0].p_group_slugs).toEqual(['tip', 'podtip', 'izvorplacanja', 'namjena']);
    const callsBefore = asked.length;

    await page.getByRole('button', { name: 'Namjena', exact: true }).click();
    // Pogled ne mijenja brojke — isti Ušlo / Izašlo, bez novog upita.
    await expect(page.getByText('43.072,27 €').first()).toBeVisible();
    await expect(page.getByText('36.148,05 €').first()).toBeVisible();
    expect(asked.length).toBe(callsBefore);
    await expect(page.getByRole('button', { name: /^▸ Zajedničko/ })).toBeVisible();
    await expect(page.getByText('21.223,00 €')).toBeVisible();
    await expect(page.getByText('5.765,86 €')).toBeVisible();
    // N/A i gotovina na vrhu (5A), ne pod Zajedničko.
    await expect(page.getByRole('button', { name: 'gotovina, nerazvrstano', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'nerazvrstano (N/A)', exact: true })).toBeVisible();
    await expect(page.locator('.js-plotly-plot')).toHaveCount(1);
    // Rečenice fonda više nema — fond je strana „Fond" (S183, Saša).
    await expect(page.getByText(/fond Nena/)).toHaveCount(0);

    // Drill: ↗ uz Namjenu postoji, ispod nje ne.
    await expect(page.getByRole('button', { name: 'Prikaži retke za Koka' })).toBeVisible();
    await page.getByRole('button', { name: /^▸ Koka/ }).click();
    await expect(page.getByRole('button', { name: /^▸ auto C5/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prikaži retke za auto C5' })).toHaveCount(0);
    await page.screenshot({ path: 'e2e/test-results/S183_namjena_wide.png', fullPage: true });

    // Os po strani (6A): po naplati ⇒ Prihodi bez prekidača osi, Izašlo ostaje.
    await page.getByRole('button', { name: 'po naplati' }).click();
    await expect(page.getByText('39.031,63 €').first()).toBeVisible();
    await page.getByRole('button', { name: 'Prihodi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'po naplati' })).toHaveCount(0);
    await expect(page.getByText('39.031,63 €').first()).toBeVisible();
    await expect(page.getByText('12.000,00 €').first()).toBeVisible();
    // Prihodi ravno na Podtip — stalna razina „Prihodi" se ne prikazuje (S183).
    await page.getByRole('button', { name: /^▸ Nena \/ Kućište/ }).click();
    await expect(page.getByRole('button', { name: 'Nasljedstvo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^▸ Prihodi/ })).toHaveCount(0);
    // Na Prihodima je drill pošten i uz os naplate (config tvrdi: ista os).
    await expect(page.getByRole('button', { name: 'Prikaži retke za Saša' })).toBeVisible();
    await page.getByRole('button', { name: 'Troškovi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'po naplati' })).toBeVisible();

    // Fond: stanje OD POČETKA (poziv bez granica), traka, razdoblje, kamo / odakle.
    // ↗ fonda postoji samo „po kupnji" (filtar ne zna raspon datuma naplate).
    await page.getByRole('button', { name: 'Fond', exact: true }).click();
    await expect(page.getByTestId('fund-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prikaži retke fonda Nena / Kućište' })).toHaveCount(0);
    await page.getByRole('button', { name: 'po kupnji' }).click();
    const fund = page.getByTestId('fund-panel');
    await expect(fund).toContainText('Fond Nena / Kućište');
    await expect(fund).toContainText('+9.534,95');
    await expect(fund).toContainText('potrošeno 2.465,05');
    await expect(fund).toContainText('(20,5 %)');
    await expect(fund).toContainText('u razdoblju 01.01.–31.12.2026.');
    expect(asked.some(a => a.p_date_from == null && a.p_date_to == null)).toBe(true);
    await fund.getByRole('button', { name: /^▸ Razno/ }).click();
    await expect(fund.getByRole('button', { name: "Nena's funds" })).toBeVisible();
    await expect(fund.getByRole('button', { name: 'Nasljedstvo', exact: true })).toBeVisible();
    await expect(fund.getByRole('button', { name: 'Prikaži retke fonda Nena / Kućište' })).toBeVisible();
    // Jedna stavka troška (Nena's funds) ⇒ bez kruga (jednobojni disk ne govori ništa).
    await expect(fund.locator('.js-plotly-plot')).toHaveCount(0);
    await page.screenshot({ path: 'e2e/test-results/S183_fond_wide.png', fullPage: true });
    // Fond ne postoji u pogledu bez fondova ⇒ prekidač se vrati na Troškove.
    await page.getByRole('button', { name: 'Bucketi', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fond', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toBeVisible();

    // Pogled Tip: ravno, bez bucketa i bez Namjene.
    await page.getByRole('button', { name: 'po kupnji' }).click();
    await page.getByRole('button', { name: 'Tip', exact: true }).click();
    await expect(page.getByRole('button', { name: /^▸ Domaćinstvo/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
    await expect(page.getByText('36.148,05 €').first()).toBeVisible();
  });

  test('drill na Namjenu i povratak: pogled Namjena ostaje (uski ekran)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const catId = randomUUID();
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'attribute_definitions', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId, name: 'Namjena',
      slug: 'namjena', data_type: 'text', is_required: false, sort_order: 1, validation_rules: {},
    });
    await mockRpc(page);
    await openOverview(page);
    const strip = page.locator('div.p-1.shadow-sm.border-gray-100');

    await page.getByRole('button', { name: 'Namjena', exact: true }).click();
    await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const tile = page.getByRole('heading', { name: /Kamo ide novac/ })
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await tile.screenshot({ path: 'e2e/test-results/S183_namjena_narrow.png' });

    await page.getByRole('button', { name: 'Prikaži retke za Koka' }).click();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toHaveCount(0, { timeout: 15_000 });
    await strip.locator('> button').first().click();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^▸ Zajedničko/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Fond', exact: true }).click();
    await expect(page.getByTestId('fund-panel')).toContainText('+9.534,95');
    await page.getByTestId('fund-panel').screenshot({ path: 'e2e/test-results/S183_fond_narrow.png' });
  });
});
