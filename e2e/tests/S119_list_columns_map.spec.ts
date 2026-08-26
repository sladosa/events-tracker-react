/**
 * T-S119-6 — the account-abbreviation dictionary survives the Structure roundtrip.
 *
 * The narrow list shortens `Kokin tekući ZABA` to `ZABA` through a per-value
 * dictionary that lives in `areas.settings.list_columns.columns[].map` — config,
 * not code. "Sve ide importom" only holds if that dictionary makes the round
 * trip, and the manual test for it runs on `Financije_all`, which the E2E
 * account does not own. The mechanism is the same on any Area, so this builds
 * its own and checks both directions:
 *
 *   export carries `Map` → import keeps it → clearing the cell REMOVES it.
 *
 * The last step is the one worth having. `ListColumns` deletes what the sheet
 * does not carry (unlike `Automations`, where absence is deliberately harmless),
 * so an import that quietly kept the old dictionary would look identical to one
 * that worked — until someone tried to remove an abbreviation and could not.
 */
import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loginAsOwner, supabasePost, supabaseGet, deleteAreaCascade } from '../fixtures/auth';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const DICT = { 'Kokin tekući ZABA': 'ZABA', 'Sašin tekući RF': 'RF' };

/** Parse a `Map` cell into pairs. ⚠ Never assert on the serialized string:
 *  the dictionary is stored in a jsonb column, which does NOT preserve key
 *  order, so the cell can come back as `Sašin… | Kokin…`. Content is stable,
 *  order is not. */
function parseMapCell(cell: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cell.split('|')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

interface ListColumn { role: string; slugs?: string[]; map?: Record<string, string> }

test.describe('T-S119-6 — ListColumns Map through the Structure roundtrip', () => {
  let areaId = '';
  let areaName = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    areaId = randomUUID();
    const catId = randomUUID();
    areaName = `S119 map w${test.info().workerIndex}`;

    await supabasePost(page, 'areas', {
      id: areaId, user_id: OWNER_ID, name: areaName,
      slug: `s119-map-${areaId.slice(0, 6)}`, sort_order: 91,
      settings: {
        list_columns: {
          columns: [
            { role: 'date' },
            { role: 'attr', label: 'Račun', slugs: ['racun'], mobile: 'line1',
              map: DICT },
            { role: 'actions' },
          ],
        },
      },
    });
    await supabasePost(page, 'categories', {
      id: catId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Trans', slug: `trans-${catId.slice(0, 6)}`, level: 1, sort_order: 1,
    });
    // The column points at this slug; import skips a column whose slug it cannot
    // find in the Area, so without it the test would pass for the wrong reason.
    await supabasePost(page, 'attribute_definitions', {
      id: randomUUID(), user_id: OWNER_ID, category_id: catId, name: 'Račun',
      slug: 'racun', data_type: 'text', is_required: false, sort_order: 1,
      validation_rules: {},
    });

    await page.goto('/app');
  });

  test.afterEach(async ({ page }) => {
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const readMap = async (page: Page): Promise<Record<string, string> | undefined> => {
    const rows = await supabaseGet(page, 'areas', { id: areaId }, 'id,settings');
    const s = (rows[0] as { settings?: { list_columns?: { columns: ListColumn[] } } }).settings;
    return s?.list_columns?.columns.find(c => c.role === 'attr')?.map;
  };

  const exportStructure = async (page: Page, name: string): Promise<string> => {
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });
    const dl = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /export/i }).click();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'S119-')), name);
    await (await dl).saveAs(file);
    return file;
  };

  const importStructure = async (page: Page, file: string) => {
    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByText('Import Structure')).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /^import$/i }).last().click();
    await expect(page.getByText(/import completed successfully/i)).toBeVisible({ timeout: 60_000 });
  };

  /** Locate our Area's `attr` row in the ListColumns sheet, and the Map column. */
  const findRow = (ws: ExcelJS.Worksheet) => {
    const header: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, c) => {
      header[c] = String(cell.value ?? '').trim().toLowerCase();
    });
    const mapCol = header.findIndex(h => h === 'map');
    let row = -1;
    ws.eachRow((r, n) => {
      if (String(r.getCell(1).value ?? '') === areaName &&
          String(r.getCell(2).value ?? '').toLowerCase() === 'attr') row = n;
    });
    return { mapCol, row };
  };

  test('T-S119-6: export carries Map, import keeps it, clearing the cell removes it', async ({ page }) => {
    test.setTimeout(150_000);

    // 1–2. Export carries the dictionary
    const file = await exportStructure(page, 'structure.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.getWorksheet('ListColumns');
    expect(ws, 'ListColumns sheet missing from structure export').toBeTruthy();

    const { mapCol, row } = findRow(ws!);
    expect(mapCol, 'Map column missing from ListColumns sheet').toBeGreaterThan(0);
    expect(row, `no attr row for area "${areaName}"`).toBeGreaterThan(1);
    expect(parseMapCell(String(ws!.getRow(row).getCell(mapCol).value ?? ''))).toEqual(DICT);

    // 3–4. Re-import unchanged: the dictionary is still there
    await importStructure(page, file);
    expect(await readMap(page)).toEqual(DICT);

    // 5–6. Clear the cell and import: the dictionary must be GONE, not kept
    ws!.getRow(row).getCell(mapCol).value = null;
    ws!.getRow(row).commit();
    const cleared = path.join(path.dirname(file), 'structure_no_map.xlsx');
    await wb.xlsx.writeFile(cleared);

    await page.goto('/app');
    await importStructure(page, cleared);
    expect(await readMap(page), 'import kept a dictionary the sheet no longer carries').toBeUndefined();
  });
});
