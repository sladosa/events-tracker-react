/**
 * S187 (d1) — polje s `default_value` se u Add formi PRIKAZUJE, popunjeno.
 *
 * ODLUKA (Saša, 27.10.2026., `TRENING_MIGRACIJA.md` „Dogovor 28.10."): ukida se
 *   implicitno skrivanje na defaultu (S117 „hide-at-default"). Forma je skrivala
 *   svako polje čija je vrijednost jednaka `default_value` — pravilo koje nitko
 *   nije postavio — pa su u Fitnessu `intensity`, `Cardio_type`, `equipment`…
 *   stajali u liniji „na defaultu" umjesto na ekranu.
 *
 * ŠTO SE MJERI (obje strane, da test može pasti):
 *   - `Oprema` (default `orb`) i `Vrsta` (default `Z2`) su na ekranu, s defaultom
 *     odabranim; linije „na defaultu" nema. Nad starim kodom oba polja fale.
 *   - `Napomena` (`hidden_in_add`) je i dalje skrivena i imenovana u liniji
 *     „prazna po pravilu"; „Show all" je otkrije. Time `HiddenInAdd` ostaje jedini
 *     način skrivanja — a test ne prolazi ni nad kodom koji više ništa ne skriva.
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

test.describe('S187 — default ne skriva polje', () => {
  let areaId = '';
  let actId = '';
  let cardioId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    actId = randomUUID();
    cardioId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S187 default w${test.info().workerIndex}`,
      slug: `s187-default-${areaId.slice(0, 6)}`, sort_order: 95,
    });
    await supabasePost(page, 'categories', {
      id: actId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Activity', slug: `activity-${actId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'categories', {
      id: cardioId, user_id: OWNER_ID, area_id: areaId, parent_category_id: actId,
      name: 'Cardio', slug: `cardio-${cardioId.slice(0, 6)}`, level: 2, sort_order: 1,
    });
    const attrs = [
      { name: 'Vrsta', slug: 'vrsta', def: 'Z2', rules: { type: 'suggest', suggest: ['Z2', 'HIIT'] } },
      { name: 'Oprema', slug: 'oprema', def: 'orb', rules: { type: 'suggest', suggest: ['orb', 'bic', 'erg'] } },
      { name: 'Napomena', slug: 'napomena', def: null, rules: { hidden_in_add: true } },
    ];
    for (const [i, a] of attrs.entries()) {
      await supabasePost(page, 'attribute_definitions', {
        id: randomUUID(), user_id: OWNER_ID, category_id: cardioId, name: a.name, slug: a.slug,
        data_type: 'text', is_required: false, sort_order: i + 1, default_value: a.def,
        validation_rules: a.rules,
      });
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('Vrsta i Oprema na ekranu s defaultom; Napomena skrivena dok Show all', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/app');
    await selectFilterPath(page, areaId, [actId, cardioId]);
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    const selectOf = (name: string) =>
      page.locator('select').filter({ has: page.locator('option', { hasText: `Select ${name}...` }) });

    await expect(selectOf('Vrsta')).toHaveValue('Z2', { timeout: 15_000 });
    await expect(selectOf('Oprema')).toHaveValue('orb');
    await expect(page.getByText('na defaultu')).toHaveCount(0);

    // `hidden_in_add` i dalje skriva — i imenuje.
    const hiddenLine = page.getByText('prazna po pravilu');
    await expect(hiddenLine).toBeVisible();
    await expect(page.getByRole('button', { name: 'Napomena', exact: true })).toBeVisible();
    await expect(page.locator('label', { hasText: /^Napomena$/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('label', { hasText: /^Napomena$/ })).toBeVisible();
    // Oznaka na samom polju (ne riječ u gumbu „Hide again (polja označena skriveno)").
    await expect(page.locator('span.absolute', { hasText: /^skriveno$/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Hide again/ })).toBeVisible();
  });
});
