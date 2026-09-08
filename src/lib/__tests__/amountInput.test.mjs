/**
 * parseAmountInput + prikaz broja u polju za unos (S131)
 * =====================================================
 * Cuva dvije stvari koje se u pregledniku ne vide dok ne zagrizu:
 *
 *  1. `<input type="number">` je bio zamijenjen tekstualnim poljem jer je
 *     njegov decimalni separator birala LOKALIZACIJA PREGLEDNIKA. Kad bi
 *     preglednik odbio utipkani znak, `e.target.value` je `''` — a stari kod je
 *     to mapirao u `null`, pa je iznos utipkan kao `1389,52` mogao TIHO postati
 *     prazan. Zato ovdje stoje oba oblika, i hrvatski i "keyboard habit".
 *
 *  2. `hr-HR` formatiranje daje minus U+2212 (−), koji `Number()` ne prima.
 *     Bez zamjene bi svaki negativan broj u polju bio prikazan kao neispravan,
 *     a vrijednost zalijepljena iz liste (`formatSigned` isto koristi U+2212)
 *     ne bi se dala unijeti.
 *
 * Pokrece se iz korijena projekta:
 *   node src/lib/__tests__/amountInput.test.mjs
 *
 * ⚠ Uvozi PRAVU funkciju (esbuild transpajlira amountFormat.ts), ne svoju
 *   kopiju — kopija bi s vremenom odlutala od koda koji se isporucuje.
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const src = readFileSync('src/lib/amountFormat.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'amt-'));
const out = join(dir, 'amountFormat.mjs');
writeFileSync(out, code);
const { parseAmountInput, formatSigned } = await import(pathToFileURL(out).href);

/** Ista funkcija koju `AttributeInput.NumberInput` koristi za prikaz. Drzi se
 *  ovdje kao kopija JEDNE linije jer je u .tsx komponenti, a komponenta se ne
 *  da uvesti bez Reacta; test protuprovjere ispod hvata ako se raziđu. */
const toRaw = (n) =>
  n == null ? '' : n.toLocaleString('hr-HR', { useGrouping: false, maximumFractionDigits: 20 }).replace(/−/g, '-');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (Object.is(got, want)) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};

console.log('\nHrvatski unos (ono sto Koka tipka):');
eq('zarez kao decimalni separator', parseAmountInput('1389,52'), 1389.52);
// ⚠ Kljucni slucaj: naivan `parseFloat` bi ovdje vratio 1.234 — dakle broj koji
//   je 1000x manji i posve uvjerljiv. Zato je bas ovaj u testu.
eq('tocka kao tisucice + zarez', parseAmountInput('1.234,56'), 1234.56);
eq('samo zarez, bez cijelog dijela', parseAmountInput('0,7'), 0.7);
eq('zarez na kraju (usred tipkanja)', parseAmountInput('1389,'), 1389);

console.log('\nKeyboard habit (ono sto Sasa tipka):');
eq('tocka kao decimalni separator', parseAmountInput('1234.56'), 1234.56);
eq('zarez kao tisucice + tocka', parseAmountInput('1,234.56'), 1234.56);
eq('cijeli broj', parseAmountInput('450'), 450);

console.log('\nMinus U+2212 (iz liste i iz hr-HR formatiranja):');
eq('U+2212 se cita kao minus', parseAmountInput('−28,79'), -28.79);
eq('obicni minus i dalje radi', parseAmountInput('-28,79'), -28.79);
eq('formatSigned se da procitati natrag', parseAmountInput(formatSigned(-28.79)), -28.79);

console.log('\nSmece se NE pogadja (vraca null ⇒ polje pocrveni):');
eq('slovo u broju', parseAmountInput('12x'), null);
eq('prazno', parseAmountInput('   '), null);
eq('sam minus', parseAmountInput('-'), null);

console.log('\nPrikaz u polju — tocna vrijednost, bez zaokruzivanja i tisucica:');
eq('novac', toRaw(1389.52), '1389,52');
// ⚠ Cijeli broj NE dobiva `,00`: polje za unos je generickо (ponavljanja, km),
//   a zaokruzivanje u prikazu prije ili kasnije zaokruzi i pri spremanju.
eq('cijeli broj ostaje cijel', toRaw(12), '12');
eq('jedna decimala ostaje jedna', toRaw(7.5), '7,5');
eq('tri decimale se NE rezu', toRaw(7.123), '7,123');
eq('bez separatora tisucica', toRaw(1234567.89), '1234567,89');
eq('negativan nosi tipkovni minus', toRaw(-28.79), '-28,79');
eq('null je prazno polje', toRaw(null), '');

console.log('\nRound-trip (Edit otvori redak pa ga spremi nedirnutog):');
for (const n of [1389.52, 12, 7.5, 450, 0.7, -28.79, 7.123, 1234567.89]) {
  eq(`${n} → prikaz → natrag`, parseAmountInput(toRaw(n)), n);
}

console.log(`\n${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
