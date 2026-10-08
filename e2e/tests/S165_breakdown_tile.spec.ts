/**
 * S165 — pločica „Kamo ide novac" se crta iz configa i pokazuje brojke modela.
 *
 * ZASTO OVAJ SPEC
 *   Model (`breakdownModel.ts`) čuvaju unit testovi, a RPC `verify_breakdown.py`.
 *   Ovo mjeri ono između: da pločica u stvarnoj aplikaciji pita RPC, složi model
 *   i nacrta ISTE brojke — na širokom ekranu s krugom, na uskom bez njega
 *   (RAZREZ §2.2: jedan model, dva crteža).
 *
 *   RPC odgovor je PODMETNUT stvarnom snimkom (TEST 07.10.2026., 10/2025–09/2026,
 *   `src/lib/__tests__/fixtures/breakdown_financije_12mj.json`), jer E2E korisnik
 *   nije vlasnik `Financije_all`. Brojke koje se traže su RAZREZ §4.3.
 *   Config je pravi (`set_breakdown.py` istog dana), upisan na privremenu Areu.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const FX = JSON.parse(readFileSync(
  join(process.cwd(), 'src', 'lib', '__tests__', 'fixtures', 'breakdown_financije_12mj.json'), 'utf8'));

const SALDO = {
  type: 'balance_by_group', title: 'Stanje po računu', group_by: 'racun',
  plus: 'uplata', minus: 'isplata', unit: '€',
};

/** Tijelo pločice salda (sve ispod naslova) — sklopljeno = `hidden`. */
const saldoBody = (page: Page) => page.getByRole('heading', { name: /Stanje po računu/ })
  .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  .locator(':scope > div').nth(1);

