/**
 * importConfirmedCards.test.mjs — T21: uvoz ne trazi kvacicu „potvrdjeno
 * razdoblje" za kartične retke (S170)
 *
 * ZASTO POSTOJI
 *   Update-guard (faza 4, S143) je za svaki redak prije sidra trazio vlastitu
 *   kvacicu — i za Visa/MC retke, koji saldo NE MICU, pa ih sidro i ne
 *   „potvrdjuje". Lazna uzbuna na svakom uvozu s karticama (Backlog S155).
 *
 * /!\ Gleda se i stanje POSLIJE izmjene: `Visa → Racun` ispred sidra stvarno
 *     pomakne saldo i MORA pitati.
 * /!\ PROTUPROVJERA: staro ponasanje (uvijek pitaj) pada.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'importConfirmedCards.bundle.mjs');
await build({
  stdin: { contents: "export { inBalanceBeforeOrAfter } from './src/lib/excelImport';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['exceljs'],
  alias: { '@': join(process.cwd(), 'src') },
  // excelImport vuce supabaseClient — lazna adresa, nijedan poziv ne ide van
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'x' }) },
});
const real = await import(pathToFileURL(out).href);
const OLD = { inBalanceBeforeOrAfter: () => true };

// Filtri pločice salda Financije_all (S111): Izvor = Racun
const FILTERS = [{ op: 'in', slug: 'izvorplacanja', values: ['Racun'] }];
const CAT = 'cat-1';
const slugById = new Map([['d-izvor', 'izvorplacanja'], ['d-isplata', 'isplata']]);
const attrByCatName = new Map([[`${CAT}||Izvor`, { slug: 'izvorplacanja' }], [`${CAT}||Isplata`, { slug: 'isplata' }]]);
const row = izvor => ({ category_id: CAT, event_attributes: [
  { attribute_definition_id: 'd-izvor', value_text: izvor, value_number: null, value_datetime: null, value_boolean: null },
  { attribute_definition_id: 'd-isplata', value_text: null, value_number: 12.5, value_datetime: null, value_boolean: null },
] });
const ch = (field, oldValue, newValue) => ({ field, oldValue, newValue });

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}`); } };
  const f = (r, changes, filters = FILTERS) => lib.inBalanceBeforeOrAfter(r, changes, attrByCatName, slugById, filters);

  ok('Racun redak, promjena iznosa ⇒ pita', f(row('Racun'), [ch('Isplata', '12.5', '13')]) === true);
  ok('Visa redak, promjena iznosa ⇒ NE pita', f(row('Visa'), [ch('Isplata', '12.5', '13')]) === false);
  ok('Mastercard redak, promjena opisa ⇒ NE pita', f(row('Mastercard'), []) === false);
  ok('Visa → Racun ⇒ pita (poslije izmjene ulazi u saldo)', f(row('Visa'), [ch('Izvor', 'Visa', 'Racun')]) === true);
  ok('Racun → Visa ⇒ pita (prije izmjene je bio u saldu)', f(row('Racun'), [ch('Izvor', 'Racun', 'Visa')]) === true);
  ok('bez filtara ⇒ pita (prijasnje ponasanje)', f(row('Visa'), [], []) === true);
  return { pass, fail };
}

const r = run(real, 'novo');
const o = run(OLD, 'staro');
console.log(`importConfirmedCards: ${r.pass} prolaz, ${r.fail} pad | protuprovjera (staro): ${o.fail} pad`);
if (r.fail > 0) { console.log('❌ importConfirmedCards'); process.exit(1); }
if (o.fail === 0) { console.log('❌ protuprovjera ne pada — test ne čuva ništa'); process.exit(1); }
console.log('✅ importConfirmedCards');
