/**
 * S168 — D7 (DOSPJELO_SPEC §8): traka „Čeka potvrdu" prvo PITA.
 *
 * Saša (11.10.2026.): „neka pita je li banka skinula onoliko koliko očekujemo,
 *   da se ne mora upisivati ako je ok". Vlasnica vidi „Je li banka skinula Σ?"
 *   i dodirne DAN; tipka samo kad se ne slaže.
 *
 * ŠTO SE MJERI (i zašto baš to):
 *   - nijedan dan NIJE unaprijed označen (BUG-S115: pogođen datum izgleda kao podatak)
 *   - nudi se dospijeće … danas, budući dan nikad
 *   - dodir dana NE upisuje odmah — dva koraka ostaju (sažetak pa „Da, upiši")
 *   - „drukčije" otvara PRAZNA ručna polja (Σ unaprijed bi bila tautologija, §2.17)
 *
 * Košara dolazi iz podmetnutog `rpc_area_due_baskets` — Area je prazna, pa
 * pravilo B (skupni redak) i C (ručni redak) uredno ne nađu ništa. Ništa se ne
 * upisuje: test staje prije „Da, upiši".
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const DOW = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const label = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(Date.UTC(+y, +m - 1, +d, 12)).getUTCDay()]} ${d}.${m}.`;
};
const hr = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}.`; };

const today = ymd(new Date());
const yesterday = ymd(new Date(Date.now() - 86_400_000));

async function mockDue(page: Page) {
  await page.route(/\/rest\/v1\/rpc\/rpc_area_due_baskets/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      basket: 'Mastercard', due_date: yesterday, n: 55, n_pending: 55,
      gross_plus: 0, gross_minus: 1189.34,
    }]),
  }));
}

test.describe('S168 — D7: traka pita, ne traži tipkanje', () => {
  test.setTimeout(90_000);
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S168 traka w${test.info().workerIndex}`,
      slug: `s168-traka-${areaId.slice(0, 6)}`, sort_order: 94,
      settings: {
        dashboard: {
          widgets: [{
            type: 'balance_by_group', title: 'Stanje', group_by: 'racun',
            plus: 'uplata', minus: 'isplata', unit: '€', filters: [],
            due: {
              basket_by: 'izvorplacanja', due_slug: 'datum_naplate', status_slug: 'status',
              pending: 'Planiran', done: 'Izvrsen',
              baskets: { Mastercard: { account: 'ZABA', text: 'TROŠKOVI MC S168' } },
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

  test('pitanje → dan → sažetak; „drukčije" otvara prazna polja', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockDue(page);
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);
    await page.getByRole('button', { name: /Overview/i }).click();

    // 1. Pitanje s iznosom, bez ručnih polja
    await expect(page.getByText(/Je li banka skinula/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Je li banka skinula/)).toContainText('1.189,34');
    await expect(page.getByPlaceholder('upiši s ekrana banke')).toHaveCount(0);

    // 2. Dani: jučer (dospijeće) i danas — nijedan označen, sutra se ne nudi
    const dYest = page.getByRole('button', { name: label(yesterday), exact: true });
    const dToday = page.getByRole('button', { name: label(today), exact: true });
    await expect(dYest).toBeVisible();
    await expect(dToday).toBeVisible();
    await expect(dYest).not.toHaveClass(/bg-emerald-600/);
    await expect(dToday).not.toHaveClass(/bg-emerald-600/);
    const tomorrow = ymd(new Date(Date.now() + 86_400_000));
    await expect(page.getByRole('button', { name: label(tomorrow), exact: true })).toHaveCount(0);

    // 3. Dodir dana ⇒ SAŽETAK (drugi korak), ne upis
    await dToday.click();
    await expect(dToday).toHaveClass(/bg-emerald-600/);
    const summary = page.getByText(/Upisat ću redak/);
    await expect(summary).toBeVisible({ timeout: 15_000 });
    await expect(summary).toContainText(hr(today));
    await expect(summary).toContainText('1.189,34');
    await expect(page.getByRole('button', { name: 'Da, upiši' })).toBeVisible();
    await page.getByRole('button', { name: 'Odustani' }).click();

    // 4. „Drukčije" ⇒ ručna polja, PRAZNA (ni Σ ni dan unaprijed)
    await page.getByRole('button', { name: /iznos ili dan je drukčiji/ }).click();
    const amount = page.getByPlaceholder('upiši s ekrana banke');
    await expect(amount).toBeVisible();
    await expect(amount).toHaveValue('');
    await expect(page.locator('input[type="date"][id^="due-d-"]')).toHaveValue('');

    // 5. Natrag na pitanje
    await page.getByRole('button', { name: /ipak se slaže/ }).click();
    await expect(page.getByText(/Je li banka skinula/)).toBeVisible();
    await expect(page.getByPlaceholder('upiši s ekrana banke')).toHaveCount(0);
  });
});
