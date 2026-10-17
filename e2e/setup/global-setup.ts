/**
 * Reset the seed Area to its seeded state before every run.
 *
 * WHY THIS EXISTS
 *   Specs delete the leaf event they created, but a leaf carries a P2 parent
 *   chain — and the parents were left behind. They accumulate silently: after a
 *   few interrupted runs the Fitness export carries rows the spec never wrote,
 *   and the next import collides with them. That does not surface as "residue",
 *   it surfaces as the feature under test looking broken:
 *     · T-S107-2 wrote a comment that was already there ⇒ no change ⇒ no guard
 *     · T-S107w-1 hit a collision ⇒ Apply never appeared ⇒ report never downloaded
 *   Both were chased as bugs on 2026-08-26 before the cause was measured.
 *
 * Deletes every event in the Fitness Area that seed.sql did not put there
 * (leaf first, then parents — the FK forbids the other order).
 *
 * S172: E2E ACCOUNTS ARE FOR TESTS ONLY — and this file now makes that true.
 *   Measured 2026-10-17 on TEST: owner@test.com had a WRITE share on a manual
 *   tester's `Health_Sasa` (slug `health`, May) plus seven areas left behind by
 *   interrupted runs (`S100 A …`, `S121 ctx …`, a second `Health_Sasa`, `Alpha`).
 *   E11-4 and E12-2 failed on EVERY run because of it (two "Health" options; the
 *   `health` template not offered because a `health` area was already visible)
 *   — and both looked like app bugs. So before each run, for both E2E accounts:
 *     · a share FROM a non-E2E user is removed (the grantee may — `data_shares_delete`),
 *     · an own area that seed.sql did not create is deleted with everything in it.
 *   Each removal is printed: a silent cleanup would hide that someone shared again.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.testing') });

const FITNESS   = 'a1000000-0000-0000-0000-000000000001';
const SEED_DATE = '2026-01-01';   // the only date seed.sql writes
// seed.sql: owner@test.com, userb@test.com and the only two areas it creates.
const E2E_USERS  = ['eef0d779-05ee-4f79-9524-78589701a861', '93b96e77-5c82-47ef-b0ba-011dc399cc4d'];
const SEED_AREAS = new Set([FITNESS, 'a1000000-0000-0000-0000-000000000002']);

/**
 * Refuse to run against anything but TEST.
 *
 * `playwright.config.ts` has `reuseExistingServer: true` and a fixed
 * `baseURL: localhost:5173`. If a dev server is already sitting there — and
 * `npm run dev:prod` sits on the very same port — Playwright does NOT start its
 * own; it adopts that one and runs the whole suite against PRODUCTION, while
 * this file happily resets the TEST database with its own client. Two halves of
 * the run looking at two different databases, and nothing in Playwright's output
 * says which one the browser saw.
 *
 * Measured 2026-09-10 (S134): port 5173 was serving `zdojdazosfoajwnuafgx`
 * (PROD) while `.env.testing` pointed at `xtnbhmojmffjelsqejpw` (TEST). That run
 * would have stopped at the login screen — but a spec that DOES log in would
 * have written to production.
 *
 * The check is a single request for the module that carries the client, because
 * Vite inlines `import.meta.env` into what it serves — so this measures what the
 * browser will actually get, not what a config file claims.
 *
 * ⚠ A server that does not answer is NOT a failure: Playwright starts its own
 *   afterwards. Only an answer naming the wrong project stops the run.
 */
