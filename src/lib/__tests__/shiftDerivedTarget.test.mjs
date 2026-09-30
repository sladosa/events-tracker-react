/**
 * S152 C3 + S155 C3b — promjena datuma u Editu pomice izveden target
 * (`Datum naplate`) za SVAKO pravilo, osim kad je redak ozigosan.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   C3 je pomicao samo `same` (Racun/Cash), pa kartica na otvorenoj kosari
 *   nije pratila datum. I obrnuto: ozigosan Racun redak (datum s izvoda) se
 *   POMICAO — a „izveden" se ondje ne da prepoznati iz vrijednosti, jer Racun
 *   ima naplatu = dan transakcije i s izvoda, a MC banka tereti 11. — tocno
 *   ono sto `next:11` izracuna. Zato zig mora prevladati, i to se mora reci
 *   (`{ locked: true }`), ne presutjeti.
 */
process.env.TZ = 'Europe/Zagreb';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'shiftDerived.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { shiftDerivedTarget } from './src/lib/attributeRules';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { shiftDerivedTarget } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const val = (r) => (r && 'value' in r ? r.value : r && 'locked' in r ? 'LOCKED' : null);

const RULE = {
  action: 'set_attribute', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
  date_map: { Racun: 'same', Cash: 'same', Mastercard: 'next:11', Visa: 'cutoff:3:5' },
  lock_slug: 'izvod_opis',
};
const OLD = new Date(2026, 8, 20, 14, 5);   // 20.09.2026. lokalno
const NEW = new Date(2026, 8, 18, 14, 5);   // 18.09.2026.

console.log('');
console.log('Racun/Cash — izveden datum prati promjenu:');
ok('app oblik (lokalno 12:00) => novi dan',
   val(shiftDerivedTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, NEW)) === '2026-09-18T12:00');
ok('baza oblik (+00:00) => novi dan',
   val(shiftDerivedTarget(RULE, 'Racun', '2026-09-20T10:00:00+00:00', OLD, NEW)) === '2026-09-18T12:00');
ok('uvoz (ponoc UTC) => novi dan',
   val(shiftDerivedTarget(RULE, 'Cash', '2026-09-20T00:00:00+00:00', OLD, NEW)) === '2026-09-18T12:00');
ok('pomak preko mjeseca',
   val(shiftDerivedTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, new Date(2026, 9, 2, 9))) === '2026-10-02T12:00');

console.log('');
console.log('Kartice na NEOZIGOSANOM retku (C3b) — izveden datum prati promjenu:');
ok('Mastercard: preko granice ciklusa => sljedeca naplata',
   val(shiftDerivedTarget(RULE, 'Mastercard', '2026-10-11T12:00', OLD, new Date(2026, 9, 5, 9))) === '2026-11-11T12:00');
ok('Mastercard: isti ciklus => nema promjene (null, ne prazan pomak)',
   shiftDerivedTarget(RULE, 'Mastercard', '2026-10-11T12:00', OLD, NEW) === null);
ok('Visa (cutoff:3:5): 20.09. -> 04.10. => 05.10. postaje 05.11.',
   val(shiftDerivedTarget(RULE, 'Visa', '2026-10-05T12:00', OLD, new Date(2026, 9, 4, 9))) === '2026-11-05T12:00');
ok('Visa: 20.09. -> 02.10. (prije granice) => ostaje 05.10.',
   shiftDerivedTarget(RULE, 'Visa', '2026-10-05T12:00', OLD, new Date(2026, 9, 2, 9)) === null);
ok('Visa s BANKINIM datumom (07.10., ne izveden) => ne dira',
   shiftDerivedTarget(RULE, 'Visa', '2026-10-07T12:00', OLD, new Date(2026, 9, 4, 9)) === null);

console.log('');
console.log('Ozigosan redak — ne pomice, ali KAZE zasto:');
ok('Racun, zig => locked (a ne pomak)',
   val(shiftDerivedTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, NEW, true)) === 'LOCKED');
ok('Mastercard, zig, preko granice => locked',
   val(shiftDerivedTarget(RULE, 'Mastercard', '2026-10-11T12:00', OLD, new Date(2026, 9, 5, 9), true)) === 'LOCKED');
ok('zig, ali pomak ne bi nista promijenio (isti dan) => null, nema poruke',
   shiftDerivedTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, new Date(2026, 8, 20, 18), true) === null);
ok('zig, target rucno drugi dan => null (nema sto reci)',
   shiftDerivedTarget(RULE, 'Racun', '2026-09-22T12:00', OLD, NEW, true) === null);

console.log('');
console.log('Ne dira:');
ok('Racun, ali target RUCNO drugi dan', shiftDerivedTarget(RULE, 'Racun', '2026-09-22T12:00', OLD, NEW) === null);
ok('prazan target', shiftDerivedTarget(RULE, 'Racun', null, OLD, NEW) === null);
ok('prazan Izvor', shiftDerivedTarget(RULE, '', '2026-09-20T12:00', OLD, NEW) === null);
ok('nepoznat Izvor', shiftDerivedTarget(RULE, 'Revolut', '2026-09-20T12:00', OLD, NEW) === null);
ok('promijenjeno samo vrijeme, isti dan', shiftDerivedTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, new Date(2026, 8, 20, 18)) === null);
ok('neparsiv target', shiftDerivedTarget(RULE, 'Racun', 'jucer', OLD, NEW) === null);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
