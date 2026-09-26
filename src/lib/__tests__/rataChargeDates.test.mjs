/**
 * S152 C2 — prva rata ne smije pasti mjesec prekasno.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Rata modal je imao vlastiti rjecnik (`rata.date_map`: goli dan, uvijek
 *   „od sljedeceg mjeseca"), a `Datum naplate` drugi (`next:11`, `cutoff:3:5`).
 *   Visa kupovina 1.–3. u mjesecu dobila je prvu ratu mjesec kasnije nego banka.
 *   Sada rata k = pravilo(dan kupnje) + (k-1) mjeseci.
 *   Usporedba sa starim ponasanjem preko cijele godine dokazuje da se za MC i
 *   za Visu od 4. nadalje NISTA ne mijenja.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'rataChargeDates.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { generateRataChargeDates, findChargeDateRule } from './src/lib/rataAutomation';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { generateRataChargeDates, findChargeDateRule } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const days = (arr) => arr.map(ymd).join(' ');
const at = (y, m, d) => new Date(y, m - 1, d, 14, 30);

// PROD config (Financije_all, S138).
const RATA = {
  trigger_slug: 'rate', count_slug: 'brojrata', amount_slug: 'isplata',
  date_map_slug: 'izvorplacanja', date_map: { Mastercard: 11, Visa: 5 },
  charge_date_slug: 'datum_naplate',
};
const RULES = [{
  action: 'set_attribute', name: 'Datum naplate po Izvoru', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
  date_map: { Racun: 'same', Cash: 'same', Mastercard: 'next:11', Visa: 'cutoff:3:5' },
}];

console.log('');
console.log('Visa (cutoff:3:5) — kupovina 1.–3. vise nije mjesec prekasno:');
ok('02.09. => 05.09., 05.10., 05.11.',
   days(generateRataChargeDates(at(2026, 9, 2), 3, 'Visa', RATA, RULES)) === '2026-09-05 2026-10-05 2026-11-05',
   days(generateRataChargeDates(at(2026, 9, 2), 3, 'Visa', RATA, RULES)));
ok('03.09. (dan granice je jos unutra) => 05.09.',
   ymd(generateRataChargeDates(at(2026, 9, 3), 2, 'Visa', RATA, RULES)[0]) === '2026-09-05');
ok('04.09. => 05.10. (kao prije)',
   ymd(generateRataChargeDates(at(2026, 9, 4), 2, 'Visa', RATA, RULES)[0]) === '2026-10-05');
ok('prijelaz godine: 20.11. x3 => 05.12., 05.01., 05.02.',
   days(generateRataChargeDates(at(2026, 11, 20), 3, 'Visa', RATA, RULES)) === '2026-12-05 2027-01-05 2027-02-05');

console.log('');
console.log('Mastercard (next:11):');
ok('26.09. x3 => 11.10., 11.11., 11.12.',
   days(generateRataChargeDates(at(2026, 9, 26), 3, 'Mastercard', RATA, RULES)) === '2026-10-11 2026-11-11 2026-12-11');
ok('31.01. (overflow) => 11.02.',
   ymd(generateRataChargeDates(at(2027, 1, 31), 1, 'Mastercard', RATA, RULES)[0]) === '2027-02-11');

console.log('');
console.log('Cijela godina protiv starog ponasanja (rata.date_map):');
let mcDiff = 0, visaDiff = [], visaOk = true;
for (let t = new Date(2026, 0, 1); t.getFullYear() === 2026; t.setDate(t.getDate() + 1)) {
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 10);
  const oldMc = days(generateRataChargeDates(d, 6, 'Mastercard', RATA));
  const newMc = days(generateRataChargeDates(d, 6, 'Mastercard', RATA, RULES));
  if (oldMc !== newMc) mcDiff++;
  const oldV = generateRataChargeDates(d, 6, 'Visa', RATA);
  const newV = generateRataChargeDates(d, 6, 'Visa', RATA, RULES);
  if (days(oldV) !== days(newV)) {
    visaDiff.push(d.getDate());
    // Razlika smije biti SAMO „mjesec ranije", i samo za 1.–3.
    const shifted = oldV.map(x => { const y = new Date(x); y.setDate(1); y.setMonth(y.getMonth() - 1); y.setDate(5); return y; });
    if (days(shifted) !== days(newV)) visaOk = false;
  }
}
ok('MC: 0 razlika u 365 dana', mcDiff === 0, `${mcDiff}`);
ok('Visa: razlikuju se samo kupovine 1.–3.', visaDiff.every(x => x <= 3) && visaDiff.length === 36, `${visaDiff.length} dana: ${[...new Set(visaDiff)]}`);
ok('Visa: razlika je tocno jedan mjesec ranije', visaOk);

console.log('');
console.log('Rezerva (rata.date_map) kad pravila nema:');
ok('bez attribute_rules => stari rjecnik (Visa 5, od sljedeceg mjeseca)',
   ymd(generateRataChargeDates(at(2026, 9, 2), 1, 'Visa', RATA)[0]) === '2026-10-05');
ok('vrijednost koju pravilo ne zna => stari rjecnik',
   findChargeDateRule(RATA, RULES, 'Revolut') === null);
ok('pravilo za DRUGI atribut se ne koristi',
   findChargeDateRule(RATA, [{ ...RULES[0], target_slug: 'nesto_drugo' }], 'Visa') === null);
ok('neispravan token u pravilu => rezerva, ne krivi datum',
   findChargeDateRule(RATA, [{ ...RULES[0], date_map: { Visa: 'cutoff:3' } }], 'Visa') === null);
ok('config bez charge_date_slug => rezerva',
   findChargeDateRule({ ...RATA, charge_date_slug: undefined }, RULES, 'Visa') === null);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
