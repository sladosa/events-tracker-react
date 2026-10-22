/**
 * S179 / F1 — sheet `Preuređivanje` kroz Structure uvoz: pregled → Primijeni → lista → Poništi.
 *
 * Vlastita Area: `tip` (Stari S179 · Drugo), dva eventa sa `Stari S179`, jedan s `Drugo`,
 * i kolona liste po `tip` — pa se preimenovanje vidi u Activities listi, ne samo u bazi.
 * Mjeri se:
 *   1. pregled broji TOČNO dva retka i kaže da se izbornik mijenja (Drugo ostaje);
 *   2. bez kvačice nema primjene;
 *   3. Primijeni ⇒ ponovno mjerenje „baza = predviđanje" ⇒ lista (druga kartica) pokazuje
 *      `Novi S179`, izbornik u bazi `[Novi S179, Drugo]` NA ISTOM MJESTU;
 *   4. Poništi ⇒ „baza = kako je bilo" ⇒ lista opet `Stari S179`, izbornik vraćen.
 * Poništi postoji samo u otvorenom modalu (F1b donosi popis operacija) — zato se lista
 * gleda u drugoj kartici istog konteksta, dok modal stoji otvoren.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const OLD = 'Stari S179';
const NEW = 'Novi S179';

const isoDay = (d: number) => {
  const x = new Date(); x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

test.describe('S179 — Preuređivanje: Primijeni i Poništi kroz Structure uvoz', () => {
  let areaId = '';
  let tipId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const catId = randomUUID();
    tipId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S179 preur w${test.info().workerIndex}`,
      slug: `s179-preur-${areaId.slice(0, 6)}`, sort_order: 93,
      settings: { list_columns: { columns: [{ role: 'date' }, { role: 'attr', label: 'Tip', slugs: ['tip'] }, { role: 'actions' }] } },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Trans', slug: `trans-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    await supabasePost(page, 'attribute_definitions', {
      id: tipId, user_id: OWNER_ID, category_id: catId, name: 'Tip', slug: 'tip', data_type: 'text',
      is_required: false, sort_order: 1, validation_rules: { type: 'suggest', suggest: [OLD, 'Drugo'] },
    });
    for (const [i, val] of [[1, OLD], [2, OLD], [3, 'Drugo']] as const) {
      const ev = randomUUID();
      await supabasePost(page, 'events', {
        id: ev, user_id: OWNER_ID, category_id: catId, event_date: isoDay(-i),
        session_start: `${isoDay(-i)}T10:0${i}:00Z`, comment: `S179 redak ${i}`,
      });
      await supabasePost(page, 'event_attributes', {
        event_id: ev, user_id: OWNER_ID, attribute_definition_id: tipId, value_text: val,
      });
    }
    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);   // restructure_ops: ON DELETE CASCADE
  });

  const areaSelect = (page: Page) => page.locator('select').filter({
    has: page.locator('option[value=""]', { hasText: 'All Areas' }),
  });

  const tipRules = async (page: Page) =>
    ((await supabaseGet(page, 'attribute_definitions', { id: tipId }, 'id,validation_rules'))[0] as
      { validation_rules: { suggest: string[] } }).validation_rules.suggest;

  /** Activities lista u DRUGOJ kartici — modal u prvoj ostaje otvoren (tamo je Poništi). */
  const listShows = async (page: Page, want: string, notWant: string) => {
    const tab = await page.context().newPage();
    await tab.goto('/app');
    await areaSelect(tab).waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect(tab).selectOption(areaId);
    // Prva kartica je na Structure tabu, a `ui:activeTab` se dijeli kroz localStorage.
    await tab.getByRole('button', { name: 'Activities' }).click();
    // Lista nosi samo datum + Tip (config Aree) — opisa nema; `Drugo` je redak 3, koji se ne mijenja.
    // ⚠ Redak se crta dvaput (desktop + uski, jedan skriven — S125) ⇒ broje se samo vidljivi.
    const shown = (t: string) => tab.getByText(t, { exact: true }).locator('visible=true');
    await expect(shown('Drugo')).toHaveCount(1, { timeout: 20_000 });
    await expect(shown(want)).toHaveCount(2, { timeout: 15_000 });
    await expect(shown(notWant)).toHaveCount(0);
    await tab.close();
  };

  test('pregled broji 2, Primijeni ⇒ lista Novi, Poništi ⇒ lista Stari', async ({ page }) => {
    test.setTimeout(180_000);

    await listShows(page, OLD, NEW);

    // Structure export ⇒ prazan sheet `Preuređivanje` sa zaglavljem po slugu ⇒ jedan korak
    await areaSelect(page).selectOption(areaId);
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /export/i }).click();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S179-')), 'structure.xlsx');
    await (await dl).saveAs(file);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('Preuređivanje');
    expect(ws, 'export nema sheet Preuređivanje').toBeTruthy();
    const head: string[] = [];
    ws!.getRow(1).eachCell({ includeEmpty: true }, (c, n) => { head[n] = String(c.value ?? ''); });
    const col = (h: string) => { const i = head.indexOf(h); expect(i, `stupac ${h}`).toBeGreaterThan(0); return i; };
    const r = ws!.getRow(2);
    r.getCell(col('Korak')).value = 1;
    r.getCell(col('Kategorija')).value = 'Trans';
    r.getCell(col('kad: tip')).value = OLD;
    r.getCell(col('postavi: tip')).value = NEW;
    r.commit();
    const edited = path.join(path.dirname(file), 'structure_preur.xlsx');
    await wb.xlsx.writeFile(edited);

    // Uvoz ⇒ pregled
    await page.getByRole('button', { name: /^import$/i }).click();
    await page.locator('input[type="file"]').setInputFiles(edited);
    await page.getByRole('button', { name: /^import$/i }).last().click();
    const panel = page.getByTestId('restructure-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    // Panel se rađa ispod rezultata uvoza — prozor se mora sam pomaknuti na njega,
    // inače „Structure unchanged" izgleda kao kraj i Close ostavi korake neprimijenjene.
    await expect(page.getByText('Restructure — preview')).toBeInViewport({ timeout: 5_000 });
    await expect(page.getByText(/measured in/)).toBeVisible({ timeout: 60_000 });
    const step = page.getByTestId('restructure-step-1');
    await expect(step.locator('td').nth(2)).toHaveText('2');
    await expect(step.locator('td').nth(3)).toHaveText('2');
    await expect(page.getByTestId('restructure-changes')).toContainText(`„${OLD}" → „${NEW}"`);
    await expect(page.getByTestId('restructure-errors')).toHaveCount(0);
    expect(await tipRules(page), 'pregled je nešto upisao').toEqual([OLD, 'Drugo']);

    // Klik na pozadinu (kut ekrana) ne smije zatvoriti modal dok postoji pregled
    await page.mouse.click(5, 5);
    await expect(panel, 'klik sa strane zatvorio je modal s preuređivanjem').toBeVisible();

    // Bez kvačice nema primjene
    await expect(page.getByTestId('restructure-apply')).toBeDisabled();
    await page.getByTestId('restructure-ack').check();
    await page.getByTestId('restructure-apply').click();
    await expect(page.getByTestId('restructure-applied')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('restructure-check')).toContainText('exactly what the preview predicted');

    // Najvažniji trenutak: poslije Apply bi slučajan klik odnio gumb Undo
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('restructure-undo'), 'klik sa strane odnio je Undo').toBeVisible();
    expect(await tipRules(page), 'izbornik: novi naziv na mjestu starog').toEqual([NEW, 'Drugo']);
    await listShows(page, NEW, OLD);

    // Poništi
    await page.getByTestId('restructure-undo').click();
    await expect(page.getByTestId('restructure-undone')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('restructure-check')).toContainText('exactly what it was before');
    expect(await tipRules(page), 'izbornik vraćen').toEqual([OLD, 'Drugo']);
    await listShows(page, OLD, NEW);
  });
});
