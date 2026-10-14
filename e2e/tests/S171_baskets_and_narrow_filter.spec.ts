/**
 * S171 — pločica „Košare" i filtar na uskom ekranu (Saša, 14.10.2026.)
 *
 * ŠTO SE MJERI (i zašto baš to):
 *   - Overview na 390 px nudi SAMO razdoblje: selektor Aree je skriven (ne
 *     odmontiran), izbor razdoblja sklopi red i ostavi pločice na vrhu.
 *   - Activities na 390 px: sklopljen filtar KAŽE što je aktivno (sažetak).
 *   - Košare: po računu, po dospijeću, „ostaje" kumulativno, Visa `~`.
 *   - Traka „pokaži kupnje" otvara pločicu i RASKLAPA tu košaru — i kad ju je
 *     čovjek prije sklopio (inače bi „radilo" samo zato što je ionako zadana).
 *
 * Košare, saldo i članovi dolaze iz podmetnutih RPC-ova; Area je prazna, pa
 * pravilo B (skupni redak) uredno ne nađe ništa. Ništa se ne upisuje.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

const OVERDUE = inDays(-1);
const NEXT = inDays(20);
const LATER = inDays(50);
const VISA = inDays(25);

const BASKETS = [
  { basket: 'Mastercard', due_date: OVERDUE, n: 2, n_pending: 2, gross_plus: 0, gross_minus: 200 },
  { basket: 'Mastercard', due_date: NEXT, n: 1, n_pending: 1, gross_plus: 0, gross_minus: 100 },
  { basket: 'Mastercard', due_date: LATER, n: 1, n_pending: 1, gross_plus: 0, gross_minus: 50 },
  // Visa: bruto — zrcalo uplate (plus) se ne oduzima
  { basket: 'Visa', due_date: VISA, n: 2, n_pending: 2, gross_plus: 300, gross_minus: 40 },
];

// Kupnje su PRAVI retci u testnoj Arei (sije ih beforeEach): View → Prev/Next mora
// ih naći u bazi, podmetnuti id daje „Activity not found". Podmeće se samo članstvo
// košare (055) i saldo — Area nema atribute pa ih pravi RPC ne bi vratio.
let E1 = '';
let E2 = '';
let CAT = '';
const ss = (days: number) => `${inDays(days)}T10:00:00+00:00`;

async function mockAll(page: Page) {
  // Isto kao pravi RPC: samo košare dospjele DO `p_as_of` (traka: danas, pločica: daleko).
  await page.route(/\/rest\/v1\/rpc\/rpc_area_due_baskets/, route => {
    const asOf = (route.request().postDataJSON() as { p_as_of: string }).p_as_of;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(BASKETS.filter(b => b.due_date <= asOf)),
    });
  });
  const bal = (v: string, amount: number) => ({
    group_value: v, anchored: true, anchor_amount: amount, anchor_on: inDays(-10),
    plus_sum: 0, minus_sum: 0, n: 0, balance: amount, last_on: null,
  });
  await page.route(/\/rest\/v1\/rpc\/rpc_area_balance_anchored/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([bal('ZABA', 1000), bal('RF', 500)]),
  }));
  await page.route(/\/rest\/v1\/rpc\/rpc_area_due_basket_members/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { event_id: E2, user_id: OWNER_ID, category_id: CAT, status: 'Planiran', plus_v: null, minus_v: 50 },
      { event_id: E1, user_id: OWNER_ID, category_id: CAT, status: 'Planiran', plus_v: null, minus_v: 150 },
    ]),
  }));
  // ⚠ Ako se `events` ikad podmeće: druga stranica mora biti PRAZNA — `fetchAllPaged`
  //   staje tek na praznoj, pa mock koji uvijek vraća retke vrti beskonačno (e2e/CLAUDE.md).
}

async function selectArea(page: Page, areaId: string) {
  await page.goto('/app');
  const areaSelect = page.locator('select').filter({
    has: page.locator('option[value=""]', { hasText: 'All Areas' }),
  });
  await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
  await areaSelect.selectOption(areaId);
  return areaSelect;
}

test.describe('S171 — košare i uski filtar', () => {
  test.setTimeout(90_000);
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S171 kosare w${test.info().workerIndex}`,
      slug: `s171-kosare-${areaId.slice(0, 6)}`, sort_order: 95,
      settings: {
        default_period: 'this-year',
        // Košara piše kupnju kao drugi redak uske liste (S171) — isti config kao Financije.
        list_columns: { columns: [
          { role: 'date', mobile: 'line1' },
          { role: 'attr', slugs: ['tip', 'podtip'], sep: '/', mobile: 'line2' },
          { role: 'comment', mobile: 'line2' },
        ] },
        dashboard: {
          widgets: [{
            type: 'balance_by_group', title: 'Stanje po računu', group_by: 'racun',
            plus: 'uplata', minus: 'isplata', unit: '€', filters: [],
            due: {
              basket_by: 'izvorplacanja', due_slug: 'datum_naplate', status_slug: 'status',
              pending: 'Planiran', done: 'Izvrsen',
              baskets: {
                Mastercard: { account: 'ZABA', text: 'TROŠKOVI MC S171' },
                Visa: { account: 'RF', text: 'Visa', window: { before: 2, after: 6 }, measure: 'gross' },
              },
              settle: { tip: 'Transfer', izvorplacanja: 'Racun' },
            },
          }],
        },
      },
    });
    CAT = randomUUID();
    E1 = randomUUID();
    E2 = randomUUID();
    await supabasePost(page, 'categories', {
      id: CAT, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${CAT.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'events', {
      id: E1, user_id: OWNER_ID, category_id: CAT, event_date: inDays(-35),
      session_start: ss(-35), comment: 'Prva kupnja S171',
    });
    await supabasePost(page, 'events', {
      id: E2, user_id: OWNER_ID, category_id: CAT, event_date: inDays(-30),
      session_start: ss(-30), comment: 'Druga kupnja S171',
    });
    // Tip/Podtip na Prvoj ⇒ u košari `Putovanja/Smještaj`, ispod opis.
    for (const [slug, name, val, so] of [['tip', 'Tip', 'Putovanja', 1], ['podtip', 'Podtip', 'Smještaj', 2]] as const) {
      const defId = randomUUID();
      await supabasePost(page, 'attribute_definitions', {
        id: defId, user_id: OWNER_ID, category_id: CAT, name, slug, data_type: 'text',
        is_required: false, sort_order: so, validation_rules: {},
      });
      await supabasePost(page, 'event_attributes', {
        event_id: E1, user_id: OWNER_ID, attribute_definition_id: defId, value_text: val,
      });
    }
    // Redak Aree koji NIJE u košari, između njih: Prev/Next po cijeloj Arei bi ga
    // pokupio — bez njega test ne bi razlikovao košaru od Aree (protuprovjera).
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: CAT, event_date: inDays(-32),
      session_start: ss(-32), comment: 'Nije u kosari S171',
    });
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('390 px: Overview nudi samo razdoblje; košare, ostaje, pokaži kupnje', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAll(page);
    const areaSelect = await selectArea(page, areaId);

    // Uski tab bez natpisa ⇒ prvi gumb trake tabova je Overview.
    const strip = page.locator('div.p-1.shadow-sm.border-gray-100');
    await expect(strip.locator('> button')).toHaveCount(3, { timeout: 15_000 });
    await strip.locator('> button').first().click();
    await expect(page.getByRole('heading', { name: /Stanje po računu/ })).toBeVisible({ timeout: 15_000 });

    // 1. Filtar = red razdoblja: selektor Aree skriven, birač razdoblja tu.
    const summary = page.getByTestId('filter-summary');
    await expect(summary).toContainText('📅');
    await expect(areaSelect).toBeHidden();
    const period = page.locator('select').filter({ has: page.locator('option', { hasText: 'This Month' }) });
    if (!(await period.isVisible())) await summary.click();
    await period.selectOption('this-month');
    // Izbor razdoblja sklopi red, sažetak ga kaže.
    await expect(period).toBeHidden();
    await expect(summary).toContainText('This Month');

    // 2. Košare (harmonika: saldo se sklopi).
    await page.getByRole('heading', { name: /Košare/ }).click();
    const tile = page.getByTestId('baskets-tile');
    await expect(tile.getByText('danas +1.000,00 €')).toBeVisible({ timeout: 15_000 });
    await expect(tile.getByText('ostaje +800,00 €')).toBeVisible();
    await expect(tile.getByText('ostaje +700,00 €')).toBeVisible();
    await expect(tile.getByText('ostaje +650,00 €')).toBeVisible();
    // Visa: bruto 40 (zrcalo 300 se ne oduzima), procjena `~`
    await expect(tile.getByText('ostaje +460,00 €')).toBeVisible();
    await expect(tile.getByText(/~\d{2}\.\d{2}\./)).toBeVisible();
    await expect(tile.getByText(/dospjelo, čeka potvrdu/)).toBeVisible();
    // Zadano rasklopljena dospjela košara ⇒ kupnje, redom po datumu kupnje.
    await expect(tile.getByText('Prva kupnja S171')).toBeVisible({ timeout: 15_000 });
    // Tip/Podtip pa opis, DVA retka (Saša, T-S171-6: u jednom opis nije stao).
    const tipLine = tile.getByText('Putovanja/Smještaj', { exact: true });
    const opisLine = tile.getByText('Prva kupnja S171', { exact: true });
    await expect(tipLine).toBeVisible({ timeout: 15_000 });
    const [a, b] = [await tipLine.boundingBox(), await opisLine.boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);   // opis ISPOD, ne u istom retku
    const rows = tile.locator('tbody tr');
    await expect(rows.first()).toContainText('Prva kupnja S171');
    await expect(rows.nth(1)).toContainText('Druga kupnja S171');
    await tile.screenshot({ path: 'e2e/test-results/S171_baskets_narrow.png' });
    await page.screenshot({ path: 'e2e/test-results/S171_overview_narrow.png' });

    // 3. Sklopi tu košaru, otvori saldo (pločica Košare se sklopi)…
    await tile.getByRole('button', { name: /Mastercard.*dospjelo/ }).click();
    await expect(tile.getByText('Prva kupnja S171')).toHaveCount(0);
    await page.getByRole('heading', { name: /Stanje po računu/ }).click();
    await expect(tile.getByText('danas +1.000,00 €')).toHaveCount(0);
    // …pa „pokaži kupnje" u traci ⇒ pločica otvorena I košara rasklopljena.
    await page.getByRole('button', { name: 'pokaži kupnje' }).click();
    await expect(tile.getByText('Prva kupnja S171')).toBeVisible({ timeout: 15_000 });

    // 3b. Saša, T-S171-4: Prev/Next u View-u ide kroz kupnje OVE košare (ne cijelu Areu),
    //     a po povratku je označena kupnja na kojoj je STAO — i nakon Next, i na Back
    //     preglednika (swipe na iPhoneu), koji `location.state` ne nosi.
    await expect(tile.locator('tr[data-last-opened]')).toHaveCount(0);
    await tile.getByText('Prva kupnja S171').click();
    await expect(page).toHaveURL(/\/app\/view\//, { timeout: 15_000 });
    await expect(page.getByText('Prva kupnja S171').first()).toBeVisible({ timeout: 15_000 });
    // Popis je košara (2), ne cijela Area: Prva nema prethodnu, Druga nema sljedeću.
    await expect(page.getByTitle('Previous activity')).toBeDisabled({ timeout: 15_000 });
    await page.getByTitle('Next activity').click();
    await expect(page.getByText('Druga kupnja S171').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTitle('Next activity')).toBeDisabled({ timeout: 15_000 });
    // View → Edit → natrag u View: popis košare ostaje (Prev s Druge vodi na Prvu, ne na
    // redak Aree izvan košare). Bez prenošenja View učita Areu i Prev pokaže „Nije u kosari".
    await page.getByRole('button', { name: 'Edit Activity' }).click();
    await expect(page).toHaveURL(/\/app\/edit\//, { timeout: 15_000 });
    await page.getByTitle('Discard changes and switch to View mode').click();
    await expect(page.getByText('Druga kupnja S171').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTitle('Previous activity').click();
    await expect(page.getByText('Prva kupnja S171').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTitle('Next activity').click();
    await expect(page.getByText('Druga kupnja S171').first()).toBeVisible({ timeout: 15_000 });
    // Gumb Back u View-u (ide ravno na početnu) ⇒ označena je Druga, na kojoj je STAO.
    // (Back preglednika bi prošao i kroz View Prve, pa bi ona bila zadnja prikazana.)
    await page.getByTitle('Back to list').click();
    const marked = page.getByTestId('baskets-tile').locator('tr[data-last-opened]');
    await expect(marked).toHaveCount(1, { timeout: 15_000 });
    await expect(marked).toContainText('Druga kupnja S171');

    // 3c. „Isti dan u Activities ↗" na Drugoj ⇒ Activities, raspon = taj dan, samo Druga.
    await tile.getByRole('button', { name: `Isti dan u Activities ${inDays(-30)}` }).click();
    await expect(page.getByTestId('filter-summary')).toContainText('Custom', { timeout: 15_000 });
    // Lista ima i skriveni desktop redak (`hidden sm:table-row`) — gleda se samo vidljivo.
    await expect(page.locator(':text("Druga kupnja S171"):visible').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Prva kupnja S171')).toHaveCount(0);
    await expect(page.getByText('Nije u kosari S171')).toHaveCount(0);
    // Natrag na Overview za ostatak testa; razdoblje vrati na This Month.
    await strip.locator('> button').first().click();
    await expect(page.getByRole('heading', { name: /Košare/ })).toBeVisible({ timeout: 15_000 });

    // 4. Activities: sklopljen filtar sa sažetkom razdoblja (dan iz 3c, Custom).
    await strip.locator('> button').nth(1).click();
    await expect(summary).toContainText('Filter');
    await expect(summary).toContainText('Custom');
    await expect(areaSelect).toBeHidden();
    await summary.click();
    await expect(areaSelect).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible();
  });

  test('390 px, zapamćen tab Overview, a Area nije odabrana ⇒ izbornik Area vidljiv (T-S171-1)', async ({ page }) => {
    // Saša: odjava → prijava drugim računom → natrag ⇒ `All Areas`, tab i dalje
    // Overview, a filtar je nudio samo razdoblje — Areu nije imao gdje odabrati.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.setItem('ui:activeTab', 'overview'));
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await expect(areaSelect).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('filter-summary')).not.toContainText('📅');
    // Odabir Aree s Overviewom ⇒ tek tada red razdoblja.
    await areaSelect.selectOption(areaId);
    await expect(page.getByTestId('filter-summary')).toContainText('📅', { timeout: 15_000 });
  });

  test('ponovni ulazak u Areu nakon nove prijave ⇒ opet zadano This Year (T-S171-1)', async ({ page }) => {
    // Saša: odjava → prijava drugim računom → natrag ⇒ All Areas ⇒ Financije na All Time.
    // Odjava NE učitava stranicu, pa je modul DateRangeFiltera i dalje „znao" da je
    // This Year za tu Areu već dan. Isto se ovdje glumi navigacijom unutar appa
    // (bez reloada — reload bi modul počistio i test bi prošao i nad kvarom).
    await page.setViewportSize({ width: 1280, height: 900 });
    const areaSelect = await selectArea(page, areaId);
    const period = page.locator('select').filter({ has: page.locator('option', { hasText: 'This Month' }) });
    await expect(period).toHaveValue('this-year', { timeout: 15_000 });

    // „Odjava": FilterProvider se odmontira, zapamćeni filtar ne vrijedi (drugi korisnik).
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('events-tracker-filter-state')) localStorage.removeItem(k);
      history.pushState({}, '', '/debug');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(areaSelect).toHaveCount(0, { timeout: 15_000 });
    await page.evaluate(() => { history.pushState({}, '', '/app'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(areaSelect).toHaveValue('', { timeout: 15_000 });

    await areaSelect.selectOption(areaId);
    await expect(period).toHaveValue('this-year', { timeout: 15_000 });
  });

  test('široki ekran: Overview i dalje nudi puni filtar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAll(page);
    const areaSelect = await selectArea(page, areaId);
    await page.getByRole('button', { name: /Overview/i }).click();
    await expect(page.getByRole('heading', { name: /Stanje po računu/ })).toBeVisible({ timeout: 15_000 });
    await expect(areaSelect).toBeVisible();
    await expect(page.getByTestId('filter-summary')).not.toContainText('📅');
    await expect(page.getByTestId('baskets-tile')).toBeVisible();
  });
});
