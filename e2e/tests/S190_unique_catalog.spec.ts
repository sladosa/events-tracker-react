/**
 * S190 (korak 5) — katalog vježbi: jedinstven slug, prijedlog iz imena, Area bez vremena.
 *
 * ODLUKA (`TRENING_MIGRACIJA.md` „Korak 5 — odluke S190"): slug je trajni ključ treninga, pa
 *   ga forma predlaže iz imena, pokazuje slične postojeće zapise i NE SPREMA duplikat. Area s
 *   `add_header {timer:false, date:false, note:false}` nema datum/vrijeme ni u Editu, ni Event Note.
 *
 * ŠTO SE MJERI (ono što korisnik vidi + što baza dobije):
 *   Add — upiši ime ⇒ slug predložen; slično („lat_raises") nabrojano; ručno upisan postojeći
 *     slug ⇒ crveno + Finish odbije s porukom, u bazi i dalje 1 zapis; drugi slug ⇒ 2 zapisa;
 *     nema Event Note ni štoperice.
 *   Edit — nema polja datuma ni vremena; slug postojećeg zapisa nije sam sebi duplikat (Save prolazi).
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('S190 — katalog: jedinstven slug', () => {
  let areaId = '';
  let leafId = '';
  const ids = { name: '', slug: '' };
  const start = '2026-10-31T08:00:00+00:00';
  let seeded = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    leafId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S190 katalog w${test.info().workerIndex}`,
      slug: `s190-kat-${areaId.slice(0, 6)}`, sort_order: 97,
      settings: { disable_save_plus: true, add_header: { timer: false, date: false, note: false } },
    });
    await supabasePost(page, 'categories', {
      id: leafId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Vježba', slug: `vjezba-${leafId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    ids.name = randomUUID();
    ids.slug = randomUUID();
    await supabasePost(page, 'attribute_definitions', {
      id: ids.name, user_id: OWNER_ID, category_id: leafId, name: 'Name', slug: 'name',
      data_type: 'text', is_required: true, sort_order: 1, validation_rules: {},
    });
    await supabasePost(page, 'attribute_definitions', {
      id: ids.slug, user_id: OWNER_ID, category_id: leafId, name: 'Slug', slug: 'slug',
      data_type: 'text', is_required: true, sort_order: 2, validation_rules: { unique: { from: 'name' } },
    });
    seeded = randomUUID();
    await supabasePost(page, 'events', {
      id: seeded, user_id: OWNER_ID, category_id: leafId, event_date: '2026-10-31', session_start: start,
    });
    for (const [k, v] of [['name', 'Lateralno podizanje ruku'], ['slug', 'lat_raises']] as const) {
      await supabasePost(page, 'event_attributes', {
        event_id: seeded, user_id: OWNER_ID, attribute_definition_id: ids[k], value_text: v,
      });
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const labelOf = (page: Page, name: string) => page.locator('label', { hasText: new RegExp(`^${name}`) });
  const fieldOf = (page: Page, name: string) =>
    page.locator('div.space-y-1', { has: labelOf(page, name) }).locator('input, textarea').first();
  const countEvents = async (page: Page) =>
    (await supabaseGet(page, 'events', { category_id: leafId }) as unknown[]).length;

  test('Add: prijedlog iz imena, slično, duplikat odbijen, bez Event Note i štoperice', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/app');
    await selectFilterPath(page, areaId, [leafId]);
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    await expect(fieldOf(page, 'Name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Event Note')).toHaveCount(0);
    await expect(page.getByText('SESSION', { exact: true })).toHaveCount(0);

    await fieldOf(page, 'Name').fill('Hand lateral raises');
    await expect(fieldOf(page, 'Slug')).toHaveValue('hand_lateral');
    await expect(page.getByText('Slično u kategoriji:')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('lat_raises', { exact: true })).toBeVisible();

    await fieldOf(page, 'Slug').fill('lat_raises');
    await expect(page.getByText(/„lat_raises" već postoji/).first()).toBeVisible();
    await fieldOf(page, 'Name').fill('Hand lateral raise');            // ime se mijenja, ručni slug ostaje
    await expect(fieldOf(page, 'Slug')).toHaveValue('lat_raises');

    await page.getByRole('button', { name: /finish/i }).click();
    await expect(page.getByText(/Slug „lat_raises" već postoji — izaberi drugu/)).toBeVisible({ timeout: 10_000 });
    expect(await countEvents(page)).toBe(1);

    await fieldOf(page, 'Slug').fill('hand_lat');
    await page.getByRole('button', { name: /finish/i }).click();
    await expect.poll(() => countEvents(page), { timeout: 20_000 }).toBe(2);
  });

  test('Edit: bez datuma i vremena, vlastiti slug nije duplikat', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/app/edit/${encodeURIComponent(start)}?categoryId=${leafId}`);
    await expect(fieldOf(page, 'Slug')).toHaveValue('lat_raises', { timeout: 20_000 });
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.locator('input[type="time"]')).toHaveCount(0);
    await expect(page.getByText('Duration', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Event Note')).toHaveCount(0);

    await fieldOf(page, 'Name').fill('Lateralno podizanje ruku (bučice)');
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect.poll(async () => {
      const rows = await supabaseGet(page, 'event_attributes', { event_id: seeded }) as
        { attribute_definition_id: string; value_text: string | null }[];
      return rows.find(r => r.attribute_definition_id === ids.name)?.value_text;
    }, { timeout: 20_000 }).toBe('Lateralno podizanje ruku (bučice)');
  });
});
