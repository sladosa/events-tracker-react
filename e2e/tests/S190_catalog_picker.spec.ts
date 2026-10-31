/**
 * S190 (korak 5) — izbornik iz zapisa DRUGE Aree (`options_from`, katalog vježbi).
 *
 * ODLUKA (`TRENING_MIGRACIJA.md` „Korak 5 — odluke S190", Saša 31.10.):
 *   bez tražilice; skupine (otvorena jedna); u skupini prvo najčešće u zadnjih 12 mj kod tog
 *   korisnika, najviše 6 + „Sve"; dodir na zapis ⇒ KARTICA, tek „Izaberi" upisuje; vlasnik
 *   kataloga u kartici uređuje zapis bez izlaska iz forme.
 *
 * ŠTO SE MJERI (ono što korisnik vidi + što baza dobije):
 *   - skupina A ima 8 zapisa: vidi se 6, prvi su a8 (3 treninga) i a7 (1), „Sve (8)" pokaže ostale;
 *   - dodir na A8 NE mijenja polje (kartica s opisom), „Uredi vježbu" ⇒ ime spremljeno u katalog;
 *   - „Izaberi" ⇒ polje pokazuje novo ime, Finish ⇒ u bazi treninga je SLUG `a8`.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const ymd = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('S190 — izbornik iz kataloga', () => {
  let catArea = '', catLeaf = '', trArea = '', trLeaf = '', vjezbaDef = '';
  const cat = { slug: '', name: '', group: '', desc: '' };
  let catName = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    const w = test.info().workerIndex;

    // ── katalog: 8 zapisa u skupini A, 1 u B
    catArea = randomUUID(); catLeaf = randomUUID();
    catName = `S190 Katalog w${w} ${catArea.slice(0, 4)}`;
    await supabasePost(page, 'areas', { id: catArea, user_id: OWNER_ID, name: catName, slug: `s190-kat-${catArea.slice(0, 6)}`, sort_order: 98 });
    await supabasePost(page, 'categories', { id: catLeaf, user_id: OWNER_ID, area_id: catArea, parent_category_id: null,
      name: 'Vježba', slug: `vjezba-${catLeaf.slice(0, 6)}`, level: 1, sort_order: 1 });
    const defs = [
      ['slug', 'Slug', {}], ['name', 'Name', {}],
      ['group', 'Group', { type: 'suggest', suggest: ['B', 'A'] }], ['desc', 'Description', {}],
    ] as const;
    for (const [i, [k, n, rules]] of defs.entries()) {
      cat[k] = randomUUID();
      await supabasePost(page, 'attribute_definitions', { id: cat[k], user_id: OWNER_ID, category_id: catLeaf, name: n, slug: k,
        data_type: 'text', is_required: k === 'slug' || k === 'name', sort_order: i + 1, validation_rules: rules });
    }
    const rows = [...Array.from({ length: 8 }, (_, i) => [`a${i + 1}`, `A${i + 1} vježba`, 'A']), ['b1', 'B1 vježba', 'B']];
    for (const [i, [slug, name, group]] of rows.entries()) {
      const ev = randomUUID();
      await supabasePost(page, 'events', { id: ev, user_id: OWNER_ID, category_id: catLeaf, event_date: '2026-10-31',
        session_start: `2026-10-31T08:${String(i).padStart(2, '0')}:00+00:00` });
      const vals: [string, string][] = [['slug', slug], ['name', name], ['group', group]];
      if (slug === 'a8') vals.push(['desc', 'Opis vježbe A8: laktovi uz tijelo, polako spuštati tri sekunde.']);
      for (const [k, v] of vals) {
        await supabasePost(page, 'event_attributes', { event_id: ev, user_id: OWNER_ID, attribute_definition_id: cat[k as keyof typeof cat], value_text: v });
      }
    }

    // ── trening: leaf Gym s poljem `vjezba` iz kataloga + povijest (a8 3 dana, a7 1 dan, a5 prije 2 godine)
    trArea = randomUUID(); trLeaf = randomUUID(); vjezbaDef = randomUUID();
    await supabasePost(page, 'areas', { id: trArea, user_id: OWNER_ID, name: `S190 Trening w${w}`, slug: `s190-tr-${trArea.slice(0, 6)}`, sort_order: 99 });
    await supabasePost(page, 'categories', { id: trLeaf, user_id: OWNER_ID, area_id: trArea, parent_category_id: null,
      name: 'Gym', slug: `gym-${trLeaf.slice(0, 6)}`, level: 1, sort_order: 1 });
    await supabasePost(page, 'attribute_definitions', { id: vjezbaDef, user_id: OWNER_ID, category_id: trLeaf, name: 'vjezba', slug: 'vjezba',
      data_type: 'text', is_required: false, sort_order: 1,
      validation_rules: { options_from: { area: catName, category: 'Vježba', attribute: 'slug', label: 'name', group: 'group' } } });
    const history: [string, number][] = [['a8', 3], ['a8', 10], ['a8', 20], ['a7', 5], ['a5', 800]];
    for (const [i, [slug, ago]] of history.entries()) {
      const ev = randomUUID();
      await supabasePost(page, 'events', { id: ev, user_id: OWNER_ID, category_id: trLeaf, event_date: ymd(ago),
        session_start: `${ymd(ago)}T07:${String(i).padStart(2, '0')}:00+00:00` });
      await supabasePost(page, 'event_attributes', { event_id: ev, user_id: OWNER_ID, attribute_definition_id: vjezbaDef, value_text: slug });
    }
  });

  test.afterEach(async ({ page }) => {
    if (trArea) await deleteAreaCascade(page, trArea);
    if (catArea) await deleteAreaCascade(page, catArea);
  });

  const dialog = (page: Page) => page.getByRole('dialog');

  test('skupina po učestalosti, kartica prije izbora, uređivanje, slug u bazi', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/app');
    await selectFilterPath(page, trArea, [trLeaf]);
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    await page.getByRole('button', { name: /Izaberi vjezba/ }).click({ timeout: 20_000 });
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: /^A\b.*zapisa/ }).click();
    const names = dialog(page).locator('button span.font-semibold.truncate');
    await expect(names).toHaveText(['A8 vježba', 'A7 vježba', 'A1 vježba', 'A2 vježba', 'A3 vježba', 'A4 vježba'], { timeout: 15_000 });
    await expect(dialog(page).getByText('3× u 12 mj')).toBeVisible();
    await expect(dialog(page).getByText(/zadnje prije 3 d/)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Sve (8)' }).click();
    await expect(names).toHaveCount(8);

    // Dodir ⇒ kartica, polje se ne mijenja
    await dialog(page).getByRole('button', { name: /A8 vježba/ }).click();
    await expect(dialog(page).getByRole('heading', { name: 'A8 vježba' })).toBeVisible();
    await expect(dialog(page).getByText(/Opis vježbe A8/)).toBeVisible();

    // Uredi ⇒ ime u katalogu
    await dialog(page).getByRole('button', { name: 'Uredi vježbu' }).click();
    const nameBox = dialog(page).locator('label', { hasText: /^Name/ }).locator('textarea');
    await nameBox.fill('A8 nova');
    await dialog(page).getByRole('button', { name: 'Spremi' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'A8 nova' })).toBeVisible({ timeout: 15_000 });
    await expect(dialog(page).getByText('Spremljeno u katalog.')).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Izaberi', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /A8 nova/ })).toBeVisible();

    await page.getByRole('button', { name: /finish/i }).click();
    await expect.poll(async () => {
      const rows = await supabaseGet(page, 'event_attributes', { attribute_definition_id: vjezbaDef }) as { value_text: string }[];
      return rows.length;
    }, { timeout: 20_000 }).toBe(6);
    const rows = await supabaseGet(page, 'event_attributes', { attribute_definition_id: vjezbaDef }) as { value_text: string }[];
    expect(rows.filter(r => r.value_text === 'a8')).toHaveLength(4);
  });
});
