/**
 * S186 — sheet `Restructure attributes` (F2 A1) kroz Structure uvoz, korak po korak.
 *
 * Tok (spec PREUREDJIVANJE_SPEC §29.6, odluke Saše S186):
 *   1. Structure export nosi prazan sheet; upiše se korak „mood → number" s mapom smajlića
 *      (i `:-|`, koji goli `|` razdvajač ne bi preživio).
 *   2. Uvoz ⇒ pregled: „Next · 3 rows"; bez kvačice nema primjene.
 *   3. Apply ⇒ ponovno mjerenje ✓, baza: tip number, vrijednosti 4 / 3 / 5, mapa kolone liste
 *      na ključevima `4` / `3` / `5` ⇒ lista i dalje pokazuje smajlić (S186 lanac).
 *   4. Undo ⇒ baza kao prije (tip text, `:-)`).
 *   5. Apply opet, zatvori, uvezi ISTI file ⇒ „Already in this state" + kad i tko,
 *      i nema gumba Apply — dokaz je stanje baze, ne oznaka u fileu.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const MOOD_MAP = ':-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5';
const FACES = { ':-(': '☹', ':-/': '🙁', ':-|': '😐', ':-)': '🙂', ':-D': '😀' };

test.describe('S186 — Restructure attributes: change type, korak po korak', () => {
  let areaId = '';
  let moodId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    moodId = randomUUID();
    const actId = randomUUID();
    const cardioId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S186 retype w${test.info().workerIndex}`,
      slug: `s186-retype-${areaId.slice(0, 6)}`, sort_order: 95,
      settings: { list_columns: { columns: [
        { role: 'date' }, { role: 'attr', label: 'Mood', slugs: ['mood'], map: FACES },
        { role: 'comment' }, { role: 'actions' },
      ] } },
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
      id: moodId, user_id: OWNER_ID, category_id: actId, name: 'mood', slug: 'mood', data_type: 'text',
      is_required: false, sort_order: 1, validation_rules: { type: 'suggest', suggest: [':-(', ':-/', ':-)', ':-D'] },
    });
    const days: Array<[string, string]> = [['2024-06-13', ':-)'], ['2024-06-14', ':-|'], ['2024-07-04', ':-D']];
    for (const [d, mood] of days) {
      const start = `${d}T10:00:00+00:00`;
      const leaf = randomUUID(), parent = randomUUID();
      await supabasePost(page, 'events', { id: leaf, user_id: OWNER_ID, category_id: cardioId,
        event_date: d, session_start: start, comment: `S186 retype ${d}` });
      await supabasePost(page, 'events', { id: parent, user_id: OWNER_ID, category_id: actId,
        event_date: d, session_start: start, chain_key: cardioId });
      await supabasePost(page, 'event_attributes', { event_id: parent, user_id: OWNER_ID,
        attribute_definition_id: moodId, value_text: mood });
    }
    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);   // restructure_ops: ON DELETE CASCADE
  });

  const areaSelect = (page: Page) => page.locator('select').filter({
    has: page.locator('option[value=""]', { hasText: 'All Areas' }),
  });

  const moodDb = async (page: Page) => {
    const def = (await supabaseGet(page, 'attribute_definitions', { id: moodId }, 'id,data_type'))[0] as { data_type: string };
    const vals = await supabaseGet(page, 'event_attributes', { attribute_definition_id: moodId }, 'value_text,value_number') as
      Array<{ value_text: string | null; value_number: number | null }>;
    const shown = vals.map(v => v.value_text ?? String(v.value_number)).sort();
    return { type: def.data_type, values: shown };
  };

  const importFile = async (page: Page, file: string) => {
    await page.getByRole('button', { name: /^import$/i }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /^import$/i }).last().click();
    await expect(page.getByTestId('attr-restructure-panel')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('attr-summary')).toBeVisible({ timeout: 60_000 });
  };

  test('pregled → Apply → Undo → Apply → isti file opet: Already in this state', async ({ page }) => {
    test.setTimeout(240_000);

    // 1. Structure export ⇒ prazan sheet ⇒ upiši korak
    await areaSelect(page).waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect(page).selectOption(areaId);
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /export/i }).click();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S186-')), 'structure.xlsx');
    await (await dl).saveAs(file);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Restructure attributes');
    expect(ws, 'export nema sheet Restructure attributes').toBeTruthy();
    const head: string[] = [];
    ws!.getRow(1).eachCell({ includeEmpty: true }, (c, n) => { head[n] = String(c.value ?? ''); });
    const col = (h: string) => { const i = head.indexOf(h); expect(i, `stupac ${h}`).toBeGreaterThan(0); return i; };
    const r = ws!.getRow(2);
    r.getCell(col('Step')).value = 1;
    r.getCell(col('Operation')).value = 'change type';
    r.getCell(col('Category')).value = 'Activity';
    r.getCell(col('Attribute')).value = 'mood';
    r.getCell(col('New type')).value = 'number';
    r.getCell(col('Conversion')).value = MOOD_MAP;
    r.commit();
    const edited = path.join(path.dirname(file), 'structure_retype.xlsx');
    await wb.xlsx.writeFile(edited);

    // 2. Pregled
    await importFile(page, edited);
    await expect(page.getByTestId('attr-step-status-1')).toContainText('Next · 3 rows', { timeout: 30_000 });
    await expect(page.getByTestId('attr-summary')).toContainText('Doing 1 change: step 1');
    await expect(page.getByTestId('attr-changes')).toContainText('mood: text → number');
    expect(await moodDb(page), 'pregled je nešto upisao').toEqual({ type: 'text', values: [':-)', ':-D', ':-|'] });
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('attr-restructure-panel'), 'klik sa strane zatvorio je modal').toBeVisible();
    await expect(page.getByTestId('attr-apply')).toBeDisabled();

    // 3. Apply
    await page.getByTestId('attr-ack').check();
    await page.getByTestId('attr-apply').click();
    await expect(page.getByTestId('attr-applied')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('attr-applied')).toContainText('exactly what the preview predicted');
    await expect(page.getByTestId('attr-step-status-1')).toContainText('Already in this state', { timeout: 30_000 });
    await expect(page.getByTestId('attr-step-status-1')).toContainText('by you');
    expect(await moodDb(page)).toEqual({ type: 'number', values: ['3', '4', '5'] });
    const settings = (await supabaseGet(page, 'areas', { id: areaId }, 'id,settings'))[0] as
      { settings: { list_columns: { columns: Array<{ map?: Record<string, string> }> } } };
    expect(settings.settings.list_columns.columns[1].map, 'mapa kolone na novim ključevima')
      .toEqual({ '1': '☹', '2': '🙁', '3': '😐', '4': '🙂', '5': '😀' });

    // 4. Undo
    await page.getByTestId('attr-undo').click();
    await expect(page.getByTestId('attr-undone')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('attr-undone')).toContainText('exactly what it was before');
    expect(await moodDb(page)).toEqual({ type: 'text', values: [':-)', ':-D', ':-|'] });
    await expect(page.getByTestId('attr-step-status-1')).toContainText('Next · 3 rows', { timeout: 30_000 });

    // 5. Apply opet, zatvori, isti file opet
    await page.getByTestId('attr-ack').check();
    await page.getByTestId('attr-apply').click();
    await expect(page.getByTestId('attr-applied')).toBeVisible({ timeout: 60_000 });
    // Više gumba nosi ime „Close" (✕ modala, ✕ Help panela — aria-label) — donji ima TEKST.
    await page.locator('button', { hasText: /^Close$/ }).click();
    await expect(page.getByTestId('attr-restructure-panel')).toHaveCount(0);

    await importFile(page, edited);
    await expect(page.getByTestId('attr-step-status-1')).toContainText('Already in this state', { timeout: 30_000 });
    await expect(page.getByTestId('attr-step-status-1')).toContainText(/applied \d\d\.\d\d\.\d{4} \d\d:\d\d:\d\d by you/);
    await expect(page.getByTestId('attr-summary')).toHaveText('All steps are already in this state — nothing to do.');
    await expect(page.getByTestId('attr-apply')).toHaveCount(0);
    expect(await moodDb(page), 'drugi uvoz je nešto promijenio').toEqual({ type: 'number', values: ['3', '4', '5'] });
  });
});
