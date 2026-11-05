/**
 * S193 — T43 (brzina Excel uvoza ispravaka) i T50 (uvoz ne dira razdoblje).
 *
 * T43: Kokin uvoz 42 ispravka trajao je 2–3 min (PROD, 05.11.). Izmjereno F12:
 *   po retku `events` select + update, pa PATCH ZA SVAKI ATRIBUT RETKA — i za
 *   one koji se nisu promijenili. Ovdje Area oblika Financija (15 atributa,
 *   42 retka), u fileu se mijenja SAMO Namjena, i broje se pozivi uvoza.
 *   Tvrdnja: najviše 4 poziva po retku (select, update, 1 atribut, rezerva) —
 *   stari kod šalje ~16 po retku.
 *
 * T50: `AppHome` je nakon svakog uspješnog uvoza brisao datume filtra, a oznaka
 *   je ostajala „This Year" ⇒ razrez je tiho računao cijelu povijest.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const N_ROWS = 42;
const year = new Date().getFullYear();

// 15 atributa kao `Financije_all > Transakcija` (slug, ime, tip, vrijednost)
const ATTRS: [string, string, string, (i: number) => unknown][] = [
  ['racun', 'Racun', 'text', () => 'Kokin tekući ZABA'],
  ['izvorplacanja', 'Izvor', 'text', () => 'Racun'],
  ['smjer', 'Smjer', 'text', () => 'Isplata'],
  ['isplata', 'Isplata', 'number', i => 10 + i],
  ['uplata', 'Uplata', 'number', () => null],
  ['tip', 'Tip', 'text', () => 'Razno'],
  ['podtip', 'Podtip', 'text', () => 'ostalo'],
  ['namjena', 'Namjena', 'text', () => 'Koka'],
  ['rate', 'Rate?', 'boolean', () => false],
  ['brojrata', 'Broj rata', 'number', () => 1],
  ['rata_br', 'Rata br', 'number', () => 1],
  ['status', 'Status', 'text', () => 'Izvrsen'],
  ['datum_naplate', 'Datum naplate', 'datetime', i => `${dayOf(i)}T12:00:00+00:00`],
  ['izvod_opis', 'Izvod opis', 'text', i => `KUPOVINA ${i} ZAGREB`],
  ['mjeraracun', 'MjeraRacun', 'text', () => 'ZABA'],
];
const COL: Record<string, string> = { text: 'value_text', number: 'value_number', boolean: 'value_boolean', datetime: 'value_datetime' };
function dayOf(i: number): string {
  const d = new Date(Date.UTC(year, 0, 10 + i));
  return d.toISOString().slice(0, 10);
}

test.describe('S193 — T43 brzina uvoza ispravaka, T50 razdoblje nakon uvoza', () => {
  test.setTimeout(400_000);
  let areaId = '';
  let catId = '';
  const defId: Record<string, string> = {};

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    catId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S193 uvoz w${test.info().workerIndex}`,
      slug: `s193-uvoz-${areaId.slice(0, 6)}`, sort_order: 96,
      settings: { default_period: 'this-year' },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    let sort = 0;
    for (const [slug, name, data_type] of ATTRS) {
      defId[slug] = randomUUID();
      await supabasePost(page, 'attribute_definitions', {
        id: defId[slug], user_id: OWNER_ID, category_id: catId, name, slug, data_type,
        is_required: false, sort_order: ++sort, validation_rules: {},
      });
    }
    // Retci i atributi u dva skupna upisa (PostgREST prima niz).
    const events = Array.from({ length: N_ROWS }, (_, i) => ({
      id: randomUUID(), user_id: OWNER_ID, category_id: catId, event_date: dayOf(i),
      session_start: `${dayOf(i)}T12:00:00+00:00`, comment: `S193 redak ${i}`,
    }));
    await supabasePost(page, 'events', events as unknown as Record<string, unknown>, 'return=minimal');
    const attrs = events.flatMap((e, i) => ATTRS
      .map(([slug, , type, v]) => ({ slug, type, v: v(i) }))
      .filter(a => a.v !== null)
      .map(a => ({ event_id: e.id, user_id: OWNER_ID, attribute_definition_id: defId[a.slug], [COL[a.type]]: a.v })));
    // PostgREST traži iste ključeve u svim objektima niza ⇒ po stupcu vrijednosti.
    for (const col of Object.values(COL)) {
      const part = attrs.filter(a => col in a);
      if (part.length) await supabasePost(page, 'event_attributes', part as unknown as Record<string, unknown>, 'return=minimal');
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const periodSelect = (page: Page) => page.locator('select').filter({ has: page.locator('option', { hasText: 'This Year' }) }).first();

  test('42 ispravka Namjene: malo poziva, trajanje na završnom ekranu; razdoblje ostaje This Year', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await selectFilterPath(page, areaId, [catId]);
    // Zadano razdoblje Aree (S166) — preduvjet T50
    await expect(periodSelect(page)).toHaveValue('this-year', { timeout: 15_000 });
    const fromInput = page.locator('input[type="date"]').first();
    await expect(fromInput).toHaveValue(`${year}-01-01`);

    // ── Export ──
    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
    const dl = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();
    const exported = await (await dl).path();
    await page.getByRole('button', { name: '×' }).click();

    // ── Namjena Koka → Zajedničko u svih 42 retka ──
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(exported!);
    const ws = wb.getWorksheet('Events')!;
    let header = -1;
    ws.eachRow({ includeEmpty: false }, (r, n) => {
      if (header === -1 && String(r.getCell(1).value ?? '').trim().toLowerCase() === 'event_id') header = n;
    });
    expect(header).toBeGreaterThan(0);
    let namCol = -1;
    ws.getRow(header).eachCell((c, n) => { if (String(c.value ?? '').includes('Namjena')) namCol = n; });
    expect(namCol, 'stupac Namjena').toBeGreaterThan(0);
    let changed = 0;
    for (let n = header + 1; n <= ws.rowCount; n++) {
      const r = ws.getRow(n);
      if (String(r.getCell(namCol).value ?? '') === 'Koka') { r.getCell(namCol).value = 'Zajedničko'; r.commit(); changed++; }
    }
    expect(changed).toBe(N_ROWS);
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S193-')), 'S193_ispravci.xlsx');
    await wb.xlsx.writeFile(file);

    // ── Import, brojanje poziva samo tijekom Apply ──
    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(file);
    const applyBtn = page.getByRole('button', { name: /apply import/i });
    await expect(applyBtn).toBeVisible({ timeout: 60_000 });
    // Update-guard (D7): „pregledao sam popis" — Area nema pločicu, pa druge kvačice nema.
    await page.getByText(/I reviewed the list/).click();

    const calls: string[] = [];
    const onReq = (r: { url(): string; method(): string }) => {
      const u = r.url();
      if (u.includes('/rest/v1/')) calls.push(`${r.method()} ${u.split('/rest/v1/')[1].split('?')[0]}`);
    };
    page.on('request', onReq);
    const t0 = Date.now();
    await applyBtn.click();
    await expect(page.getByText(/import successful/i)).toBeVisible({ timeout: 300_000 });
    const ms = Date.now() - t0;
    page.off('request', onReq);

    const byKind = calls.reduce<Record<string, number>>((m, c) => { m[c] = (m[c] ?? 0) + 1; return m; }, {});
    console.log(`[T43] ${N_ROWS} ispravaka: ${(ms / 1000).toFixed(1)} s, ${calls.length} poziva`, JSON.stringify(byKind));
    test.info().annotations.push({ type: 'T43', description: `${(ms / 1000).toFixed(1)} s, ${calls.length} poziva ${JSON.stringify(byKind)}` });

    const updated = page.getByText('Events updated', { exact: true }).locator('xpath=preceding-sibling::p[1]');
    await expect(updated).toHaveText(String(N_ROWS));
    // Trajanje na završnom ekranu (Sašina želja, T43)
    await expect(page.getByTestId('import-duration')).toBeVisible();
    // Stari kod: ~16 poziva po retku (PATCH za svaki atribut). Novi: select + update + 1 atribut.
    expect(calls.length, `poziva ${calls.length} za ${N_ROWS} redaka`).toBeLessThanOrEqual(N_ROWS * 4);

    // U bazi: svih 42 ima Zajedničko, ostali atributi netaknuti (isplata prvog retka)
    const nam = await supabaseGet(page, 'event_attributes', { attribute_definition_id: defId.namjena }, 'value_text') as { value_text: string }[];
    expect(nam.filter(r => r.value_text === 'Zajedničko')).toHaveLength(N_ROWS);
    const ispl = await supabaseGet(page, 'event_attributes', { attribute_definition_id: defId.isplata }, 'value_number') as { value_number: number }[];
    expect(ispl).toHaveLength(N_ROWS);

    // ── T50: zatvori modal ⇒ razdoblje i dalje This Year, datumi nisu prazni ──
    await page.getByRole('button', { name: /^(close|done|zatvori)$/i }).first().click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toHaveCount(0, { timeout: 10_000 });
    await expect(periodSelect(page)).toHaveValue('this-year');
    await expect(fromInput, 'T50: uvoz je obrisao datume filtra').toHaveValue(`${year}-01-01`);
  });
});
