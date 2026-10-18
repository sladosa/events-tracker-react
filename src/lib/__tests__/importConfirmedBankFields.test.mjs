/**
 * importConfirmedBankFields.test.mjs — uvoz pita za „potvrđeno stanje" SAMO kad
 * se mijenja bankino polje, ISTO pravilo kao Edit (C3c) — 18.10., T-S169-6
 *
 * ZASTO POSTOJI
 *   Razvrstavanje 49 RF redaka (izmjena samo Tip/Podtip) tražilo je kvačicu
 *   „9 redaka unutar POTVRĐENOG stanja". Edit pita samo za bankina polja
 *   (`bankFieldSpec`): datum, iznos, račun, Izvor, žig i target pravila.
 *   Kutija koja pali na svakom uvozu razvrstavanja nauči se otklikati (S143) —
 *   a starija povijest je 1.400+ redaka razvrstavanja.
 *
 * /!\ Ključevi se uspoređuju preko `isBankKey` — iste funkcije koju zove Edit,
 *     nad spec-om iz istog configa. Dvije kopije uvjeta se jednom raziđu.
 * /!\ PROTUPROVJERA: staro ponašanje (svaka izmjena pita) pada.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'importConfirmedBankFields.bundle.mjs');
await build({
  stdin: {
    contents: "export { importBankChanges } from './src/lib/excelImport'; export { bankFieldSpec, isBankKey } from './src/lib/confirmedRowEdit';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['exceljs'],
  alias: { '@': join(process.cwd(), 'src') },
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'x' }) },
});
const real = await import(pathToFileURL(out).href);
const OLD = { importBankChanges: (changes) => changes.map(c => c.field) };

// Oblik configa Financije_all (PROD): pločica salda + žig pravila `Datum naplate`
const SETTINGS = {
  dashboard: { widgets: [{ type: 'balance_by_group', group_by: 'racun', plus: 'uplata', minus: 'isplata',
    filters: [{ op: 'in', slug: 'izvorplacanja', values: ['Racun'] }] }] },
  automations: { attribute_rules: [{ action: 'set_attribute', source_slug: 'izvorplacanja',
    target_slug: 'datum_naplate', lock_slug: 'izvod_opis', date_map: {} }] },
};
const spec = real.bankFieldSpec(SETTINGS);
const CAT = 'cat-1';
const names = { Tip: 'tip', Podtip: 'podtip', Uplata: 'uplata', Isplata: 'isplata', Racun: 'racun',
  Izvor: 'izvorplacanja', 'Datum naplate': 'datum_naplate', 'Izvod opis': 'izvod_opis', Status: 'status' };
const attrByCatName = new Map(Object.entries(names).map(([n, s]) => [`${CAT}||${n}`, { slug: s }]));
const ch = (field, oldValue = 'a', newValue = 'b') => ({ field, oldValue, newValue });

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}`); } };
  const asks = changes => lib.importBankChanges(changes, CAT, attrByCatName, spec).length > 0;

  ok('samo Tip/Podtip ⇒ NE pita', !asks([ch('Tip', 'N/A', 'Kuća'), ch('Podtip', '', 'Režije')]));
  ok('samo opis (comment) ⇒ NE pita', !asks([ch('comment')]));
  ok('samo sat (session_start) ⇒ NE pita', !asks([ch('session_start', '14:00', '14:01')]));
  ok('Status ⇒ NE pita (nije u spec-u, kao Edit)', !asks([ch('Status', 'Planiran', 'Izvrsen')]));
  ok('iznos ⇒ pita', asks([ch('Tip'), ch('Isplata', '12.5', '13')]));
  ok('datum retka ⇒ pita', asks([ch('event_date', '2025-01-02', '2025-01-03')]));
  ok('račun ⇒ pita', asks([ch('Racun', 'ZABA', 'RF')]));
  ok('Izvor ⇒ pita', asks([ch('Izvor', 'Visa', 'Racun')]));
  ok('žig (Izvod opis) ⇒ pita', asks([ch('Izvod opis')]));
  ok('target pravila (Datum naplate) ⇒ pita', asks([ch('Datum naplate')]));
  return { pass, fail };
}

// Spec mora pokrivati točno ono što Edit pokriva (ista funkcija, isti config)
let sfail = 0;
for (const s of ['uplata', 'isplata', 'racun', 'izvorplacanja', 'datum_naplate', 'izvod_opis', '@event_date']) {
  if (!real.isBankKey(spec, s)) { sfail++; console.log(`  FAIL  spec ne pokriva ${s}`); }
}
for (const s of ['tip', 'podtip', 'status']) {
  if (real.isBankKey(spec, s)) { sfail++; console.log(`  FAIL  spec pokriva ${s}`); }
}
// Bez spec-a ⇒ prijašnje ponašanje (pita za sve)
if (real.importBankChanges([ch('Tip')], CAT, attrByCatName, undefined).length !== 1) {
  sfail++; console.log('  FAIL  bez spec-a mora pitati za svaku izmjenu');
}

const r = run(real, 'novo');
const o = run(OLD, 'staro');
console.log(`importConfirmedBankFields: ${r.pass} prolaz, ${r.fail + sfail} pad | protuprovjera (staro): ${o.fail} pad`);
if (r.fail + sfail > 0) { console.log('❌ importConfirmedBankFields'); process.exit(1); }
if (o.fail === 0) { console.log('❌ protuprovjera ne pada — test ne čuva ništa'); process.exit(1); }
console.log('✅ importConfirmedBankFields');