async function mockRpc(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route(/\/rest\/v1\/rpc\/rpc_area_breakdown/, async route => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    asked.push(String(body.p_date_slug));
    const rows = body.p_date_slug === 'datum_naplate' ? FX.naplata : FX.kupnja;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  return asked;
}

test.describe('S165 — pločica Kamo ide novac', () => {
  // Reload + obnova filtra zna potrajati > 30 s na TEST-u (v. E8-2, „Restoring filter…").
  test.setTimeout(90_000);
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S165 razrez w${test.info().workerIndex}`,
      slug: `s165-razrez-${areaId.slice(0, 6)}`, sort_order: 93,
      settings: {
        // Saldo prvi, kao na Financijama — harmonika (S166) se vidi tek uz dvije pločice.
        dashboard: { widgets: [SALDO, FX.widget] },
        groupings: { [FX.widget.grouping]: FX.grouping },
        default_period: 'this-year',   // S166 (Koka)
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
    // Na uskom ekranu tab nema natpis (samo ikona) ⇒ traka tabova, prvi gumb —
    // ali tek kad Overview postoji (pojavi se kad se config pročita).
    const strip = page.locator('div.p-1.shadow-sm.border-gray-100');
    await expect(strip.locator('> button')).toHaveCount(3, { timeout: 15_000 });
    await strip.locator('> button').first().click();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toBeVisible({ timeout: 15_000 });
    // S166: razrez je zadano ZATVOREN (harmonika sa saldom) ⇒ otvori ga.
    await page.getByRole('heading', { name: /Kamo ide novac/ }).click();
  }

  test('široki ekran: brojke iz §4.3, krug, prekidač osi', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const asked = await mockRpc(page);
    await openOverview(page);

    await expect(page.getByText('46.972,48 €').first()).toBeVisible();
    await expect(page.getByText('40.127,91 €').first()).toBeVisible();
    const bucket = page.getByRole('button', { name: /Mjesečni troškovi/ });
    await expect(bucket).toBeVisible();
    await expect(page.getByText('20.994,89 €')).toBeVisible();
    // S166: udio u roditelju — Mjesečni 20.994,89 / Izašlo 40.127,91 = 52,32 %
    await expect(page.getByText('52,3 %', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /nerazvrstano \(N\/A\)/ })).toBeVisible();
    await expect(page.getByText(/grupirano: Vrsta troška/)).toBeVisible();
    await expect(page.locator('.js-plotly-plot')).toHaveCount(1);
    await expect(page.getByText(/Nije nacrtano/)).toBeVisible();
    // Transfer u podnožju, bruto
    await expect(page.getByText(/izvan razreza/)).toContainText('61.420,64');

    // rasklopi bucket ⇒ gotovina je podstavka Mjesečnih
    await bucket.click();
    await expect(page.getByRole('button', { name: 'gotovina, nerazvrstano', exact: true })).toBeVisible();
    await expect(page.getByText('3.830,90 €')).toBeVisible();
    // gotovina u Mjesečnima: 3.830,90 / 20.994,89 = 18,25 %
    await expect(page.getByText('18,2 %', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'e2e/test-results/S165_breakdown_wide.png', fullPage: true });

    await bucket.click();   // natrag sklopljen

    // S166: krug vodi, lista slijedi. PRAVI klik mišem na natpis isječka — prva verzija
    // je emitirala `plotly_sunburstclick` izravno i time zaobišla put koji korisnik ide.
    // ⚠ Krug mora biti U POGLEDU: boundingBox daje koordinate i izvan ekrana, pa
    //   klik tiho promaši (izmjereno: handler se nije ni pozvao).
    const clickSlice = async (label: string) => {
      await page.locator('.js-plotly-plot').scrollIntoViewIfNeeded();
      const bb = await page.locator('.js-plotly-plot g.slice text', { hasText: new RegExp(`^${label}$`) })
        .first().boundingBox();
      await page.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
    };
    await clickSlice('Mjesečni troškovi');
    await expect(page.getByRole('button', { name: 'Sve', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Koka razno/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'gotovina, nerazvrstano', exact: true })).toBeVisible();
    // klik na sredinu kruga (sada je to „Mjesečni troškovi") = razina gore ⇒ cijela lista
    await page.waitForTimeout(800);   // Plotly prerenderira krug nakon promjene `level`
    await clickSlice('Mjesečni troškovi');
    await expect(page.getByRole('button', { name: /Koka razno/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sve', exact: true })).toHaveCount(0);
    // i staza „Sve" vraća
    await page.waitForTimeout(800);
    await clickSlice('Mjesečni troškovi');
    await page.getByRole('button', { name: 'Sve', exact: true }).click();
    await expect(page.getByRole('button', { name: /Koka razno/ })).toBeVisible();

    await page.getByRole('button', { name: 'po naplati' }).click();
    await expect(page.getByText('39.305,20 €').first()).toBeVisible();
    await expect(page.getByText('19.939,85 €')).toBeVisible();
    expect(asked).toContain('datum_naplate');

    await page.getByRole('button', { name: 'Prihodi', exact: true }).click();
    await expect(page.getByRole('button', { name: /^▸ Prihodi/ })).toBeVisible();
  });

  test('svjež krug: PRVI klik na isječak već suzi listu (S166)', async ({ page }) => {
    // Izmjereno S166: u dev StrictMode-u react-plotly izgubi slušač iz propa pri
    // dvostrukom montiranju ⇒ na svježem krugu (povratak iz Add) klik je zumirao samo
    // krug. Zato klik ODMAH nakon montiranja, bez ijednog renderiranja između.
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockRpc(page);
    await openOverview(page);
    await expect(page.locator('.js-plotly-plot g.slice').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await page.locator('.js-plotly-plot').scrollIntoViewIfNeeded();
    const bb = await page.locator('.js-plotly-plot g.slice text', { hasText: /^Putovanja i pokloni$/ })
      .first().boundingBox();
    await page.mouse.click(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
    await expect(page.getByRole('button', { name: 'Sve', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
  });

  test('zadano razdoblje Aree: This Year; ručni All Time ostaje; F5 ga vraća (S166)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Jedan event iz 2024. — bez njega All Time nema granica i `handleAllTime` ne radi
    // ništa (prazna Area), pa bi test mjerio prazninu umjesto zadanog razdoblja.
    const catId = randomUUID();
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId,
      event_date: '2024-03-03', session_start: '2024-03-03T09:00:00+00:00', comment: 'S166 seed',
    });
    await mockRpc(page);
    await openOverview(page);
    const period = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Time' }) });
    await expect(period).toHaveValue('this-year', { timeout: 15_000 });
    const y = new Date().getFullYear();
    await expect(page.getByText(`01.01.–31.12.${y}. · iz filtra`)).toBeVisible();
    // Čovjek bira All Time ⇒ zadano ga NE pregazi (ni nakon odlaska u Activities i natrag).
    await period.selectOption({ label: 'All Time' });
    await expect(period).not.toHaveValue('this-year');
    await page.getByRole('button', { name: 'Activities' }).click();
    await page.getByRole('button', { name: 'Overview' }).click();
    await page.waitForTimeout(1500);
    await expect(period).not.toHaveValue('this-year');
    // F5 = novo otvaranje appa ⇒ opet zadano.
    await page.reload();
    await expect(period).toHaveValue('this-year', { timeout: 20_000 });
  });

  test('uski ekran: lista bez kruga; harmonika sa saldom, reload vraća saldo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockRpc(page);
    await openOverview(page);

    await expect(page.getByText('40.127,91 €').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toBeVisible();
    await expect(page.locator('.js-plotly-plot')).toHaveCount(0);
    // nema vodoravnog scrolla stranice
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Snimka SAME pločice — `fullPage` uhvati i zatvoren Help bottom-sheet ispod ekrana.
    const tile = page.getByRole('heading', { name: /Kamo ide novac/ })
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await page.getByRole('button', { name: /Mjesečni troškovi/ }).click();
    await tile.screenshot({ path: 'e2e/test-results/S165_breakdown_narrow.png' });
    await page.getByRole('button', { name: /Mjesečni troškovi/ }).click();

    // Harmonika (S166): razrez je otvoren ⇒ saldo sklopljen (samo naslov).
    await expect(page.getByRole('heading', { name: /Stanje po računu/ })).toBeVisible();
    await expect(saldoBody(page)).toBeHidden();
    // Otvori saldo ⇒ razrez se sklopi.
    await page.getByRole('heading', { name: /Stanje po računu/ }).click();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
    await expect(saldoBody(page)).toBeVisible({ timeout: 15_000 });
    // Klik na OTVORENU (saldo) ne zatvara obje nego prebaci na razrez (Saša, S166).
    await page.getByRole('heading', { name: /Stanje po računu/ }).click();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toBeVisible();
    await expect(saldoBody(page)).toBeHidden();
    // Reload ⇒ zadano: saldo otvoren, razrez zatvoren.
    await page.reload();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
    await expect(saldoBody(page)).toBeVisible({ timeout: 15_000 });
  });
});
