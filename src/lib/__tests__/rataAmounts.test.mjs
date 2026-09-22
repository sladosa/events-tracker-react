/**
 * rataAmounts.test.mjs — zbroj rata mora dati ukupan iznos (S145)
 *
 * ZASTO POSTOJI
 *   `detectRata` je svakoj rati davao isti `Math.round((total/count)*100)/100`,
 *   pa je zbroj bio MANJI od ukupnog kad dijeljenje nije tocno. Izmjereno na
 *   PROD-u 22.09.2026. na planu koji je Koka unijela istog dana:
 *
 *       117,32 / 6  ->  6 x 19,55  =  117,30     manjak 0,02
 *
 *   a komentar svakog retka je i dalje pisao `19.55 od 117.32`, dakle redak je
 *   sam sebi proturjecio.
 *
 * /!\ ZASTO TO NIJE KOZMETIKA
 *   Saldo ne otkriva nista (karticni retci ga ne micu). Kvar ispliva tek kad
 *   stigne izvod: kontrola kosare (Sigma == iznos terecenja) ne zatvori se, a
 *   razlika od dvije lipe ondje izgleda kao greska u SPARIVANJU, ne u unosu.
 *
 * /!\ ZASTO PRVA RATA, A NE ZADNJA
 *   Tako to radi banka: od 62 plana s >=3 rate, njih 23 ima prvu ratu razlicitu
 *   od ostalih (`rate_alat.py`). Poklapamo se s izvorom umjesto da od njega
 *   odstupamo.
 *
 * /!\ Test se cita kao dokaz samo ako moze pasti. Zato nosi i PROTUPROVJERU:
 *     stara implementacija (isti iznos svakoj rati) je ovdje izvedena i mora
 *     pasti na istim ulazima na kojima nova prolazi.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'rataAutomation.ts'), 'utf8');

// Izvuci cistu funkciju iz TS-a (bez tipova, bez buildanja) — isti postupak
// kao `dateRuleCutoff.test.mjs`.
function extract(name) {
  const i = src.indexOf(`export function ${name}`);
  assert.ok(i > 0, `nema ${name}`);
  let depth = 0, j = src.indexOf('{', i);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) break;
  }
  return src.slice(start, j + 1);
}

const strip = s => s
  .replace(/const out: number\[\] = \[\]/g, 'const out = []')
  .replace(/: (?:string|Date|number|boolean)(?:\[\])?(?: \| null)?/g, '');

const splitRataAmounts = new Function('total', 'count',
  strip(extract('splitRataAmounts')).slice(1, -1));

// Ono sto je kod radio PRIJE popravka — sluzi samo protuprovjeri.
const stari = (total, count) => {
  const per = Math.round((total / count) * 100) / 100;
  return Array.from({ length: count }, () => per);
};

const cents = xs => xs.reduce((a, b) => a + Math.round(b * 100), 0);

let pass = 0, fail = 0;
function check(label, got, want) {
  try { assert.deepEqual(got, want); pass++; }
  catch {
    fail++;
    console.error(`  FAIL  ${label}`);
    console.error(`        dobio ${JSON.stringify(got)}, ocekivano ${JSON.stringify(want)}`);
  }
}

console.log('--- zbroj je TOCNO ukupan iznos ---');
for (const [total, count] of [[117.32, 6], [100, 3], [10, 3], [0.05, 2],
                              [1234.56, 7], [25.51, 1], [-117.32, 6], [-10, 3]]) {
  check(`${total} / ${count} -> zbroj`, cents(splitRataAmounts(total, count)),
        Math.round(total * 100));
}

console.log('--- Kokin stvarni plan: 117,32 / 6 ---');
check('iznosi', splitRataAmounts(117.32, 6),
      [19.57, 19.55, 19.55, 19.55, 19.55, 19.55]);

console.log('--- ostatak nosi PRVA rata, ostale su jednake ---');
const a = splitRataAmounts(100, 3);
check('100 / 3', a, [33.34, 33.33, 33.33]);
check('ostale su medusobno jednake', new Set(a.slice(1)).size, 1);

console.log('--- dijeljenje bez ostatka ne mijenja nista ---');
check('300 / 3', splitRataAmounts(300, 3), [100, 100, 100]);
check('117,30 / 6', splitRataAmounts(117.30, 6),
      [19.55, 19.55, 19.55, 19.55, 19.55, 19.55]);

console.log('--- negativan iznos (povrat) zadrzava predznak ---');
check('-10 / 3', splitRataAmounts(-10, 3), [-3.34, -3.33, -3.33]);

console.log('--- rubovi ---');
check('count = 1', splitRataAmounts(25.51, 1), [25.51]);
check('count = 0', splitRataAmounts(10, 0), []);
check('count nije cijeli broj', splitRataAmounts(10, 2.5), []);
check('total nije broj', splitRataAmounts(NaN, 3), []);

console.log('--- PROTUPROVJERA: stara implementacija mora pasti ---');
// Ako ovo ikad prestane biti istina, test vise ne mjeri ono zbog cega postoji.
check('stari 117,32 / 6 gubi 2 lipe', cents(stari(117.32, 6)) !== Math.round(117.32 * 100), true);
check('stari 100 / 3 gubi lipu', cents(stari(100, 3)) !== 10000, true);
check('novi 117,32 / 6 ne gubi nista', cents(splitRataAmounts(117.32, 6)), 11732);

console.log();
if (fail > 0) {
  console.error(`${String.fromCharCode(10060)} ${fail} palo, ${pass} proslo`);
  process.exit(1);
}
console.log(`${String.fromCharCode(9989)} svih ${pass} proslo`);