async function assertServedBuildIsTest(expectedUrl: string): Promise<void> {
  const probe = 'http://localhost:5173/src/lib/supabaseClient.ts';
  let body: string;
  try {
    const res = await fetch(probe, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return;
    body = await res.text();
  } catch {
    return;                       // nitko ne slusa -> Playwright ce dici svoj
  }
  const served = body.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
  if (!served) return;            // ne moze se procitati -> ne izmisljaj nalaz
  if (served !== expectedUrl) {
    throw new Error(
      `\n\n  E2E STOP: dev server na :5173 servira ${served},\n` +
      `  a .env.testing ocekuje ${expectedUrl}.\n\n` +
      `  Playwright bi ga preuzeo (reuseExistingServer) i vrtio testove protiv\n` +
      `  te baze, dok bi global-setup cistio TEST.\n\n` +
      `  Ugasi taj server (vjerojatno "npm run dev:prod") pa pokreni E2E ponovo.\n`
    );
  }
}

/** ⚠ An RLS-blocked DELETE "succeeds" with zero rows — so every delete is counted. */
async function deleted(q: PromiseLike<{ data: unknown[] | null }>): Promise<number> {
  const { data } = await q;
  return data?.length ?? 0;
}

/** Foreign shares out, leftover own areas out (S172 — see header). */
async function resetAccount(sb: SupabaseClient, me: string, label: string): Promise<void> {
  const { data: shares } = await sb.from('data_shares').select('id, owner_id, target_id').eq('grantee_id', me);
  for (const sh of (shares ?? []).filter(x => !E2E_USERS.includes(x.owner_id as string))) {
    const n = await deleted(sb.from('data_shares').delete().eq('id', sh.id).select('id'));
    console.log(`[global-setup] ${label}: ${n ? 'removed' : 'COULD NOT remove'} foreign share on area ${sh.target_id}`);
  }

  const { data: areas } = await sb.from('areas').select('id, name').eq('user_id', me);
  for (const a of (areas ?? []).filter(x => !SEED_AREAS.has(x.id as string))) {
    const { data: cats } = await sb.from('categories').select('id, level').eq('area_id', a.id);
    const cids = (cats ?? []).map(c => c.id as string);
    if (cids.length) {
      const list = cids.join(',');
      // P2 parents live OUTSIDE the subtree but carry chain_key = leaf (S162).
      const { data: evs } = await sb.from('events').select('id')
        .or(`category_id.in.(${list}),chain_key.in.(${list})`);
      const eids = (evs ?? []).map(e => e.id as string);
      if (eids.length) {
        await sb.from('event_attributes').delete().in('event_id', eids);
        await sb.from('event_attachments').delete().in('event_id', eids);
        await sb.from('events').delete().in('id', eids);
      }
      await sb.from('activity_presets').delete().eq('area_id', a.id);
      await sb.from('attribute_definitions').delete().in('category_id', cids);
      for (const c of [...(cats ?? [])].sort((x, y) => (y.level as number) - (x.level as number))) {
        await sb.from('categories').delete().eq('id', c.id);
      }
    }
    await sb.from('data_shares').delete().eq('target_id', a.id);
    const n = await deleted(sb.from('areas').delete().eq('id', a.id).select('id'));
    console.log(`[global-setup] ${label}: ${n ? 'deleted' : 'COULD NOT delete'} leftover area "${a.name}"`);
  }
}

async function resetFitness(sb: SupabaseClient): Promise<void> {
  const { data: cats } = await sb.from('categories').select('id').eq('area_id', FITNESS);
  if (!cats?.length) return;

  const { data: evs } = await sb.from('events')
    .select('id, chain_key, event_date')
    .in('category_id', cats.map(c => c.id));
  const junk = (evs ?? []).filter(e => e.event_date !== SEED_DATE);
  if (junk.length === 0) return;

  // Leaf rows have no chain_key; parents do. Parents must go last.
  const ordered = [...junk.filter(e => !e.chain_key), ...junk.filter(e => e.chain_key)];
  let removed = 0;
  for (const e of ordered) {
    await sb.from('event_attributes').delete().eq('event_id', e.id);
    removed += await deleted(sb.from('events').delete().eq('id', e.id).select('id'));
  }
  console.log(`[global-setup] Fitness reset: removed ${removed}/${junk.length} leftover events`);
}

async function signIn(url: string, key: string, email?: string, password?: string) {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: email!, password: password! });
  return error || !data.user ? { sb: null, id: '', error: error?.message ?? 'no user' } : { sb, id: data.user.id, error: '' };
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  await assertServedBuildIsTest(url);

  const owner = await signIn(url, key, process.env.PLAYWRIGHT_TEST_EMAIL, process.env.PLAYWRIGHT_TEST_PASSWORD);
  if (!owner.sb) { console.warn('[global-setup] login failed, skipping reset:', owner.error); return; }
  await resetAccount(owner.sb, owner.id, 'owner');
  await resetFitness(owner.sb);

  const userb = await signIn(url, key, process.env.PLAYWRIGHT_TEST_EMAIL_B, process.env.PLAYWRIGHT_TEST_PASSWORD_B);
  if (!userb.sb) { console.warn('[global-setup] userb login failed, skipping its reset:', userb.error); return; }
  await resetAccount(userb.sb, userb.id, 'userb');
}
