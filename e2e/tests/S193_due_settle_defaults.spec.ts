/**
 * S193 / T48 — skupni redak koji upisuje traka „Čeka potvrdu" nosi `default_map`.
 *
 * Izmjereno na PROD-u 05.11.2026.: Visa naplata 1.751,12 upisana iz trake BEZ
 * Namjene — forma i Excel uvoz (S181) upisuju zadano, traka nije. Razrez po
 * Namjeni takav redak šalje u nesvrstano, bez poruke.
 *
 * Mjeri se cijeli put nad PRAVOM košarom (bez podmetnutog RPC-a): dvije MC
 * kupnje `Planiran` s naplatom jučer ⇒ dan ⇒ „Da, upiši" ⇒ u bazi:
 *   - skupni redak ima Namjenu iz `default_map` (`*` ⇒ Zajedničko) — T48;
 *   - Tip iz configa (`settle`) NIJE pregažen (pravilo puni samo prazno);
 *   - obje kupnje su `Izvrsen` (put potvrde nije pokvaren).
 * Bez poziva `resolveDefaultMaps` u `createSettleRow` pada prva tvrdnja.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const DOW = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const label = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(Date.UTC(+y, +m - 1, +d, 12)).getUTCDay()]} ${d}.${m}.`;
};

const today = ymd(new Date());
const yesterday = ymd(new Date(Date.now() - 86_400_000));
const weekAgo = ymd(new Date(Date.now() - 7 * 86_400_000));
const SETTLE_TEXT = 'TROŠKOVI MC S193';

test.describe('S193 — T48: skupni redak iz trake nosi default_map', () => {
  test.setTimeout(120_000);
  let areaId = '';
  const ids: Record<string, string> = {};

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const catId = randomUUID();
    ids.cat = catId;
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S193 traka w${test.info().workerIndex}`,
      slug: `s193-traka-${areaId.slice(0, 6)}`, sort_order: 95,
      settings: {
        dashboard: {
          widgets: [{
            type: 'balance_by_group', title: 'Stanje', group_by: 'racun',
            plus: 'uplata', minus: 'isplata', unit: '€',
            filters: [{ slug: 'izvorplacanja', op: 'in', values: ['Racun'] }],
            due: {
              basket_by: 'izvorplacanja', due_slug: 'datum_naplate', status_slug: 'status',
              pending: 'Planiran', done: 'Izvrsen',
              baskets: { Mastercard: { account: 'ZABA', text: SETTLE_TEXT } },
              settle: { tip: 'Transfer', izvorplacanja: 'Racun' },
            },
          }],
        },
      },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    const attr = async (slug: string, name: string, data_type: string, sort: number, validation_rules: object = {}) => {
      const id = randomUUID();
      ids[slug] = id;
      await supabasePost(page, 'attribute_definitions', {
        id, user_id: OWNER_ID, category_id: catId, name, slug, data_type,
        is_required: false, sort_order: sort, validation_rules,
      });
    };
    await attr('racun', 'Racun', 'text', 1, { type: 'suggest', suggest: ['ZABA'] });
    await attr('izvorplacanja', 'Izvor', 'text', 2, { type: 'suggest', suggest: ['Racun', 'Mastercard'] });
    await attr('isplata', 'Isplata', 'number', 3);
    await attr('uplata', 'Uplata', 'number', 4);
    await attr('tip', 'Tip', 'text', 5, { type: 'suggest', suggest: ['Transfer', 'Razno'] });
    await attr('namjena', 'Namjena', 'text', 6, { depends_on: {
      attribute_slug: 'tip', options_map: { '*': ['Zajedničko', 'Koka'] }, default_map: { '*': 'Zajedničko' },
    } });
    await attr('status', 'Status', 'text', 7, { type: 'suggest', suggest: ['Izvrsen', 'Planiran'] });
    await attr('datum_naplate', 'Datum naplate', 'datetime', 8);

    // Dvije MC kupnje (Planiran), naplata jučer, Σ 30,50
    for (const [i, amount] of [[0, 10.25], [1, 20.25]] as const) {
      const evId = randomUUID();
      ids[`ev${i}`] = evId;
      await supabasePost(page, 'events', {
        id: evId, user_id: OWNER_ID, category_id: catId, event_date: weekAgo,
        session_start: `${weekAgo}T1${i}:00:00+00:00`, comment: `kupnja ${i}`,
      });
      const ea = (slug: string, col: string, v: unknown) => supabasePost(page, 'event_attributes', {
        event_id: evId, user_id: OWNER_ID, attribute_definition_id: ids[slug], [col]: v,
      });
      await ea('racun', 'value_text', 'ZABA');
      await ea('izvorplacanja', 'value_text', 'Mastercard');
      await ea('isplata', 'value_number', amount);
      await ea('tip', 'value_text', 'Razno');
      await ea('namjena', 'value_text', 'Koka');
      await ea('status', 'value_text', 'Planiran');
      await ea('datum_naplate', 'value_datetime', `${yesterday}T12:00:00+00:00`);
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const openOverview = async (page: Page) => {
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);
    await page.getByRole('button', { name: /Overview/i }).click();
  };

  test('Da, upiši ⇒ skupni redak ima Namjenu (default_map), Tip iz configa, kupnje Izvrsen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openOverview(page);

    const q = page.getByText(/Je li banka skinula/);
    await expect(q).toBeVisible({ timeout: 20_000 });
    await expect(q).toContainText('30,50');
    await page.getByRole('button', { name: label(today), exact: true }).click();
    await expect(page.getByText(/Upisat ću redak/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Da, upiši' }).click();

    // Redak upisan ⇒ traka nestaje (nema više Planiran u košari)
    await expect(q).toHaveCount(0, { timeout: 20_000 });

    const settle = await supabaseGet(page, 'events', { category_id: ids.cat, comment: SETTLE_TEXT }, 'id');
    expect(settle, 'skupni redak nije upisan').toHaveLength(1);
    const settleId = (settle[0] as { id: string }).id;
    const attrs = await supabaseGet(page, 'event_attributes', { event_id: settleId },
      'attribute_definition_id,value_text,value_number') as
      { attribute_definition_id: string; value_text: string | null; value_number: number | null }[];
    const bySlug = (slug: string) => attrs.find(a => a.attribute_definition_id === ids[slug]);
    expect(bySlug('namjena')?.value_text, 'T48: skupni redak bez Namjene').toBe('Zajedničko');
    expect(bySlug('tip')?.value_text, 'Tip iz configa pregažen').toBe('Transfer');
    expect(bySlug('isplata')?.value_number).toBe(30.5);

    for (const ev of ['ev0', 'ev1']) {
      const st = await supabaseGet(page, 'event_attributes',
        { event_id: ids[ev], attribute_definition_id: ids.status }, 'value_text') as { value_text: string }[];
      expect(st[0]?.value_text, `${ev} nije potvrđen`).toBe('Izvrsen');
    }
  });
});
