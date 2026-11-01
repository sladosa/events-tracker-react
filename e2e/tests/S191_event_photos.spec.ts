/**
 * S191 — slike eventa kroz zajednički `eventPhotos.ts` (Add, Edit; kartica kataloga je u S190_catalog_picker).
 *
 * ZAŠTO: upload je bio prepisan na tri mjesta i sva tri su grešku gutala; S191 ih je spojio u jednu
 *   funkciju. Prije S191 nijedan E2E nije uploadao sliku — prelazak bi inače ostao neprovjeren.
 *
 * ŠTO SE MJERI (baza, ne ekran):
 *   Add — slika uz unos ⇒ Finish ⇒ jedan zapis slike na novom eventu, ime datoteke očuvano.
 *   Edit — ✕ na postojećoj + nova slika ⇒ Save ⇒ ostaje samo nova (brisanje i dodavanje u istom spremanju).
 */
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsOwner, supabasePost, supabaseGet, supabaseDelete, deleteAreaCascade } from '../fixtures/auth';
import { selectFilterPath } from '../fixtures/filter';

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe('S191 — slike eventa (Add, Edit)', () => {
  let areaId = '', leafId = '', opisDef = '';

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 15_000 });
    areaId = randomUUID(); leafId = randomUUID(); opisDef = randomUUID();
    await supabasePost(page, 'areas', { id: areaId, user_id: OWNER_ID, name: `S191 slike w${test.info().workerIndex}`,
      slug: `s191-slike-${areaId.slice(0, 6)}`, sort_order: 97 });
    await supabasePost(page, 'categories', { id: leafId, user_id: OWNER_ID, area_id: areaId, parent_category_id: null,
      name: 'Zapis', slug: `zapis-${leafId.slice(0, 6)}`, level: 1, sort_order: 1 });
    await supabasePost(page, 'attribute_definitions', { id: opisDef, user_id: OWNER_ID, category_id: leafId, name: 'Opis',
      slug: 'opis', data_type: 'text', is_required: false, sort_order: 1, validation_rules: {} });
  });

  test.afterEach(async ({ page }) => {
    const evs = await supabaseGet(page, 'events', { category_id: leafId }) as { id: string }[];
    for (const e of evs) await supabaseDelete(page, 'event_attachments', { event_id: e.id });
    if (areaId) await deleteAreaCascade(page, areaId);
  });

  const attachments = async (page: Page, eventId: string) =>
    await supabaseGet(page, 'event_attachments', { event_id: eventId }) as { filename: string }[];

  test('Add sprema sliku; Edit briše staru i dodaje novu', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/app');
    await selectFilterPath(page, areaId, [leafId]);
    const addBtn = page.getByRole('button', { name: /add activity/i });
    await expect(addBtn).not.toBeDisabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page).toHaveURL(/\/app\/add/, { timeout: 10_000 });

    const opis = page.locator('div.space-y-1', { has: page.locator('label', { hasText: /^Opis/ }) }).locator('input, textarea').first();
    await opis.fill('sa slikom');
    await page.locator('input[type="file"][accept="image/*"]').first()
      .setInputFiles({ name: 'prva.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('NEW')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /finish/i }).click();

    let ev: { id: string; session_start: string } | undefined;
    await expect.poll(async () => {
      ev = (await supabaseGet(page, 'events', { category_id: leafId }) as { id: string; session_start: string }[])[0];
      return ev ? (await attachments(page, ev.id)).map(a => a.filename) : [];
    }, { timeout: 30_000 }).toEqual(['prva.png']);

    // Edit: ✕ na prvoj (potvrda ✓) + nova ⇒ Save ⇒ samo druga
    await page.goto(`/app/edit/${encodeURIComponent(ev!.session_start)}?categoryId=${leafId}`);
    const remove = page.getByTitle('Remove photo');
    await expect(remove).toHaveCount(1, { timeout: 20_000 });
    await remove.hover();
    await remove.click({ force: true });
    await page.getByRole('button', { name: '✓' }).click();
    await page.locator('input[type="file"][accept="image/*"]').first()
      .setInputFiles({ name: 'druga.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('NEW')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect.poll(async () => (await attachments(page, ev!.id)).map(a => a.filename),
      { timeout: 30_000 }).toEqual(['druga.png']);
  });
});
