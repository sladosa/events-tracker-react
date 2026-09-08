/**
 * missingRequired + requiredMessage (S131)
 * =======================================
 * `is_required` je do S131 bio MRTAV: postojala je kolona u Structure Excelu,
 * crvena zvjezdica u formi i polje u bazi — a nitko ga nije provjeravao ni
 * upisivao na UPDATE putu. Koka je zbog toga spremila redak bez `Izvor`a, pa
 * saldo racuna nije pomaknut, i to bez ijedne poruke.
 *
 * Ovo cuva pravilo koje sada odlucuje smije li se forma spremiti. Zivi na tri
 * mjesta (Add `Save +`, Add Finish, Edit Save), pa je izdvojeno u jednu
 * funkciju — svaka kopija uvjeta je prilika da se raziđe (razred `canUpdateExisting`, S125).
 *
 * Pokrece se iz korijena projekta:
 *   node src/lib/__tests__/requiredAttributes.test.mjs
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const src = readFileSync('src/lib/requiredAttributes.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'req-'));
const out = join(dir, 'requiredAttributes.mjs');
// Jedini uvoz je `import type` — esbuild ga brise, pa nema sto ostati.
writeFileSync(out, code.replace(/^import[^;]*;$/gm, ''));
const { missingRequired, requiredMessage, hasAttributeValue } =
  await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
};

/** Stvarni oblik s PROD-a: `Racun` (sort 1) je roditelj, `Izvor` (sort 2) ovisi o njemu. */
const defs = [
  { id: 'izvor', name: 'Izvor', is_required: true,  sort_order: 2 },
  { id: 'racun', name: 'Racun', is_required: true,  sort_order: 1 },
  { id: 'tip',   name: 'Tip',   is_required: false, sort_order: 3 },
];
const from = (obj) => (id) => obj[id];

console.log('\nSto se broji kao ispunjeno:');
eq('null je prazno', hasAttributeValue(null), false);
eq('undefined je prazno', hasAttributeValue(undefined), false);
eq('prazan string je prazno', hasAttributeValue(''), false);
eq('sami razmaci su prazno', hasAttributeValue('   '), false);
// ⚠ Oba slucaja su falsy u JS-u, pa bi naivan `if (value)` oba proglasio
//   praznima. Za obavezan boolean to znaci da se forma da spremiti SAMO s
//   "da"; za obavezan broj da se 0 ne bi mogla upisati.
eq('false je ODGOVOR, ne izostanak', hasAttributeValue(false), true);
eq('nula je ODGOVOR, ne izostanak', hasAttributeValue(0), true);
eq('tekst je ispunjen', hasAttributeValue('Racun'), true);

console.log('\nKoja polja nedostaju:');
eq('sve prazno ⇒ oba obavezna, redoslijedom FORME (Racun prije Izvora)',
   missingRequired(defs, from({})), ['Racun', 'Izvor']);
eq('roditelj ispunjen ⇒ ostaje dijete',
   missingRequired(defs, from({ racun: 'Kokin tekući ZABA' })), ['Izvor']);
eq('oba ispunjena ⇒ nista ne nedostaje',
   missingRequired(defs, from({ racun: 'Kokin tekući ZABA', izvor: 'Racun' })), []);
eq('neobavezno polje se ne trazi ni kad je prazno',
   missingRequired(defs, from({ racun: 'x', izvor: 'y', tip: '' })), []);
eq('nijedan atribut nije obavezan ⇒ prazno (stanje prije S131)',
   missingRequired(defs.map(d => ({ ...d, is_required: false })), from({})), []);
eq('prazan popis atributa', missingRequired([], from({})), []);

console.log('\nPoruka imenuje polje:');
eq('jedno polje', requiredMessage(['Izvor']), 'Polje "Izvor" je obavezno.');
eq('vise polja', requiredMessage(['Racun', 'Izvor']), 'Obavezna polja: Racun, Izvor.');
eq('s oznakom dogadjaja (Edit, vise tabova)',
   requiredMessage(['Izvor'], 'Event #2'), 'Polje "Izvor" je obavezno (Event #2).');
eq('nista ne nedostaje ⇒ prazna poruka', requiredMessage([]), '');

// ⚠ Zakljucava odluku, ne samo tekst: obavezno polje se od S131 NIKAD ne skriva
//   (`AttributeChainForm.isHiddenExplicitly` vraca false za `is_required`), pa
//   bi uputa na "Show all" slala korisnika da trazi ondje gdje nema sto naci.
//   Vrati li netko skrivanje, ovaj test ostaje zelen a poruka postaje laz —
//   zato uz njega ide i T-S131-18, koji to mjeri u formi.
eq('poruka NE upucuje na "Show all"',
   requiredMessage(['Racun', 'Izvor']).includes('Show all'), false);

console.log(`\n${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
