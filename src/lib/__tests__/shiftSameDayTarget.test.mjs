/**
 * S152 C3 — promjena datuma u Editu pomice `Datum naplate` SAMO za `same`
 * pravilo (Racun/Cash) i SAMO kad je target bio izveden iz starog datuma.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Redak `Izvor = Racun` kojem se u Editu promijeni datum ostajao je sa
 *   starim `Datum naplate`, a Racun se naplacuje isti dan. Obrnuto je jednako
 *   vazno: kartice se NE smiju dirati (datum s izvoda), ni rucno upisan datum.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'shiftSameDay.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { shiftSameDayTarget } from './src/lib/attributeRules';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { shiftSameDayTarget } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const RULE = {
  action: 'set_attribute', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
  date_map: { Racun: 'same', Cash: 'same', Mastercard: 'next:11', Visa: 'cutoff:3:5' },
};
const OLD = new Date(2026, 8, 20, 14, 5);   // 20.09.2026. lokalno
const NEW = new Date(2026, 8, 18, 14, 5);   // 18.09.2026.

console.log('');
console.log('Racun/Cash — izveden datum prati promjenu:');
ok('app oblik (lokalno 12:00) => novi dan',
   shiftSameDayTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, NEW) === '2026-09-18T12:00');
ok('baza oblik (+00:00) => novi dan',
   shiftSameDayTarget(RULE, 'Racun', '2026-09-20T10:00:00+00:00', OLD, NEW) === '2026-09-18T12:00');
ok('uvoz (ponoc UTC) => novi dan',
   shiftSameDayTarget(RULE, 'Cash', '2026-09-20T00:00:00+00:00', OLD, NEW) === '2026-09-18T12:00');
ok('pomak preko mjeseca', shiftSameDayTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, new Date(2026, 9, 2, 9)) === '2026-10-02T12:00');

console.log('');
console.log('Ne dira:');
ok('Mastercard (next:11)', shiftSameDayTarget(RULE, 'Mastercard', '2026-10-11T12:00', OLD, NEW) === null);
ok('Visa (cutoff) — ni kad se slucajno poklapa sa starim datumom',
   shiftSameDayTarget(RULE, 'Visa', '2026-09-20T12:00', OLD, NEW) === null);
ok('Racun, ali target RUCNO drugi dan', shiftSameDayTarget(RULE, 'Racun', '2026-09-22T12:00', OLD, NEW) === null);
ok('prazan target', shiftSameDayTarget(RULE, 'Racun', null, OLD, NEW) === null);
ok('prazan Izvor', shiftSameDayTarget(RULE, '', '2026-09-20T12:00', OLD, NEW) === null);
ok('nepoznat Izvor', shiftSameDayTarget(RULE, 'Revolut', '2026-09-20T12:00', OLD, NEW) === null);
ok('promijenjeno samo vrijeme, isti dan', shiftSameDayTarget(RULE, 'Racun', '2026-09-20T12:00', OLD, new Date(2026, 8, 20, 18)) === null);
ok('neparsiv target', shiftSameDayTarget(RULE, 'Racun', 'jucer', OLD, NEW) === null);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
