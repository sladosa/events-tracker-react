/**
 * S194 T42 — „older records" u pregledu uvoza ne pali za pečat izvoda.
 *
 * Upozorenje „N older records (> 30 days) — accidental change?" palo je SVAKI
 * mjesec (studeni: Visa 7/37, MC 26/54): rata nosi dan kupnje, a izvod na njoj
 * mijenja samo žig, datum naplate i status. Upozorenje koje uvijek pali se otkliče.
 *
 * Area s pravilom kao Financije (`set_attribute`, žig `izvod_opis`), tri retka
 * starija od 30 dana: dva dobivaju SAMO žig, jedan mijenja Tip ⇒ upozorenje broji
 * 1, a sivi redak kaže da 2 mijenjaju samo pečat. Uvoz se ne primjenjuje.
 */
import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

const ATTRS: [string, string, string][] = [
  ['izvorplacanja', 'Izvor', 'text'],
  ['isplata', 'Isplata', 'number'],
  ['tip', 'Tip', 'text'],
  ['datum_naplate', 'Datum naplate', 'datetime'],
  ['izvod_opis', 'Izvod opis', 'text'],
];

test.describe('S194 — older records i pečat izvoda (T42)', () => {
  test.setTimeout(120_000);
  let areaId = '';
  let catId = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID();
    catId = randomUUID();
    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: `S194 pecat w${test.info().workerIndex}`,
      slug: `s194-pecat-${areaId.slice(0, 6)}`, sort_order: 97,
      settings: { automations: { attribute_rules: [{
        name: 'Datum naplate po Izvoru', action: 'set_attribute', map_slug: 'izvorplacanja',
        target_slug: 'datum_naplate', lock_slug: 'izvod_opis',
        date_map: { Racun: 'same', Mastercard: 'next:11' },
      }] } },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Transakcija', slug: `transakcija-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    const defId: Record<string, string> = {};
    let sort = 0;
    for (const [slug, name, data_type] of ATTRS) {
      defId[slug] = randomUUID();
      await supabasePost(page, 'attribute_definitions', {
        id: defId[slug], user_id: OWNER_ID, category_id: catId, name, slug, data_type,
        is_required: false, sort_order: ++sort, validation_rules: {},
      });
    }
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      const d = inDays(-60 - i);
      await supabasePost(page, 'events', {
        id, user_id: OWNER_ID, category_id: catId, event_date: d,
        session_start: `${d}T12:00:00+00:00`, comment: `S194 rata ${i}`,
      });
      await supabasePost(page, 'event_attributes', { event_id: id, user_id: OWNER_ID, attribute_definition_id: defId.izvorplacanja, value_text: 'Mastercard' });
      await supabasePost(page, 'event_attributes', { event_id: id, user_id: OWNER_ID, attribute_definition_id: defId.isplata, value_number: 10 + i });
      await supabasePost(page, 'event_attributes', { event_id: id, user_id: OWNER_ID, attribute_definition_id: defId.tip, value_text: 'Razno' });
    }
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  test('dva retka samo žig + jedan Tip ⇒ upozorenje broji 1, pečat 2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await selectFilterPath(page, areaId, [catId]);

    await page.getByRole('button', { name: /📥 export|^export$/i }).first().click();
    await expect(page.getByRole('heading', { name: /export to excel/i })).toBeVisible({ timeout: 5_000 });
    const dl = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /download excel/i }).first().click();
    const exported = await (await dl).path();
    await page.getByRole('button', { name: '×' }).click();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(exported!);
    const ws = wb.getWorksheet('Events')!;
    let header = -1;
    ws.eachRow({ includeEmpty: false }, (r, n) => {
      if (header === -1 && String(r.getCell(1).value ?? '').trim().toLowerCase() === 'event_id') header = n;
    });
    const col = (name: string) => {
      let c = -1;
      ws.getRow(header).eachCell((cell, n) => { if (String(cell.value ?? '').startsWith(name)) c = n; });
      expect(c, `stupac ${name}`).toBeGreaterThan(0);
      return c;
    };
    const cZig = col('Izvod opis'), cTip = col('Tip'), cKom = 8;
    let n = 0;
    for (let r = header + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const kom = String(row.getCell(cKom).value ?? '');
      if (kom === 'S194 rata 0' || kom === 'S194 rata 1') { row.getCell(cZig).value = `KUPOVINA ${kom}`; n++; }
      if (kom === 'S194 rata 2') { row.getCell(cTip).value = 'Hrana'; n++; }
      row.commit();
    }
    expect(n).toBe(3);
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S194-')), 'S194_pecat.xlsx');
    await wb.xlsx.writeFile(file);

    await page.getByRole('button', { name: /📤 import/i }).click();
    await expect(page.getByRole('heading', { name: /import from excel/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText(/3 existing events will be modified/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/1 of them is an older record/)).toBeVisible();
    await expect(page.getByTestId('old-stamp-only')).toContainText('2 older records change only');
  });
});
