/**
 * S175 — Activities uvoz „Create categories & continue" STVARA ono što nedostaje,
 * a postojeću Areu NE MIJENJA.
 *
 * ZAŠTO
 *   Activities export nosi i Structure sheetove (Structure, Automations,
 *   ListColumns, od F5 i AreaSettings). Kad file ima kategoriju koje u bazi nema,
 *   uvoz nudi „Create categories & continue" — a taj je pokretao CIJELI Structure
 *   uvoz. Stari file bi tako usput vratio postavke Aree (pločice, grupiranja…) i
 *   opcije izbornika na stanje iz trenutka izvoza (razred T-S145-4). Saša (S175):
 *   napredak Aree ne smije se vratiti unatrag slučajnim putem.
 *
 * TOK
 *   Area s dvije kategorije (Trans, Druga) i po jednim eventom → Activities export.
 *   Zatim „napredak" u bazi: naslov pločice Staro → Novo, opcija C dodana u izbornik;
 *   a Druga obrisana (pa je u fileu kategorija koje nema). Uvoz filea ⇒ Korak 7 ⇒
 *   Druga ponovo postoji, a naslov i opcije su i dalje NOVI.
 *   Test se razlikuje od onoga što bi stari kod proizveo (pravilo S129): stari bi
 *   vratio `Staro` i opcije bez C.
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, supabaseDelete, supabasePatch, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.setTimeout(180_000);

test.describe('S175 — Create categories & continue ne dira postojeću Areu', () => {
  let areaId = '';
  let transId = '';
  let drugaId = '';
  let attrId = '';
  let drugaEventId = '';
  let areaName = '';

  const dashboard = (title: string) => ({
    widgets: [{ type: 'balance_by_group', title, group_by: 'racun', plus: 'uplata', minus: 'isplata', filters: [] }],
  });

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID(); transId = randomUUID(); drugaId = randomUUID(); attrId = randomUUID();
    drugaEventId = randomUUID();
    areaName = `S175 k7 w${test.info().workerIndex} ${areaId.slice(0, 4)}`;
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: areaName,
      slug: `s175-k7-${areaId.slice(0, 6)}`, sort_order: 93, settings: { dashboard: dashboard('Staro') },
    });
    for (const [id, name, sort] of [[transId, 'Trans', 1], [drugaId, 'Druga', 2]] as const) {
      await supabasePost(page, 'categories', {
        id, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
        name, slug: `${name.toLowerCase()}-${id.slice(0, 6)}`, level: 1, sort_order: sort,
      });
    }
    await supabasePost(page, 'attribute_definitions', {
      id: attrId, user_id: OWNER_ID, category_id: transId, name: 'Racun', slug: 'racun',
      data_type: 'text', is_required: false, sort_order: 1,
      validation_rules: { type: 'suggest', suggest: ['A', 'B'] },
    });
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: transId,
      event_date: '2026-03-03', session_start: '2026-03-03T09:00:00+00:00', comment: 'S175 trans',
    });
    await supabasePost(page, 'events', {
      id: drugaEventId, user_id: OWNER_ID, category_id: drugaId,
      event_date: '2026-03-04', session_start: '2026-03-04T09:00:00+00:00', comment: 'S175 druga',
    });
    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('stari Activities file: Korak 7 stvori kategoriju, a naslov pločice i opcije ostanu novi', async ({ page }) => {
    // 1. Activities export cijele Aree (nosi Structure + AreaSettings sa „Staro" i opcijama A, B)
    await selectFilterPath(page, areaId, []);
    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
    const dl = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S175k7-')), 'activities.xlsx');
    await (await dl).saveAs(file);
    await page.getByRole('button', { name: '×' }).first().click();

    // 2. Napredak u bazi poslije izvoza + kategorija koje više nema
    await supabasePatch(page, 'areas', { id: areaId }, { settings: { dashboard: dashboard('Novo') } });
    await supabasePatch(page, 'attribute_definitions', { id: attrId },
      { validation_rules: { type: 'suggest', suggest: ['A', 'B', 'C'] } });
    await supabaseDelete(page, 'events', { id: drugaEventId });
    await supabaseDelete(page, 'categories', { id: drugaId });
    expect(await supabaseGet(page, 'categories', { id: drugaId }, 'id'), 'Druga nije obrisana').toHaveLength(0);

    // 3. Uvoz starog filea ⇒ nedostaje kategorija ⇒ Korak 7
    await page.goto('/app');
    await selectFilterPath(page, areaId, []);
    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(file);
    const create = page.getByRole('button', { name: /create categories/i });
    await expect(create).toBeVisible({ timeout: 60_000 });
    await create.click();
    // Korak 7 je prošao kad se nudi sam uvoz retka (ili pitanje o tuđim retcima).
    await expect(page.getByRole('button', { name: /apply import/i })).toBeVisible({ timeout: 60_000 });

    // 4. Kategorija je stvorena — Korak 7 i dalje radi svoj posao
    const cats = await supabaseGet(page, 'categories', { area_id: areaId }, 'id,name');
    expect((cats as { name: string }[]).map(c => c.name).sort(), 'Druga nije ponovo stvorena').toEqual(['Druga', 'Trans']);

    // 5. …a postojeća Area NIJE vraćena na stanje iz filea
    const area = (await supabaseGet(page, 'areas', { id: areaId }, 'id,settings'))[0] as
      { settings: { dashboard: { widgets: { title: string }[] } } };
    expect(area.settings.dashboard.widgets[0].title, 'stari file vratio je naslov pločice').toBe('Novo');
    const attr = (await supabaseGet(page, 'attribute_definitions', { id: attrId }, 'id,validation_rules'))[0] as
      { validation_rules: { suggest: string[] } };
    expect(attr.validation_rules.suggest, 'stari file vratio je opcije izbornika').toEqual(['A', 'B', 'C']);
  });
});
