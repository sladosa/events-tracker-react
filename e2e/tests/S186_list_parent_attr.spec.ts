/**
 * S186 — kolona Activities liste čita atribut RODITELJSKE razine lanca.
 *
 * NALAZ (T-S185-2, 27.10.2026., TEST `Fitness_Garmin`): trening 01.12.2024. u
 *   View-u ima `mood` 4, a lista u koloni Mood piše `—`. `mood` je atribut
 *   kategorije `Activity` i živi na P2 roditeljskom eventu; lista ima retke samo
 *   za LEAF sesije i kolona je vrijednost tražila samo na leaf eventima.
 *
 * MJERI SE ISPISANA ĆELIJA, ne config: dvije sesije istog leafa —
 *   1. roditelj s `chain_key = leaf` i `mood` 4  ⇒ 🙂
 *   2. stari roditelj BEZ `chain_key` (jedini kandidat) i `mood` 2 ⇒ 🙁
 *      (PROD `Fitness` ima 6 takvih od 182; View ih nalazi, pa i lista mora)
 *   Leaf atribut (`equipment`) u istom retku ostaje kakav je bio.
 *   Nad starim kodom obje Mood ćelije pišu `—`.
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const MOOD_MAP = { '1': '☹', '2': '🙁', '3': '😐', '4': '🙂', '5': '😀' };

test.describe('S186 — kolona liste čita cijeli lanac', () => {
  let areaId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const actId = randomUUID();
    const cardioId = randomUUID();
    const moodId = randomUUID();
    const eqId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S186 lanac w${test.info().workerIndex}`,
      slug: `s186-lanac-${areaId.slice(0, 6)}`, sort_order: 94,
      settings: {
        list_columns: {
          columns: [
            { role: 'date' },
            { role: 'attr', label: 'Mood', slugs: ['mood'], map: MOOD_MAP },
            { role: 'attr', label: 'Oprema', slugs: ['equipment'] },
            { role: 'comment' },
            { role: 'actions' },
          ],
        },
      },
    });
    await supabasePost(page, 'categories', {
      id: actId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Activity', slug: `activity-${actId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'categories', {
      id: cardioId, user_id: OWNER_ID, area_id: areaId, parent_category_id: actId,
      name: 'Cardio', slug: `cardio-${cardioId.slice(0, 6)}`, level: 2, sort_order: 1,
    });
    await supabasePost(page, 'attribute_definitions', {
      id: moodId, user_id: OWNER_ID, category_id: actId, name: 'mood',
      slug: 'mood', data_type: 'number', is_required: false, sort_order: 1, validation_rules: {},
    });
    await supabasePost(page, 'attribute_definitions', {
      id: eqId, user_id: OWNER_ID, category_id: cardioId, name: 'equipment',
      slug: 'equipment', data_type: 'text', is_required: false, sort_order: 1, validation_rules: {},
    });

    const sessions = [
      { date: '2024-12-01', comment: 'S186 lanac chain_key', mood: 4, chained: true },
      { date: '2024-12-02', comment: 'S186 lanac legacy', mood: 2, chained: false },
    ];
    for (const s of sessions) {
      const start = `${s.date}T14:27:00+00:00`;
      const leaf = randomUUID();
      const parent = randomUUID();
      await supabasePost(page, 'events', {
        id: leaf, user_id: OWNER_ID, category_id: cardioId,
        event_date: s.date, session_start: start, comment: s.comment,
      });
      await supabasePost(page, 'events', {
        id: parent, user_id: OWNER_ID, category_id: actId,
        event_date: s.date, session_start: start, chain_key: s.chained ? cardioId : null,
      });
      await supabasePost(page, 'event_attributes', {
        event_id: leaf, user_id: OWNER_ID, attribute_definition_id: eqId, value_text: 'orb',
      });
      await supabasePost(page, 'event_attributes', {
        event_id: parent, user_id: OWNER_ID, attribute_definition_id: moodId, value_number: s.mood,
      });
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('Mood s roditelja: 🙂 (chain_key) i 🙁 (stari zapis), Oprema s leafa', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app');
    const areaSelect = page.locator('select').filter({
      has: page.locator('option[value=""]', { hasText: 'All Areas' }),
    });
    await areaSelect.waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect.selectOption(areaId);

    // Zadani filtar Aree može biti uži od 2024. — All Time ga otvori.
    const allTime = page.getByRole('button', { name: /all time/i });
    if (await allTime.isVisible().catch(() => false)) await allTime.click();

    // ⚠ Indeks kolone se čita UNUTAR poll-a: zaglavlje se zna jednom prerenderirati
    //   (zadane kolone → kolone Aree), a indeks −1 bi `nth(-1)` pretvorio u ćeliju ⋮.
    const cellText = (comment: string, label: string) => async () => {
      const headers = (await page.locator('thead tr:visible th').allInnerTexts()).map(t => t.trim());
      const idx = headers.indexOf(label);
      if (idx < 0) return `(nema kolone ${label})`;
      const row = page.locator('tr:visible', { hasText: comment });
      if (await row.count() !== 1) return '(nema retka)';
      return (await row.locator('td').nth(idx).innerText()).trim();
    };

    await expect.poll(cellText('S186 lanac chain_key', 'Mood'), { timeout: 20_000 }).toBe('🙂');
    await expect.poll(cellText('S186 lanac legacy', 'Mood')).toBe('🙁');
    await expect.poll(cellText('S186 lanac chain_key', 'Oprema')).toBe('orb');
    await expect.poll(cellText('S186 lanac legacy', 'Oprema')).toBe('orb');
  });
});
