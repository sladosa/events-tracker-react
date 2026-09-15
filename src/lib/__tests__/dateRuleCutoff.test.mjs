/**
 * dateRuleCutoff.test.mjs — `cutoff:B:D` u `evaluateDateRule` (S137)
 *
 * ZASTO POSTOJI
 *   Kartica ima TRI datuma: zatvaranje izvoda (B), terecenje racuna (D),
 *   dospijece. `Datum naplate` znaci TERECENJE. Za Visu se ta tri razilaze
 *   (2.-3. / 4.-7. / 11.), pa nijedan `next:N` ne moze biti tocan:
 *
 *     transakcija   pripada izvodu   tereti se   next:3    next:5
 *     20.05.        zatvara 03.06.   ~05.06.     03.07. X  05.06. OK
 *     04.06.        zatvara 02.07.   ~05.07.     03.07. OK 05.06. X  (mjesec!)
 *
 *   `next:3` pogadja MJESEC ali promasuje DAN; `next:5` obrnuto.
 *   `cutoff:3:5` pogadja oboje.
 *
 * /!\ Test se cita kao dokaz samo ako moze pasti. Zato nosi i granicne dane
 *     (2., 3., 4.) oko B -- s naivnom implementacijom (`>=` umjesto `>`, ili
 *     bez koraka 2) barem jedan od njih ispadne u krivi mjesec.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'attributeRules.ts'), 'utf8');

// Izvuci dvije ciste funkcije iz TS-a (bez tipova, bez buildanja).
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

const prelude = `
  const RE_NEXT = /^next:(\\d{1,2})$/;
  const RE_CUTOFF = /^cutoff:(\\d{1,2}):(\\d{1,2})$/;
  const inMonth = (n) => n >= 1 && n <= 31;
`;
const strip = s => s.replace(/: (?:string|Date|number|boolean)(?: \| null)?/g, '');
const evaluateDateRule = new Function('rule', 'base',
  prelude + strip(extract('evaluateDateRule')).slice(1, -1));
const isValidDateRule = new Function('rule',
  prelude + strip(extract('isValidDateRule')).slice(1, -1));

const d = (y, m, day) => new Date(y, m - 1, day, 12, 0, 0, 0);
const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

let pass = 0, fail = 0;
function check(label, got, want) {
  try { assert.equal(got, want); pass++; }
  catch { fail++; console.error(`  FAIL  ${label}\n        dobio ${got}, ocekivano ${want}`); }
}

console.log('--- rjecnik prima novi oblik, a stari ostaje valjan ---');
for (const [r, ok] of [['same', true], ['next:11', true], ['cutoff:3:5', true],
                       ['cutoff:25:5', true], ['cutoff:0:5', false], ['cutoff:3:32', false],
                       ['cutoff:3', false], ['cutoff', false], ['sljedeci:3', false]]) {
  check(`isValid("${r}")`, isValidDateRule(r), ok);
}

console.log('--- Visa: cutoff:3:5 (zatvara 3., tereti 5.) ---');
// prije granice -> naplata JOS OVAJ mjesec
check('02.06. -> 05.06.', fmt(evaluateDateRule('cutoff:3:5', d(2026, 6, 2))), '2026-06-05');
// NA granicu -> izvod se tog dana jos zatvara, dakle isti ciklus
check('03.06. -> 05.06.', fmt(evaluateDateRule('cutoff:3:5', d(2026, 6, 3))), '2026-06-05');
// dan poslije granice -> tek SLJEDECI ciklus  <-- ovo `next:5` promasuje
check('04.06. -> 05.07.', fmt(evaluateDateRule('cutoff:3:5', d(2026, 6, 4))), '2026-07-05');
check('20.05. -> 05.06.', fmt(evaluateDateRule('cutoff:3:5', d(2026, 5, 20))), '2026-06-05');
check('31.12. -> 05.01.', fmt(evaluateDateRule('cutoff:3:5', d(2026, 12, 31))), '2027-01-05');

console.log('--- kartica koja se zatvara KASNO a tereti RANO (B=25, D=5) ---');
// /!\ Bez koraka 2 naplata bi ispala PRIJE zatvaranja izvoda.
check('10.06. -> 05.07.', fmt(evaluateDateRule('cutoff:25:5', d(2026, 6, 10))), '2026-07-05');
check('26.06. -> 05.08.', fmt(evaluateDateRule('cutoff:25:5', d(2026, 6, 26))), '2026-08-05');

console.log('--- stari oblici se NISU promijenili ---');
check('next:11 od 29.08. -> 11.09.', fmt(evaluateDateRule('next:11', d(2026, 8, 29))), '2026-09-11');
check('next:11 od 31.01. -> 11.02.', fmt(evaluateDateRule('next:11', d(2026, 1, 31))), '2026-02-11');
check('same od 15.09.   -> 15.09.', fmt(evaluateDateRule('same', d(2026, 9, 15))), '2026-09-15');
check('nepoznato -> null', evaluateDateRule('bezveze', d(2026, 9, 15)), null);

console.log(`\n${pass} proslo, ${fail} palo`);
process.exit(fail ? 1 : 0);
