/**
 * `default_map` na NOVIM retcima Excel uvoza (S181, `importDefaults.ts`).
 *
 * /!\ STO OVAJ TEST CUVA
 *   Uvoz je do S181 prazan `Status`/`Namjenu` ostavljao praznima, iako forma
 *   upisuje zadano. Popravak smije dirati SAMO praznu celiju i SAMO `default_map`:
 *   `default_value` (Fitness `Trening_type=easy`) na povijesnom uvozu bi izmislio
 *   podatak, a popunjena vrijednost i `_` su odluka covjeka.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'importDefaults.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  entryPoints: ['src/lib/importDefaults.ts'], bundle: true, format: 'esm', platform: 'node',
  outfile: out, logLevel: 'error',
});
const { fillDefaultMaps, defaultFillsMessage } = await import(pathToFileURL(out).href);

const FIN = 'fin', FIT = 'fit', CHAIN = 'chain';
const def = (id, category_id, name, slug, validation_rules = null, default_value = null) =>
  ({ id, category_id, name, slug, data_type: 'text', unit: null, is_required: false, default_value, validation_rules, sort_order: 0 });
const defs = [
  def('t', FIN, 'Tip', 'tip', { type: 'suggest', options: ['Razno', 'auto C5'] }),
  def('i', FIN, 'Izvor', 'izvorplacanja'),
  def('n', FIN, 'Namjena', 'namjena', { depends_on: { attribute_slug: 'tip',
    options_map: { '*': ['Zajedničko', 'Koka', 'Saša'] },
    default_map: { '*': 'Zajedničko', 'auto C5': 'Koka', 'auto Lacetti': 'Saša' } } }),
  def('s', FIN, 'Status', 'status', { depends_on: { attribute_slug: 'izvorplacanja',
    options_map: { Racun: ['Izvrsen', 'Planiran'] },
    default_map: { Racun: 'Izvrsen', Mastercard: 'Planiran' } } }),
  // Fitness: SAMO default_value — ne smije se upisati
  def('ft', FIT, 'Trening_type', 'trening_type', { type: 'suggest', options: ['easy', 'hard'] }, 'easy'),
  // Lanac: B ovisi o A, A ovisi o X; oba imaju default_map
  def('x', CHAIN, 'X', 'x'),
  def('a', CHAIN, 'A', 'a', { depends_on: { attribute_slug: 'x', options_map: {}, default_map: { '*': 'a1' } } }),
  def('b', CHAIN, 'B', 'b', { depends_on: { attribute_slug: 'a', options_map: {}, default_map: { a1: 'b-od-a1' } } }),
];
const row = (n, cat, attributes) => ({ event_id: null, area: 'A', category_path: cat, event_date: '2026-10-20',
  session_start: '14:00', created_at: '', comment: `r${n}`, attributes, _source_row: n });
const catsOf = r => (r.category_path === 'NEPOZNATO' ? null : [r.category_path]);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' | ' + extra : '')); }
};

const input = [
  row(1, FIN, { Tip: 'auto C5', Izvor: 'Racun' }),
  row(2, FIN, { Tip: 'Razno', Izvor: 'Mastercard', Namjena: '' }),
  row(3, FIN, { Tip: '', Izvor: '' }),
  row(4, FIN, { Tip: 'Razno', Izvor: 'Racun', Namjena: 'Saša', Status: 'Planiran' }),
  row(5, FIN, { Tip: 'auto Lacetti', Namjena: '_' }),
  row(6, FIT, { Trening_type: '' }),
  row(7, 'NEPOZNATO', { Tip: 'Razno' }),
  row(8, CHAIN, {}),
];
const before = JSON.stringify(input);
const { rows, fills } = fillDefaultMaps(input, defs, catsOf);
const A = n => rows[n - 1].attributes;

console.log('');
console.log('Namjena (Tip ⇒ default_map, `*` za ostalo i prazno):');
ok('auto C5 ⇒ Koka', A(1).Namjena === 'Koka', A(1).Namjena);
ok('Razno (prazan string) ⇒ Zajedničko', A(2).Namjena === 'Zajedničko', A(2).Namjena);
ok('prazan Tip ⇒ Zajedničko (`*`, kao forma)', A(3).Namjena === 'Zajedničko', A(3).Namjena);

console.log('');
console.log('Ne dira ono što je odluka:');
ok('popunjena Namjena ostaje (Saša)', A(4).Namjena === 'Saša', A(4).Namjena);
ok('popunjen Status ostaje (Planiran uz Racun)', A(4).Status === 'Planiran', A(4).Status);
ok('`_` ostaje `_`', A(5).Namjena === '_', A(5).Namjena);
ok('default_value (Fitness) se NE upisuje', A(6).Trening_type === '', JSON.stringify(A(6)));
ok('redak koji se ne da smjestiti je netaknut (ista referenca)', rows[6] === input[6]);
ok('ulaz nije mijenjan', JSON.stringify(input) === before);

console.log('');
console.log('Status (default_map bez `*`):');
ok('Izvor Racun ⇒ Izvrsen', A(1).Status === 'Izvrsen', A(1).Status);
ok('Izvor Mastercard ⇒ Planiran', A(2).Status === 'Planiran', A(2).Status);
ok('prazan Izvor ⇒ Status ostaje prazan (nema `*`)', A(3).Status === undefined, A(3).Status);

console.log('');
console.log('Lanac i brojanje:');
ok('A ⇐ `*`, pa B ⇐ A (lanac u dva prolaza)', A(8).A === 'a1' && A(8).B === 'b-od-a1', JSON.stringify(A(8)));
const f = Object.fromEntries(fills.map(x => [`${x.attrName}=${x.value}`, x.count]));
ok('brojanje: Namjena Zajedničko 2, Koka 1; Status Izvrsen 1, Planiran 1',
   f['Namjena=Zajedničko'] === 2 && f['Namjena=Koka'] === 1 && f['Status=Izvrsen'] === 1 && f['Status=Planiran'] === 1,
   JSON.stringify(f));
const msg = defaultFillsMessage(fills.filter(x => x.attrName === 'Namjena'));
ok('poruka nabraja atribut, ukupno i po vrijednosti',
   msg && msg.includes('Namjena 3 (Zajedničko 2, Koka 1)'), msg);
ok('bez upisa nema poruke', defaultFillsMessage([]) === null);

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
