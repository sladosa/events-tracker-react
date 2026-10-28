/**
 * S187 (korak 2) — pravilo vidljivosti `visible_when` u Add i Edit formi.
 *
 * ODLUKA (`TRENING_MIGRACIJA.md` „Dogovor 28.10."): polje vidljivo samo uz
 *   vrijednost X atributa Y; skriveno se ne sprema; obavezno samo dok je vidljivo;
 *   Edit NE skriva vrijednost spremljenu u bazi dok čovjek ne promijeni Y.
 *
 * ŠTO SE MJERI (ono što korisnik vidi + što baza dobije):
 *   Add — `serije` (obavezno, vrsta = Snaga) i `sprava` (default `orb`, vrsta = Z2 | HIIT):
 *     bez vrste oba skrivena; Snaga ⇒ serije; Z2 ⇒ serije nestaju, sprava = orb;
 *     natrag Snaga ⇒ serije PRAZNE (upisano je obrisano); Finish bez serija ⇒ poruka;
 *     u bazi vrsta + serije, a `sprava` NE (default skrivenog polja se ne sprema).
 *   Edit — redak Z2 sa serijama (stari, „izvan pravila"): serije vidljive s oznakom;
 *     vrsta → HIIT ⇒ serije nestaju; Save ⇒ u bazi serija više nema.
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('S187 — visible_when', () => {
  let areaId = '';
  let actId = '';
  let gymId = '';
  const ids = { vrsta: '', serije: '', sprava: '' };

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    actId = randomUUID();
    gymId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S187 vidljivost w${test.info().workerIndex}`,
      slug: `s187-vw-${areaId.slice(0, 6)}`, sort_order: 96,
    });
    await supabasePost(page, 'categories', {
      id: actId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Activity1', slug: `activity1-${actId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'categories', {
      id: gymId, user_id: OWNER_ID, area_id: areaId, parent_category_id: actId,
      name: 'Gym', slug: `gym-${gymId.slice(0, 6)}`, level: 2, sort_order: 1,
    });
    const attrs = [
      { key: 'vrsta' as const, required: false, def: null,
        rules: { type: 'suggest', suggest: ['Snaga', 'Z2', 'HIIT'] } },
      { key: 'serije' as const, required: true, def: null,
        rules: { visible_when: { attribute_slug: 'vrsta', values: ['Snaga'] } } },
      { key: 'sprava' as const, required: false, def: 'orb',
        rules: { type: 'suggest', suggest: ['orb', 'bic'], visible_when: { attribute_slug: 'vrsta', values: ['Z2', 'HIIT'] } } },
    ];
    for (const [i, a] of attrs.entries()) {
      ids[a.key] = randomUUID();
      await supabasePost(page, 'attribute_definitions', {
        id: ids[a.key], user_id: OWNER_ID, category_id: gymId, name: a.key, slug: a.key,
        data_type: 'text', is_required: a.required, sort_order: i + 1, default_value: a.def,
        validation_rules: a.rules,
      });
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const labelOf = (page: Page, name: string) => page.locator('label', { hasText: new RegExp(`^${name}`) });
  const inputOf = (page: Page, name: string) =>
    page.locator('div.space-y-1', { has: labelOf(page, name) }).locator('input').first();
  const selectOf = (page: Page, name: string) =>
    page.locator('select').filter({ has: page.locator('option', { hasText: `Select ${name}...` }) });

  /** Atributi eventa u bazi: slug → vrijednost. */
  async function stored(page: Page, eventId: string): Promise<Record<string, string>> {
    const rows = await supabaseGet(page, 'event_attributes', { event_id: eventId }) as
      { attribute_definition_id: string; value_text: string | null }[];
    const bySlug: Record<string, string> = {};
    for (const r of rows) {
      const slug = (Object.keys(ids) as (keyof typeof ids)[]).find(k => ids[k] === r.attribute_definition_id);
      if (slug) bySlug[slug] = r.value_text ?? '';
    }
    return bySlug;
  }

  test('Add: vrsta mijenja polja, skriveno se briše i ne sprema, obavezno samo vidljivo', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/app');
    await selectFilterPath(page, areaId, [actId, gymId]);
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    await expect(selectOf(page, 'vrsta')).toBeVisible({ timeout: 15_000 });
    await expect(labelOf(page, 'serije')).toHaveCount(0);
    await expect(selectOf(page, 'sprava')).toHaveCount(0);

    await selectOf(page, 'vrsta').selectOption('Snaga');
    await expect(labelOf(page, 'serije')).toBeVisible();
    await inputOf(page, 'serije').fill('55x12');

    await selectOf(page, 'vrsta').selectOption('Z2');
    await expect(labelOf(page, 'serije')).toHaveCount(0);
    await expect(selectOf(page, 'sprava')).toHaveValue('orb');

    await selectOf(page, 'vrsta').selectOption('Snaga');
    await expect(inputOf(page, 'serije')).toHaveValue('');           // upisano je obrisano
    await expect(selectOf(page, 'sprava')).toHaveCount(0);

    await page.getByRole('button', { name: /finish/i }).click();
    await expect(page.getByText('Polje "serije" je obavezno.')).toBeVisible({ timeout: 5_000 });

    await inputOf(page, 'serije').fill('60x10');
    await page.getByRole('button', { name: /finish/i }).click();

    let eventId = '';
    await expect.poll(async () => {
      const evs = await supabaseGet(page, 'events', { category_id: gymId }) as { id: string }[];
      eventId = evs[0]?.id ?? '';
      return evs.length;
    }, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => stored(page, eventId)).toEqual({ vrsta: 'Snaga', serije: '60x10' });
  });

  test('Edit: spremljena vrijednost izvan pravila je vidljiva dok se vrsta ne promijeni', async ({ page }) => {
    test.setTimeout(90_000);
    const start = '2024-12-03T14:27:00+00:00';
    const leaf = randomUUID();
    await supabasePost(page, 'events', {
      id: leaf, user_id: OWNER_ID, category_id: gymId, event_date: '2024-12-03', session_start: start,
    });
    await supabasePost(page, 'events', {
      id: randomUUID(), user_id: OWNER_ID, category_id: actId, event_date: '2024-12-03',
      session_start: start, chain_key: gymId,
    });
    for (const [k, v] of [['vrsta', 'Z2'], ['serije', '99x1'], ['sprava', 'bic']] as const) {
      await supabasePost(page, 'event_attributes', {
        event_id: leaf, user_id: OWNER_ID, attribute_definition_id: ids[k], value_text: v,
      });
    }

    await page.goto(`/app/edit/${encodeURIComponent(start)}?categoryId=${gymId}`);
    await expect(selectOf(page, 'vrsta')).toHaveValue('Z2', { timeout: 20_000 });
    await expect(inputOf(page, 'serije')).toHaveValue('99x1');
    await expect(page.getByText('izvan pravila', { exact: true })).toBeVisible();
    await expect(selectOf(page, 'sprava')).toHaveValue('bic');

    await selectOf(page, 'vrsta').selectOption('HIIT');
    await expect(labelOf(page, 'serije')).toHaveCount(0);
    await expect(selectOf(page, 'sprava')).toHaveValue('bic');        // i dalje vidljivo uz HIIT

    await page.getByRole('button', { name: /save/i }).first().click();
    await expect.poll(() => stored(page, leaf), { timeout: 20_000 }).toEqual({ vrsta: 'HIIT', sprava: 'bic' });
  });
});
