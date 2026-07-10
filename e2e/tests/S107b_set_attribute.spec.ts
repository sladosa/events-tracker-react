/**
 * T-S107b-1 / T-S107b-2 — set_attribute automatika (Faza 2b, AUTOMATION_SPEC.md)
 *
 * Faza 2b added declarative `set_attribute` rules to area.settings.automations:
 * when the map attribute (e.g. Izvor) changes in Add Activity, the target
 * attribute (e.g. Datum naplate) is auto-filled from a date_map
 * ('same' = session date, 'next:N' = Nth day of next month). A manually edited
 * target is never overwritten. Rules roundtrip through the Structure Excel
 * export/import via the new "Automations" sheet.
 *
 * T-S107b-1: Add Activity live prefill — Mastercard → 11th next month,
 *            Racun → session date, manual edit survives an Izvor change.
 * T-S107b-2: Structure export contains the Automations sheet with the rule;
 *            editing DateMap in Excel and importing updates area.settings.
 *
 * Self-contained: creates its own area/category/attrs via REST, cleans up after.
 */

import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  loginAsOwner,
  supabasePost,
  supabaseGet,
  deleteAreaCascade,
} from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';

const RULE = {
  action: 'set_attribute',
  name: 'Datum naplate',
  target_slug: 'datum_naplate',
  map_slug: 'izvor',
  date_map: { Mastercard: 'next:11', Visa: 'next:3', Racun: 'same', Cash: 'same' },
};

// ── date helpers (mirror attributeRules.ts semantics) ──
const pad = (n: number) => String(n).padStart(2, '0');
const fmtNoon = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00`;

function nextMonthDay(base: Date, day: number): Date {
  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(day);
  return d;
}

// ── per-test structure ──
interface TestArea {
  areaId: string;
  catId: string;
  areaName: string;
}

async function createTestArea(page: Page, tag: string): Promise<TestArea> {
  const areaId = randomUUID();
  const catId = randomUUID();
  const areaName = `S107b ${tag}`;

  await supabasePost(page, 'areas', {
    id: areaId,
    user_id: OWNER_ID,
    name: areaName,
    slug: `s107b-${tag.toLowerCase()}-${areaId.slice(0, 6)}`,
    sort_order: 90,
    settings: { automations: { attribute_rules: [RULE] } },
  });

  await supabasePost(page, 'categories', {
    id: catId,
    user_id: OWNER_ID,
    area_id: areaId,
    parent_category_id: null,
    name: 'Trans',
    slug: `trans-${catId.slice(0, 6)}`,
    level: 1,
    sort_order: 1,
  });

  await supabasePost(page, 'attribute_definitions', {
    id: randomUUID(),
    user_id: OWNER_ID,
    category_id: catId,
    name: 'Izvor',
    slug: 'izvor',
    data_type: 'text',
    is_required: false,
    sort_order: 1,
    validation_rules: { type: 'suggest', suggest: ['Mastercard', 'Visa', 'Racun', 'Cash'], allow_other: true },
  });

  await supabasePost(page, 'attribute_definitions', {
    id: randomUUID(),
    user_id: OWNER_ID,
    category_id: catId,
    name: 'Datum naplate',
    slug: 'datum_naplate',
    data_type: 'datetime',
    is_required: false,
    sort_order: 2,
    validation_rules: {},
  });

  return { areaId, catId, areaName };
}

test.describe('T-S107b — set_attribute automatika (Faza 2b)', () => {
  let ta: TestArea;

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });

    ta = await createTestArea(page, `w${test.info().workerIndex}`);
    // Reload so the app refetches areas (structure was created after mount)
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    if (ta) await deleteAreaCascade(page, ta.areaId);
  });

  test('T-S107b-1: Add Activity — Datum naplate live prefill po Izvoru; ručni unos se ne gazi', async ({ page }) => {
    test.setTimeout(120_000);

    await selectFilterPath(page, ta.areaId, [ta.catId]);

    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    const izvorSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: 'Mastercard' }),
    });
    await expect(izvorSelect).toBeVisible({ timeout: 10_000 });
    const naplataInput = page.locator('input[type="datetime-local"]');
    await expect(naplataInput).toBeVisible();
    await expect(naplataInput).toHaveValue(''); // ništa dok Izvor nije odabran

    const now = new Date();

    // Mastercard → 11. sljedećeg mjeseca
    await izvorSelect.selectOption('Mastercard');
    await expect(naplataInput).toHaveValue(fmtNoon(nextMonthDay(now, 11)));

    // Racun → session date (isti dan)
    await izvorSelect.selectOption('Racun');
    await expect(naplataInput).toHaveValue(fmtNoon(now));

    // Ručni unos → promjena Izvora ga NE gazi
    const manual = '2030-01-15T09:30';
    await naplataInput.fill(manual);
    await izvorSelect.selectOption('Visa');
    // still the manual value (give the effect a beat to run — value must stay)
    await page.waitForTimeout(500);
    await expect(naplataInput).toHaveValue(manual);
  });

  test('T-S107b-2: Structure Excel roundtrip — Automations sheet export + import mijenja area.settings', async ({ page }) => {
    test.setTimeout(180_000);

    // ── Export ──
    await page.getByRole('button', { name: 'Structure' }).click();
    await expect(page.getByRole('button', { name: /edit mode/i })).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: /export/i }).click();
    const download = await downloadPromise;
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'S107b-'));
    const filePath = path.join(tmpDir, 'structure.xlsx');
    await download.saveAs(filePath);

    // ── Verify Automations sheet contains our rule ──
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('Automations');
    expect(ws, 'Automations sheet missing from structure export').toBeTruthy();

    let ruleRow = -1;
    ws!.eachRow((row, rowNumber) => {
      if (
        String(row.getCell(1).value ?? '') === ta.areaName &&
        String(row.getCell(4).value ?? '') === 'datum_naplate'
      ) ruleRow = rowNumber;
    });
    expect(ruleRow, `rule row for area "${ta.areaName}" not found`).toBeGreaterThan(1);
    expect(String(ws!.getRow(ruleRow).getCell(6).value)).toContain('Mastercard=next:11');

    // ── Edit DateMap in Excel: Mastercard 11 → 15, drop Visa ──
    ws!.getRow(ruleRow).getCell(6).value = 'Mastercard=next:15 | Racun=same | Cash=same';
    ws!.getRow(ruleRow).commit();
    const modifiedPath = path.join(tmpDir, 'structure_modified.xlsx');
    await wb.xlsx.writeFile(modifiedPath);

    // ── Import via Structure Import modal ──
    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByText('Import Structure')).toBeVisible({ timeout: 5_000 });
    await page.locator('input[type="file"]').setInputFiles(modifiedPath);
    await page.getByRole('button', { name: /^import$/i }).last().click();

    await expect(page.getByText(/import completed successfully/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Automation rules', { exact: true })).toBeVisible();

    // ── Verify DB: area.settings.automations.attribute_rules updated ──
    const areas = await supabaseGet(page, 'areas', { id: ta.areaId }, 'id,settings');
    expect(areas).toHaveLength(1);
    const settings = (areas[0] as { settings: { automations?: { attribute_rules?: Array<{ date_map: Record<string, string> }> } } }).settings;
    const rules = settings?.automations?.attribute_rules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0].date_map['Mastercard']).toBe('next:15');
    expect(rules[0].date_map['Visa']).toBeUndefined();
    expect(rules[0].date_map['Racun']).toBe('same');
  });
});
