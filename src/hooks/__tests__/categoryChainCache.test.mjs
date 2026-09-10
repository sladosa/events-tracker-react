/**
 * useCategoryChain — keš mora slušati onoga tko ga čini zastarjelim (S132)
 * =======================================================================
 * `useCategoryChain` sprema CIJELI lanac kategorija, uključujući `settings`,
 * u `sessionStorage` bez TTL-a. `resolveEventNote` na Finishu čita
 * `categoryChain[0].settings.comment_template` — dakle iz te snimke, ne iz baze.
 *
 * Do S132 invalidacija je postojala samo kao komentar: `refetch` je nosio
 * napomenu „called after Structure edits", a nijedan od dva pozivatelja
 * (`AddActivityPage`, `EditActivityPage`) ga nije ni destrukturirao.
 *
 * ⚠ `sessionStorage` PREŽIVI F5 — gasi se tek zatvaranjem kartice. Zato je kvar
 *   izgledao neuklonjiv: izmjereno na PROD-u 09.09.2026., auto-comment template
 *   bio je obrisan i u `areas.settings` i u `categories.settings` (potvrđeno
 *   Structure exportom I s oba Edit panela), a Finish ga je i dalje upisivao.
 *
 * Test vrti PRAVI kod hooka nad minimalnim React shimom, pa mjeri PONAŠANJE:
 * pada ako netko makne listener ili pokvari `refetch`. Grep po izvoru to ne bi.
 *
 * Pokreće se iz korijena projekta:
 *   node src/hooks/__tests__/categoryChainCache.test.mjs
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

// ── okolina koju hook očekuje ───────────────────────────────────────────────
const store = new Map();
globalThis.sessionStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  // `length`/`key(i)` su dio Storage API-ja i `clearChainCache` hoda po njima.
  // Map cuva redoslijed umetanja, pa se indeksi pri brisanju pomicu tocno kao
  // u pravom `sessionStorage`u -- dakle i zamka "svaki drugi kljuc se preskoci"
  // je ovdje vjerno reproducirana.
  get length() { return store.size; },
  key: i => [...store.keys()][i] ?? null,
};

let listenerAdds = 0;
const bus = new EventTarget();
globalThis.window = {
  addEventListener: (t, h) => { listenerAdds++; bus.addEventListener(t, h); },
  removeEventListener: (t, h) => bus.removeEventListener(t, h),
  dispatchEvent: e => bus.dispatchEvent(e),
};

// ── minimalni React shim: jedna instanca, hookovi po redoslijedu ────────────
const slots = [];
let idx = 0;
let pendingEffects = [];

const sameDeps = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

const React = {
  useState(init) {
    const i = idx++;
    if (!slots[i]) slots[i] = { v: typeof init === 'function' ? init() : init };
    const s = slots[i];
    return [s.v, next => { s.v = typeof next === 'function' ? next(s.v) : next; }];
  },
  useCallback(fn, deps) {
    const i = idx++;
    // Identitet se čuva dok se deps ne promijene — bez toga bi se efekt
    // re-runao na svakom renderu (razred BUG-S121-AUTOSAVE).
    if (!slots[i] || !sameDeps(slots[i].deps, deps)) slots[i] = { fn, deps };
    return slots[i].fn;
  },
  useEffect(fn, deps) {
    const i = idx++;
    const prev = slots[i];
    if (!prev || !sameDeps(prev.deps, deps)) {
      pendingEffects.push(() => {
        if (prev && typeof prev.cleanup === 'function') prev.cleanup();
        slots[i].cleanup = fn();
      });
      slots[i] = { deps, cleanup: prev?.cleanup };
    }
  },
};

// ── lažna baza ──────────────────────────────────────────────────────────────
let dbReads = 0;
let serverRows = [{
  id: 'leaf-1', user_id: 'u1', area_id: 'a1', parent_category_id: null,
  name: 'Transakcija', description: null, slug: 'transakcija', level: 1,
  sort_order: 1, path: null, settings: { comment_template: '{racun}/{tip}/{podtip}' },
  created_at: null, updated_at: null,
}];
const supabaseStub = {
  from: () => ({
    select: () => ({
      order: async () => { dbReads++; return { data: structuredClone(serverRows), error: null }; },
    }),
  }),
};

// ── učitaj PRAVI hook, samo mu preusmjeri uvoze na stubove ──────────────────
const dir = mkdtempSync(join(tmpdir(), 'chain-'));
const src = readFileSync('src/hooks/useCategoryChain.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
writeFileSync(join(dir, 'react-stub.mjs'),
  'export const useState=globalThis.__R.useState, useEffect=globalThis.__R.useEffect, '
  + 'useCallback=globalThis.__R.useCallback;');
writeFileSync(join(dir, 'supabase-stub.mjs'), 'export const supabase = globalThis.__SB;');
writeFileSync(join(dir, 'hook.mjs'),
  code.replace(/from ['"]react['"]/, "from './react-stub.mjs'")
      .replace(/from ['"]@\/lib\/supabaseClient['"]/, "from './supabase-stub.mjs'"));
globalThis.__R = React;
globalThis.__SB = supabaseStub;
const { useCategoryChain } = await import(pathToFileURL(join(dir, 'hook.mjs')).href);

// ── driver ──────────────────────────────────────────────────────────────────
const tick = () => new Promise(r => setTimeout(r, 0));

async function render() {
  idx = 0;
  pendingEffects = [];
  const out = useCategoryChain('leaf-1');
  for (const run of pendingEffects) run();
  await tick(); await tick();
  idx = 0;                      // drugi prolaz čita svježe stanje iz slotova
  pendingEffects = [];
  const settled = useCategoryChain('leaf-1');
  for (const run of pendingEffects) run();
  await tick();
  return settled.chain.length ? settled : out;
}

/**
 * Odlazak s `/app/add` na `/app/` (Structure tab). React odmontira podstablo,
 * pa se cleanup svakog efekta izvrsi i hookovo stanje nestane.
 */
