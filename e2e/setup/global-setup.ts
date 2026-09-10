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
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.testing') });

const FITNESS   = 'a1000000-0000-0000-0000-000000000001';
const SEED_DATE = '2026-01-01';   // the only date seed.sql writes

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

export default async function globalSetup(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  await assertServedBuildIsTest(url);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({
    email:    process.env.PLAYWRIGHT_TEST_EMAIL!,
    password: process.env.PLAYWRIGHT_TEST_PASSWORD!,
  });
  if (error) { console.warn('[global-setup] login failed, skipping reset:', error.message); return; }

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
    // ⚠ An RLS-blocked DELETE "succeeds" with zero rows — check, do not assume.
    const { data } = await sb.from('events').delete().eq('id', e.id).select('id');
    if (data?.length) removed++;
  }
  console.log(`[global-setup] Fitness reset: removed ${removed}/${junk.length} leftover events`);
}
