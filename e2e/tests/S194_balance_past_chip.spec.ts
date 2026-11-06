/**
 * S194 T46 — saldo na prošli dan mora to REĆI i ponuditi izlaz.
 *
 * Saša 05.11.: filtar je ostao „Custom" (tražen redak 01.11.), a pločica „Stanje po
 * računu" izgledala je kao današnja — saldo se računa na zadnji dan filtra. Do S194
 * je postojala samo sitna oznaka „na dan …" ispod naslova, bez razloga i bez izlaza.
 *
 * ŠTO SE MJERI:
 *   - This Year (zadano Aree): čipa NEMA (budući kraj razdoblja nije prošlo očitanje);
 *   - Custom koji završava u prošlosti: čip u ravnini s naslovom kaže dan I razdoblje;
 *   - „↺ This Year" vraća zadano razdoblje Aree ⇒ čip nestaje, Period = This Year.
 * Saldo dolazi iz podmetnutog RPC-a; Area ima jedan event (granice datuma).
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

async function mockBalance(page: Page) {
  await page.route(/\/rest\/v1\/rpc\/rpc_area_balance_anchored/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      group_value: 'ZABA', anchored: true, anchor_amount: 1000, anchor_on: inDays(-40),
      plus_sum: 0, minus_sum: 0, n: 0, balance: 1000, last_on: null,
    }]),
  }));
}

test.describe('S194 — čip „saldo na dan" (T46)', () => {
  test.setTimeout(90_000);
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S194 saldo w${test.info().workerIndex}`,
      slug: `s194-saldo-${areaId.slice(0, 6)}`, sort_order: 96,
      settings: {
        default_period: 'this-year',
        dashboard: { widgets: [{
          type: 'balance_by_group', title: 'Stanje po računu', group_by: 'racun',
          plus: 'uplata', minus: 'isplata', unit: '€', filters: [],
        }] },
      },
    });
    const catId = randomUUID();
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId,
      event_date: inDays(-20), session_start: `${inDays(-20)}T09:00:00+00:00`, comment: 'S194 seed',
    });
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('Custom u prošlosti ⇒ čip s razdobljem; ↺ This Year ga vraća', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockBalance(page);
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);
    await page.getByRole('button', { name: 'Overview' }).click({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Stanje po računu/ })).toBeVisible({ timeout: 15_000 });

    const period = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Time' }) });
    await expect(period).toHaveValue('this-year', { timeout: 15_000 });
    const chip = page.getByTestId('balance-past-chip');
    await expect(page.getByText('1.000,00 €').first()).toBeVisible({ timeout: 15_000 });
    await expect(chip).toHaveCount(0);   // This Year završava u budućnosti ⇒ saldo je današnji

    // Custom koji završava prije 5 dana — kao S192 (tražen redak 01.11.).
    const past = inDays(-5);
    await page.locator('input[type="date"]').nth(1).fill(past);
    await expect(period).toHaveValue('__custom__');
    const [y, m, d] = past.split('-');
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await expect(chip).toContainText(`na dan ${d}.${m}.${y}.`);
    await expect(chip).toContainText('Custom');

    await chip.getByRole('button', { name: /This Year/ }).click();
    await expect(chip).toHaveCount(0, { timeout: 15_000 });
    await expect(period).toHaveValue('this-year');
    const yr = new Date().getFullYear();
    await expect(page.locator('input[type="date"]').nth(1)).toHaveValue(`${yr}-12-31`);
  });
});