function unmount() {
  for (const slot of slots) {
    if (slot && typeof slot.cleanup === 'function') slot.cleanup();
  }
  slots.length = 0;
  idx = 0;
}

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        dobio ${g}\n        htio  ${w}`); }
};

const tpl = r => r.chain[0]?.settings?.comment_template ?? null;

// 1 · prvo učitavanje ide u bazu i sprema snimku
let r = await render();
eq('prvo učitavanje čita bazu', dbReads, 1);
eq('lanac nosi template iz baze', tpl(r), '{racun}/{tip}/{podtip}');

// 2 · template je maknut u bazi (Structure panel ili Structure import)
serverRows[0].settings = {};

// 3 · bez signala keš i dalje vraća STARO — ovo je zabilježeno ponašanje,
//     ne željeno: dokumentira zašto F5 nije pomagao.
r = await render();
eq('bez `areas-changed` keš ostaje star', tpl(r), '{racun}/{tip}/{podtip}');
eq('...i baza se NIJE ponovo čitala', dbReads, 1);

// 4 - listener U HOOKU osvjezi prikazano stanje dok je Add/Edit OTVOREN.
//     Korisno, ali NIJE jezgra popravka -- v. 6.
const addsBefore = listenerAdds;
window.dispatchEvent(new Event('areas-changed'));
await tick(); await tick();
r = await render();
eq('dispatch dok je hook MONTIRAN osvjezi lanac', tpl(r), null);
eq('...i to jednim novim citanjem baze', dbReads, 2);

// 5 - listener se ne smije re-registrirati na svakom renderu
//     (`refetch` mora ostati stabilan -- razred BUG-S121-AUTOSAVE)
await render();
await render();
eq('listener se ne veze iznova pri re-renderu', listenerAdds, addsBefore);

// ---------------------------------------------------------------------------
// 6 - JEZGRA: signal dolazi dok je hook ODMONTIRAN. To je jedini tok koji u
//     aplikaciji postoji: `useCategoryChain` zivi samo na `/app/add` i
//     `/app/edit/:s`, a svaki dispatcher `areas-changed` je u `AppHome`
//     (`/app/`) -- Structure panel, StructureTableView, Excel modali.
//
//     Izmjereno na PROD-u 10.09.2026.: template upisan u `categories.settings`
//     (potvrdjeno REST-om), a Finish napravio event s `comment = null`. Prva
//     verzija popravka (S132) imala je samo listener u hooku, pa ovdje nije
//     radila nista -- a test je prolazio jer je dispatchao dok je hook montiran.
// ---------------------------------------------------------------------------
serverRows[0].settings = { comment_template: 'NOVI {tip}' };
unmount();
window.dispatchEvent(new Event('areas-changed'));
await tick();
r = await render();
eq('signal dok je hook ODMONTIRAN ipak probija kes', tpl(r), 'NOVI {tip}');
eq('...i to jednim novim citanjem baze', dbReads, 3);

// 7 - brisu se SVI `chain_v1_*` kljucevi, ne svaki drugi. `removeItem` usred
//     petlje po indeksu pomakne preostale za jedno mjesto => pola ih prezivi,
//     i to bez ijedne greske (razred S108: paginacija bez `.order()`).
//     Mjeri se SAM brisac, pa hook mora biti odmontiran: montiran bi kroz
//     `refetch` legitimno vratio svoj kljuc odmah nakon brisanja, i test bi
//     prijavio kvar ondje gdje ga nema.
unmount();
store.set('chain_v1_x1', '[]');
store.set('chain_v1_x2', '[]');
store.set('chain_v1_x3', '[]');
store.set('et_activity_draft', 'ne diraj me');
window.dispatchEvent(new Event('areas-changed'));
await tick();
eq('nijedna snimka lanca ne prezivi', [...store.keys()].filter(k => k.startsWith('chain_v1_')), []);
eq('...a tudji kljucevi ostaju netaknuti', store.get('et_activity_draft'), 'ne diraj me');

// 8 - `structure-deleted` (Structure Delete modal) mora ciniti isto
unmount();
store.set('chain_v1_y1', '[]');
window.dispatchEvent(new Event('structure-deleted'));
await tick();
eq('`structure-deleted` takodjer brise kes', [...store.keys()].filter(k => k.startsWith('chain_v1_')), []);

console.log(`\n${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
