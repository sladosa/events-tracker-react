/**
 * useDateBounds — „Data range" smije brojati samo odabranu Areu (S154)
 * ===================================================================
 * BUG-S154-DATARANGE: na TEST-u je `Financije_all` (2025-01-01 → 2026-08-24)
 * pokazivao „Data range: 2003-04-07 — 2027-04-30". Izmjereno REST-om: obje
 * granice su iz DRUGIH Area (`Health > Lab Results`, `Health_Sasa > Medical
 * Visit`), dakle upit je otišao nad cijelom bazom. Dva puta do toga:
 *   (a) utrka — `areaId` je pri učitavanju kratko `null`, pa upit nad cijelom
 *       bazom krene prvi i, ako stigne zadnji, pregazi filtrirani;
 *   (b) palo čitanje kategorija davalo je `[]`, a `[]` je značio „bez filtra".
 *
 * Test vrti PRAVI kod hooka (i pravi `retry.ts`) nad minimalnim React shimom i
 * lažnom bazom koja zna zakasniti — pa mjeri PONAŠANJE, ne izvor.
 *
 * Pokreće se iz korijena projekta:
 *   node src/hooks/__tests__/dateBounds.test.mjs
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

// ── minimalni React shim: jedna instanca, hookovi po redoslijedu ────────────
let slots = [];
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
  useRef(init) {
    const i = idx++;
    if (!slots[i]) slots[i] = { current: init };
    return slots[i];
  },
  useCallback(fn, deps) {
    const i = idx++;
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
const TODAY = '2026-09-28';
const categories = [
  { id: 'fin-tx', area_id: 'fin', parent_category_id: null },
  { id: 'hl-parent', area_id: 'health', parent_category_id: null },
  { id: 'hl-leaf', area_id: 'health', parent_category_id: 'hl-parent' },
];
const events = [
  { category_id: 'fin-tx', event_date: '2025-01-01' },
  { category_id: 'fin-tx', event_date: '2026-08-24' },
  { category_id: 'hl-leaf', event_date: '2003-04-07' },
  { category_id: 'hl-leaf', event_date: '2027-04-30' },
];

let failCategories = false;
let unfilteredEventQueries = 0;   // upiti nad `events` BEZ `.in('category_id', …)`
let slowUnfiltered = 0;           // ms kašnjenja za upit nad cijelom bazom

function builder(table) {
  const st = { table, eq: [], in: null, asc: true, limit: Infinity };
  const b = {
    select: () => b,
    eq: (col, v) => { st.eq.push([col, v]); return b; },
    in: (col, arr) => { st.in = [col, arr]; return b; },
    order: (_col, { ascending }) => { st.asc = ascending; return b; },
    limit: n => { st.limit = n; return b; },
    then(resolve, reject) {
      let delay = 1;
      let res;
      if (st.table === 'categories') {
        res = failCategories
          ? { data: null, error: new Error('simulirani pad') }   // PostgrestError je Error
          : { data: categories.filter(c => st.eq.every(([k, v]) => c[k] === v)).map(c => ({ id: c.id })), error: null };
      } else {
        if (!st.in) { unfilteredEventQueries++; delay = slowUnfiltered || 1; }
        const rows = events
          .filter(e => !st.in || st.in[1].includes(e.category_id))
          .sort((x, y) => (st.asc ? 1 : -1) * x.event_date.localeCompare(y.event_date))
          .slice(0, st.limit)
          .map(e => ({ event_date: e.event_date }));
        res = { data: rows, error: null };
      }
      return new Promise(r => setTimeout(r, delay)).then(() => res).then(resolve, reject);
    },
  };
  return b;
}
const supabaseStub = { from: table => builder(table) };

// ── učitaj PRAVI hook i pravi retry, preusmjeri samo uvoze ──────────────────
const dir = mkdtempSync(join(tmpdir(), 'datebounds-'));
const tsToMjs = async p => (await transform(readFileSync(p, 'utf8'), { loader: 'ts', format: 'esm' })).code;
writeFileSync(join(dir, 'retry.mjs'), await tsToMjs('src/lib/retry.ts'));
writeFileSync(join(dir, 'react-stub.mjs'),
  'export const useState=globalThis.__R.useState, useEffect=globalThis.__R.useEffect, '
  + 'useCallback=globalThis.__R.useCallback, useRef=globalThis.__R.useRef;');
writeFileSync(join(dir, 'supabase-stub.mjs'), 'export const supabase = globalThis.__SB;');
// S162: hook stablo čita iz `categoryCache` — lažni keš nad istim kategorijama,
// i jednako PADA kad je `failCategories` (palo čitanje nije „bez filtra").
writeFileSync(join(dir, 'categorycache-stub.mjs'),
  'export const getCategoryMapContaining = () => globalThis.__CC();');
writeFileSync(join(dir, 'categorytree.mjs'), await tsToMjs('src/lib/categoryTree.ts'));
globalThis.__CC = () => new Promise(r => setTimeout(r, 1)).then(() => {
  if (failCategories) throw new Error('simulirani pad');
  return new Map(categories.map(c => [c.id, { ...c, name: c.id }]));
});
writeFileSync(join(dir, 'localdate-stub.mjs'),
  `export const todayLocalYmd = () => '${TODAY}';\n`
  + 'export const localYmd = d => d.toISOString().slice(0, 10);');
writeFileSync(join(dir, 'hook.mjs'),
  (await tsToMjs('src/hooks/useDateBounds.ts'))
    .replace(/from ['"]react['"]/, "from './react-stub.mjs'")
    .replace(/from ['"]@\/lib\/supabaseClient['"]/, "from './supabase-stub.mjs'")
    .replace(/from ['"]@\/lib\/localDate['"]/, "from './localdate-stub.mjs'")
    .replace(/from ['"]@\/lib\/retry['"]/, "from './retry.mjs'")
    .replace(/from ['"]@\/lib\/categoryCache['"]/, "from './categorycache-stub.mjs'")
    .replace(/from ['"]@\/lib\/categoryTree['"]/, "from './categorytree.mjs'"));
globalThis.__R = React;
globalThis.__SB = supabaseStub;
const { useDateBounds } = await import(pathToFileURL(join(dir, 'hook.mjs')).href);

// ── driver ──────────────────────────────────────────────────────────────────
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Jedan render komponente s tim ulazom (efekti se izvrše, ništa se ne čeka). */
function render(areaId, categoryId = null) {
  idx = 0;
  pendingEffects = [];
  const out = useDateBounds(areaId, categoryId);
  for (const run of pendingEffects) run();
  return out;
}
function fresh() { slots = []; unfilteredEventQueries = 0; slowUnfiltered = 0; failCategories = false; }

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        dobio ${g}\n        htio  ${w}`); }
};
const range = r => [r.bounds.minDate, r.bounds.maxDate];

// 1 · Area: samo njezini retci; `maxDate` u prošlosti ⇒ danas
fresh();
render('fin'); await wait(120);
let r = render('fin');
eq('Area broji samo svoje retke', range(r), ['2025-01-01', TODAY]);
eq('...bez ijednog upita nad cijelom bazom', unfilteredEventQueries, 0);
eq('...i ne javlja se kao učitavanje', r.loading, false);

// 2 · JEZGRA (a): upit nad cijelom bazom (areaId još null) stiže POSLIJE
//     filtriranog. Točno tok iz aplikacije: FilterContext obnavlja Areu u efektu.
fresh();
slowUnfiltered = 40;
render(null);          // krene spori upit nad cijelom bazom
render('fin');         // Area obnovljena — brzi filtrirani upit
await wait(200);       // oba su stigla, sporiji zadnji
r = render('fin');
eq('zakašnjeli odgovor za `null` ne pregazi Areu', range(r), ['2025-01-01', TODAY]);

// 3 · ni jedan render ne pokazuje granice PRETHODNOG ulaza
fresh();
render(null); await wait(120);
r = render(null);
eq('bez Aree: cijela baza (legitimno)', range(r), ['2003-04-07', '2027-04-30']);
r = render('fin');     // prvi render s novom Areom, odgovor još nije stigao
eq('prvi render nove Aree ne nosi stare granice', range(r), [null, null]);
eq('...i javlja se kao učitavanje', r.loading, true);
await wait(120);
eq('...a poslije nosi svoje', range(render('fin')), ['2025-01-01', TODAY]);

// 4 · JEZGRA (b): palo čitanje kategorija NIJE „bez filtra"
fresh();
failCategories = true;
render('fin'); await wait(1200);   // pravi retry: 3 pokušaja, 300 + 600 ms
r = render('fin');
eq('palo čitanje kategorija ne broji cijelu bazu', unfilteredEventQueries, 0);
eq('...granice ostaju prazne', range(r), [null, null]);
eq('...a greška je rečena', r.error?.message ?? null, 'simulirani pad');
eq('...i nije „danas–danas" (auto-init bi to upisao kao All time)', r.bounds.minDate === TODAY, false);

// 5 · Area bez kategorija nema evenata — ne broji ništa, ne pada
fresh();
render('prazna'); await wait(120);
r = render('prazna');
eq('Area bez kategorija: nema retka, max = danas', range(r), [null, TODAY]);
eq('...bez upita nad cijelom bazom', unfilteredEventQueries, 0);

// 6 · kategorija: uključuje potomke
fresh();
render('health', 'hl-parent'); await wait(120);
eq('kategorija broji i potomke', range(render('health', 'hl-parent')), ['2003-04-07', '2027-04-30']);

console.log(`\n${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
