/**
 * S168 — lista ne smije crtati retke sa ZADANIM kolonama dok postavke Aree
 * (`settings.list_columns`) još nisu stigle.
 *
 * NALAZ (Koka, mali iPhone, PROD 11.10.2026.): „pojavio se popis transakcija
 *   bez iznosa", pa nije reproducirano. Iz koda: `ActivitiesTable` zove
 *   `resolveColumns(listColumnsConfig)`, a dok `useAreaDashboard` nije odgovorio
 *   config je `null` ⇒ `DEFAULT_COLUMNS` — bez iznosa. Na sporoj mreži retci
 *   stignu prije postavki i taj prozor traje sekundama.
 *
 * MJERI SE TRENUTAK, ne kraj: na kraju su kolone uvijek točne (i nad starim
 *   kodom). Zato se čitanje postavki uspori 3 s, a provjera ide ČIM se redak
 *   pojavi — tada kolona iz configa već mora biti u zaglavlju.
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const LABEL = 'S168 Iznos';
const COMMENT = 'S168 redak bez iznosa?';

/** `useAreaDashboard` čita `areas?select=name,settings&id=eq.<uuid>`.
 *  ⚠ NE svako čitanje `areas` — FilterContext (`select=*`) i popis Area moraju
 *  proći, inače se Area ne da ni odabrati i test ne dođe do onoga što mjeri. */
const DASH_READ = /\/rest\/v1\/areas\?select=name[^&]*&id=eq\./;

test.describe('S168 — lista čeka kolone Aree', () => {
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const catId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S168 kolone w${test.info().workerIndex}`,
      slug: `s168-kol-${areaId.slice(0, 6)}`, sort_order: 93,
      settings: {
        list_columns: {
          columns: [
            { role: 'date' },
            { role: 'comment' },
            { role: 'attr', label: LABEL, slugs: ['iznos'], align: 'right' },
            { role: 'actions' },
          ],
        },
      },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Trans', slug: `trans-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'attribute_definitions', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId, name: 'Iznos',
      slug: 'iznos', data_type: 'number', is_required: false, sort_order: 1,
      validation_rules: {},
    });
    const today = new Date().toISOString().slice(0, 10);
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId,
      event_date: today, session_start: `${today}T07:00:00+00:00`, comment: COMMENT,
    });
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('retci se pojave tek s kolonama iz configa (postavke usporene 3 s)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    let delayed = 0;
    await page.route(DASH_READ, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      delayed++;
      await new Promise(r => setTimeout(r, 3_000));
      return route.fallback();
    });

    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);

    // Široki redak (`tr.hidden.sm:table-row`) — uski je na 1280 px skriven.
    const row = page.locator('tr:visible', { hasText: COMMENT });
    await expect(row).toBeVisible({ timeout: 20_000 });
    // Isti trenutak: kolona iz configa MORA već biti u zaglavlju. Nad starim kodom
    // ovdje stoje zadane kolone (retci su stigli ~3 s prije postavki).
    await expect(page.locator('th', { hasText: LABEL })).toHaveCount(1, { timeout: 150 });
    expect(delayed, 'čitanje postavki nije ni presretnuto — test ne bi ništa dokazao')
      .toBeGreaterThan(0);
  });
});
