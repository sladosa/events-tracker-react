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
        dashboard: { widgets: [FX.widget] },
        groupings: { [FX.widget.grouping]: FX.grouping },
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
    await page.screenshot({ path: 'e2e/test-results/S165_breakdown_wide.png', fullPage: true });

    await page.getByRole('button', { name: 'po naplati' }).click();
    await expect(page.getByText('39.305,20 €').first()).toBeVisible();
    await expect(page.getByText('19.939,85 €')).toBeVisible();
    expect(asked).toContain('datum_naplate');

    await page.getByRole('button', { name: 'Prihodi', exact: true }).click();
    await expect(page.getByRole('button', { name: /^▸ Prihodi/ })).toBeVisible();
  });

  test('uski ekran: lista bez kruga, sklapanje preživi reload', async ({ page }) => {
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

    await page.getByRole('heading', { name: /Kamo ide novac/ }).click();
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Kamo ide novac/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Mjesečni troškovi/ })).toHaveCount(0);
  });
});
