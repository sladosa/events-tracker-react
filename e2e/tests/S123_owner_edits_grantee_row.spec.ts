/**
 * S123 — vlasnica Aree smije ISPRAVITI grantee-jev redak, ali ne obrisati (043).
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Koka je vlasnica `Financije_all`, Sasa upisuje kroz UI. Kad ona primijeti
 *   pogresku na njegovom retku, prije 043 nije imala sto napraviti: Excel put
 *   forsira INSERT s novim ID-em (duplikat), UI je skrivao Edit i Delete, a RLS
 *   je tudji redak dopustao samo PREUZETI (WITH CHECK auth.uid() = user_id).
 *
 *   Sasina odluka: samo Edit. Zato test cuva OBJE strane — da se Edit otvorio
 *   VLASNICI, i da se pritom nije otvorilo brisanje.
 *
 * NAJVAZNIJI SLUCAJ JE T-S123-2, i to zbog atributa.
 *   Edit tok BRISE pa ponovno upisuje sve atribute retka. Bez INSERT grane u
 *   043 DELETE prodje a INSERT padne, pa redak ostane BEZ IJEDNOG ATRIBUTA —
 *   a na ekranu izgleda kao da je spremljeno. Test zato ne gleda samo je li
 *   komentar promijenjen nego i je li atribut prezivio, i pod cijim je imenom.
 *
 * Bez migracije 043 ovaj spec pada. To je namjerno: on je jedini automatski
 * dokaz da je migracija pustena na bazi protiv koje se vrti.
 */
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAsOwner, supabaseUpsert, supabaseDelete } from '../fixtures/auth';
import { selectFilterPath, SEED } from '../fixtures/filter';

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const OWNER_ID = 'eef0d779-05ee-4f79-9524-78589701a861';
const USERB_ID = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

// Marker mora biti jedinstven PO RUNU: fiksan literal se sudari s ostatkom
// prekinutog pokusaja, pa upis vise nije promjena i test mjeri nista.
const MARKER = `S123-${Date.now()}`;

let eventId = '';
let attrDefId = '';

test.setTimeout(120_000);

