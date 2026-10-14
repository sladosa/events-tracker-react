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

const E1 = randomUUID();
const E2 = randomUUID();

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
      { event_id: E1, user_id: OWNER_ID, category_id: randomUUID(), status: 'Planiran', plus_v: null, minus_v: 150 },
      { event_id: E2, user_id: OWNER_ID, category_id: randomUUID(), status: 'Planiran', plus_v: null, minus_v: 50 },
    ]),
  }));
  // ⚠ Kao pravi PostgREST: druga stranica je PRAZNA — `fetchAllPaged` staje tek
  //   na praznoj, pa mock koji uvijek vraća retke vrti beskonačno.
  await page.route(/\/rest\/v1\/events\?select=id%2Cevent_date%2Csession_start%2Ccomment/, route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? 0);
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(offset > 0 ? [] : [
        { id: E2, event_date: inDays(-30), session_start: null, comment: 'Druga kupnja S171' },
        { id: E1, event_date: inDays(-35), session_start: null, comment: 'Prva kupnja S171' },
      ]),
    });
  });
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

    // 4. Activities: sklopljen filtar sa sažetkom razdoblja.
    await strip.locator('> button').nth(1).click();
    await expect(summary).toContainText('Filter');
    await expect(summary).toContainText('This Month');
    await expect(areaSelect).toBeHidden();
    await summary.click();
    await expect(areaSelect).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeVisible();
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
