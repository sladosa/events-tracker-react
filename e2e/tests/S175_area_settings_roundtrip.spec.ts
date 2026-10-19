/**
 * S175 / F5 — `areas.settings` kroz Structure roundtrip (sheet `AreaSettings`).
 *
 * Do S175 su `dashboard`, `groupings` i `export_profiles` živjeli SAMO u bazi.
 * Ovdje vlastita Area nosi sve tri + `list_columns` (koji pripada DRUGOM sheetu)
 * i mjeri se:
 *   1. bez odabrane Aree Export ne izlazi (jedna Area po fileu, S175);
 *   2. export nosi retke `Path | Type | Value`, ime Aree u profilu kao `{Area}`;
 *   3. uvoz nepromijenjenog filea ne mijenja NIŠTA (inače bi svaki uvoz prepisivao config);
 *   4. izmjena jedne ćelije + brisanje redaka `groupings` ⇒ točno to u bazi, a
 *      `list_columns` (drugi sheet) netaknut. Brisanje je korak koji vrijedi:
 *      uvoz koji bi tiho zadržao stari ključ izgledao bi isto kao ispravan.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

type Settings = Record<string, unknown>;

test.describe('S175 — AreaSettings kroz Structure roundtrip (F5)', () => {
  let areaId = '';
  let areaName = '';
  let initial: Settings = {};

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const catId = randomUUID();
    areaName = `S175 set w${test.info().workerIndex}`;
    initial = {
      list_columns: { columns: [{ role: 'date' }, { role: 'attr', slugs: ['racun'] }, { role: 'actions' }] },
      dashboard: {
        widgets: [{
          type: 'balance_by_group', title: 'Stanje S175', group_by: 'racun',
          plus: 'uplata', minus: 'isplata', filters: [{ slug: 'izvor', op: 'in', values: ['Racun'] }],
          stale_days: 30, show_split: true,
        }],
      },
      groupings: { 'Vrsta troška': { rows: [{ bucket: 'Mjesečni', values: ['Hrana', 'ostalo'] }] } },
      export_profiles: {
        Moj_format: {
          columns: [
            { key: 'event_date', width: 16, hidden: false },
            { key: `attr:${areaName}||Trans||Račun`, width: 13, hidden: true },
          ],
          createdAt: '2026-10-19', filterState: { periodKey: 'this-year', sortOrder: 'desc' },
        },
      },
    };

    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: areaName,
      slug: `s175-set-${areaId.slice(0, 6)}`, sort_order: 92, settings: initial,
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Trans', slug: `trans-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    // ListColumns uvoz preskače kolonu čiji slug Area nema — bez atributa bi
    // `list_columns` „preživio" jer ga je uvoz preskočio, ne jer ga AreaSettings ne dira.
    await supabasePost(page, 'attribute_definitions', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId, name: 'Račun',
      slug: 'racun', data_type: 'text', is_required: false, sort_order: 1, validation_rules: {},
    });
    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const readSettings = async (page: Page): Promise<Settings> => {
    const rows = await supabaseGet(page, 'areas', { id: areaId }, 'id,settings');
    return (rows[0] as { settings: Settings }).settings;
  };

  const areaSelect = (page: Page) => page.locator('select').filter({
    has: page.locator('option[value=""]', { hasText: 'All Areas' }),
  });

  const exportStructure = async (page: Page, name: string): Promise<string> => {
    await areaSelect(page).waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect(page).selectOption(areaId);
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /export/i }).click();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S175-')), name);
    await (await dl).saveAs(file);
    return file;
  };

  const importStructure = async (page: Page, file: string) => {
    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByText('Import Structure')).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /^import$/i }).last().click();
    await expect(page.getByText(/import completed successfully|nothing to import/i)).toBeVisible({ timeout: 60_000 });
  };

  const settingsRow = (page: Page) =>
    page.locator('div', { hasText: /^Area settings changed \(areas\)/ }).last();

  test('export nosi postavke, nepromijenjen uvoz ne mijenja ništa, izmjena i brisanje stignu točno', async ({ page }) => {
    test.setTimeout(180_000);

    // 1. Bez odabrane Aree export ne izlazi — kaže zašto.
    await areaSelect(page).waitFor({ state: 'visible', timeout: 15_000 });
    await areaSelect(page).selectOption('');
    await page.getByRole('button', { name: 'Structure' }).click();
    let downloaded = false;
    page.once('download', () => { downloaded = true; });
    // `aria-disabled` (kao `+`, S154): Playwright ga vidi kao ugašen pa ne klikne
    // sam — `force` glumi dodir, a baš to se mjeri (dodir mora reći zašto).
    await expect(page.getByRole('button', { name: /export/i })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: /export/i }).click({ force: true });
    await expect(page.getByText(/Select an Area in the filter/)).toBeVisible({ timeout: 5_000 });
    expect(downloaded, 'export bez Aree je izašao').toBe(false);
    await page.getByRole('button', { name: 'Activities' }).click();

    // 2. Export nosi AreaSettings
    const file = await exportStructure(page, 'structure.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('AreaSettings');
    expect(ws, 'AreaSettings sheet nedostaje').toBeTruthy();
    const rows: { n: number; area: string; path: string; type: string; value: unknown }[] = [];
    ws!.eachRow((r, n) => {
      if (n === 1) return;
      const p = String(r.getCell(2).value ?? '');
      if (!p) return;
      rows.push({ n, area: String(r.getCell(1).value ?? ''), path: p, type: String(r.getCell(3).value ?? ''), value: r.getCell(4).value });
    });
    const byPath = new Map(rows.map(r => [r.path, r]));
    expect(rows.every(r => r.area === areaName), 'file nosi samo odabranu Areu').toBe(true);
    expect(byPath.get('dashboard.widgets[0].title')?.value).toBe('Stanje S175');
    expect(byPath.get('dashboard.widgets[0].stale_days')).toMatchObject({ type: 'number', value: 30 });
    expect(byPath.get('dashboard.widgets[0].show_split')).toMatchObject({ type: 'bool', value: true });
    expect(byPath.get('export_profiles.Moj_format.columns[1].key')?.value).toBe('attr:{Area}||Trans||Račun');
    expect(rows.some(r => r.path.startsWith('list_columns')), 'list_columns pripada ListColumns sheetu').toBe(false);

    // 3. Nepromijenjen uvoz ⇒ 0 promjena, baza ista
    await importStructure(page, file);
    await expect(settingsRow(page)).toContainText('0');
    expect(await readSettings(page)).toEqual(initial);
    await page.getByRole('button', { name: /close|done/i }).first().click().catch(() => {});

    // 4. Izmjena jedne ćelije + brisanje svih redaka `groupings`
    ws!.getRow(byPath.get('dashboard.widgets[0].title')!.n).getCell(4).value = 'Novo ime';
    for (const r of rows.filter(x => x.path.startsWith('groupings'))) {
      ws!.getRow(r.n).getCell(2).value = null;
      ws!.getRow(r.n).commit();
    }
    const edited = path.join(path.dirname(file), 'structure_edited.xlsx');
    await wb.xlsx.writeFile(edited);
    await page.goto('/app');
    await importStructure(page, edited);
    await expect(settingsRow(page)).toContainText('1');
    await expect(page.getByTestId('area-settings-changed')).toContainText(`${areaName}: dashboard, groupings`);

    const after = await readSettings(page);
    expect((after.dashboard as { widgets: { title: string }[] }).widgets[0].title).toBe('Novo ime');
    expect(after.groupings, 'obrisani retci groupings su ostali u bazi').toBeUndefined();
    expect(after.list_columns, 'AreaSettings je dirnuo list_columns').toEqual(initial.list_columns);
    expect(after.export_profiles, 'profil se vratio s imenom Aree').toEqual(initial.export_profiles);
  });
});