async function signIn(email: string, password: string) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email} failed: ${error.message}`);
  return sb;
}
const asOwner = () => signIn(process.env.PLAYWRIGHT_TEST_EMAIL!, process.env.PLAYWRIGHT_TEST_PASSWORD!);
const asUserB = () => signIn(process.env.PLAYWRIGHT_TEST_EMAIL_B!, process.env.PLAYWRIGHT_TEST_PASSWORD_B!);

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAsOwner(page);
  await page.goto('/app');

  await supabaseUpsert(page, 'data_shares', {
    owner_id: OWNER_ID, grantee_id: USERB_ID,
    share_type: 'area', target_id: SEED.AREA_FITNESS, permission: 'write',
  }, 'owner_id,grantee_id,target_id,share_type');

  const owner = await asOwner();
  const { data: def, error: defErr } = await owner.from('attribute_definitions').insert({
    category_id: SEED.CAT_STRENGTH, name: 'S123 Marker', slug: `s123_marker_${Date.now()}`,
    data_type: 'text', user_id: OWNER_ID, sort_order: 900,
  }).select('id').single();
  if (defErr) throw new Error(`attr def insert: ${defErr.message}`);
  attrDefId = def!.id;

  // Grantee upisuje SVOJ redak u tudju Areu — to je situacija koju ispravljamo.
  const b = await asUserB();
  const { data: ev, error: evErr } = await b.from('events').insert({
    user_id: USERB_ID, category_id: SEED.CAT_STRENGTH,
    event_date: '2026-08-31', session_start: '2026-08-31T16:30:00Z',
    comment: `${MARKER} original`,
  }).select('id').single();
  if (evErr) throw new Error(`event insert: ${evErr.message}`);
  eventId = ev!.id;
  const { error: vErr } = await b.from('event_attributes').insert({
    event_id: eventId, user_id: USERB_ID,
    attribute_definition_id: attrDefId, value_text: 'prezivi-me',
  });
  if (vErr) throw new Error(`attr value insert: ${vErr.message}`);

  await ctx.close();
});

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAsOwner(page);
  await page.goto('/app');
  const owner = await asOwner();
  if (eventId) {
    await owner.from('event_attributes').delete().eq('event_id', eventId);
    await owner.from('events').delete().eq('id', eventId);
  }
  if (attrDefId) await owner.from('attribute_definitions').delete().eq('id', attrDefId);
  await supabaseDelete(page, 'data_shares', { owner_id: OWNER_ID, grantee_id: USERB_ID });
  await ctx.close();
});

async function gotoStrength(page: Page) {
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Activities' })).toBeVisible({ timeout: 20_000 });
  await selectFilterPath(page, SEED.AREA_FITNESS, [SEED.CAT_ACTIVITY, SEED.CAT_GYM, SEED.CAT_STRENGTH]);
}

/**
 * Otvori kebab meni na zadanom retku. Retry nije prikrivanje buga: promjena
 * filtra pokrene vise upita liste u pola sekunde, redak se remounta i odnese
 * tek otvoren izbornik (izmjereno u S122 nad e16). App se ponasa ispravno.
 */
async function openRowMenu(page: Page, rowText: string | RegExp) {
  const row = page.locator('tr').filter({ hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const menuBtn = row.locator('td.sticky button').first();
  await expect(async () => {
    await menuBtn.click();
    await expect(page.getByText(/view details/i).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

test('T-S123-1: vlasnica u meniju tudjeg retka ima Edit, ali NE i Delete', async ({ page }) => {
  await loginAsOwner(page);
  await gotoStrength(page);
  await openRowMenu(page, MARKER);

  await expect(page.getByText(/edit \(tuđi zapis\)/i)).toBeVisible();
  // Druga polovica Sasine odluke, i cuva se zasebno: gate je jedan `if` koji je
  // prije pokrivao Edit I Delete zajedno.
  await expect(page.getByText(/delete activity/i)).toHaveCount(0);
});

test('T-S123-2: ispravak se sprema, autorstvo ostaje, atribut prezivi', async ({ page }) => {
  await loginAsOwner(page);
  await gotoStrength(page);
  await openRowMenu(page, MARKER);
  await page.getByText(/edit \(tuđi zapis\)/i).click();

  await expect(page.getByText(/ispravljaš tuđi zapis/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ostaje pod njegovim imenom/i)).toBeVisible();

  // Polje komentara je <input>, ne <textarea> — `locator('textarea').first()`
  // uhvati skriveni Help panel ("Ask a question...") i test visi 20 s.
  const comment = page.getByPlaceholder('e.g., Felt strong today');
  await expect(comment).toBeVisible({ timeout: 20_000 });
  await comment.fill(`${MARKER} ispravljeno`);
  // Edit mod zavrsava na View ekranu, ne na listi — gumb to i kaze.
  await page.getByRole('button', { name: /save\s*→\s*view/i }).click();
  await page.waitForURL(/\/app\/view\//, { timeout: 30_000 });

  const owner = await asOwner();
  const { data: ev } = await owner.from('events')
    .select('comment, user_id, edited_by').eq('id', eventId).single();
  expect(ev?.comment).toContain('ispravljeno');
  // Autorstvo se NE mijenja — inace bi `User` kolona tvrdila da je vlasnica
  // upisala ono sto nije.
  expect(ev?.user_id).toBe(USERB_ID);
  expect(ev?.edited_by).toBe(OWNER_ID);

  // Hvata izostanak INSERT grane u 043: bez nje atribut nestane, a ekran
  // svejedno pokaze uspjeh.
  const { data: attrs } = await owner.from('event_attributes')
    .select('value_text, user_id').eq('event_id', eventId);
  expect(attrs?.length).toBe(1);
  expect(attrs?.[0].value_text).toBe('prezivi-me');
  expect(attrs?.[0].user_id).toBe(USERB_ID);
});

/**
 * T-S123-3: oznaka ✎ stoji uz ⋮ na OBA rasporeda.
 *
 * ZASTO NA OBA, I ZASTO JE TO CIJELI TEST
 *   Redak renderiraju dva razlicita mjesta: `cellContent('actions')` za desktop
 *   (`tr.hidden.sm:table-row`) i sticky celija uskog retka (`tr.sm:hidden`).
 *   Do S125 je oznaku imalo samo drugo — a Playwright vrti 1280 px, dakle
 *   desktop. Zato je BUG-S123-EDITMARK izgledao kao da se ✎ "ne prikazuje" i
 *   kao da je krivnja do E2E okoline; bio je tocan nalaz o kodu, samo se
 *   trazio na krivom mjestu (mrezni odgovor, locator, stale bundle).
 *   Potvrdjeno rucno na PROD-u 2026-09-02: uski ekran je oznaku pokazivao,
 *   siroki ne, uz uredno upisan `edited_by`.
 *
 * NEOVISAN O T-S123-2 namjerno: `edited_by` se ovdje upisuje sam, pa test mjeri
 * PRIKAZ, ne lanac dvaju testova. (Da ovisi, pad T-S123-2 bi ga oborio i
 * odveo na krivi trag po drugi put.)
 */
test('T-S123-3: oznaka ✎ se vidi i na desktopu i na uskom ekranu', async ({ page }) => {
  // Vlasnica smije UPDATE tudjeg retka — to je bas ono sto 043 otvara, pa ovaj
  // upis usput mjeri i RLS: bez 043 ostane 0 promijenjenih redaka.
  const owner = await asOwner();
  const { data: upd, error } = await owner.from('events')
    .update({ edited_by: OWNER_ID }).eq('id', eventId).select('id');
  if (error) throw new Error(`edited_by update: ${error.message}`);
  // ⚠ RLS-blokiran write "uspije" s 200 i praznim rezultatom — mjeri se broj
  //   redaka, nikad HTTP status.
  expect(upd?.length).toBe(1);

  await loginAsOwner(page);
  await gotoStrength(page);

  const mark = page.locator('tr').filter({ hasText: MARKER })
    .locator('span[title*="Izmijenio"]:visible');

  // Desktop (uski redak je ovdje `sm:hidden`, dakle jedini vidljivi ✎ je onaj
  // iz `cellContent('actions')` — tocno grana koja je nedostajala).
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(mark.first()).toBeVisible({ timeout: 30_000 });

  // Uski (sada je obrnuto: desktop redak je `hidden`).
  await page.setViewportSize({ width: 390, height: 840 });
  await expect(mark.first()).toBeVisible({ timeout: 30_000 });
});
