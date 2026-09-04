/**
 * collectRuleManagedIds tests
 * ===========================
 * Cuva BUG-S127-PRESETFREEZE: snimka shortcuta je spremala IZVEDENU vrijednost
 * kao doslovnu, pa je `set_attribute` pravilo poslije vidjelo popunjen target i
 * preskocilo ga kao rucni unos (`userOwned`).
 *
 * Izmjereno na PROD-u 04.09.2026.: Kokin preset `Isplata` (spremljen 02.09. uz
 * `Izvor = Mastercard`, `next:11`) nosio je `datum_naplate = 2026-10-11T12:00`.
 * Preset se bira SAM cim se poklopi kategorija (`usage_count` je i dalje bio 0),
 * pa je svaki unos u Transakciju kretao s listopadskim datumom naplate — i
 * `Izvor = Racun`, koji trazi isti dan, nije ga mogao ispraviti ni javiti.
 *
 * Pokrece se iz korijena projekta:
 *   node src/lib/__tests__/ruleManagedAttrs.test.mjs
 *
 * ⚠ Test uvozi PRAVU funkciju (esbuild transpajlira attributeRules.ts u temp
 *   .mjs), ne svoju kopiju — inace bi kopija s vremenom odlutala od koda.
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const src = readFileSync('src/lib/attributeRules.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'rmattr-'));
const out = join(dir, 'attributeRules.mjs');
writeFileSync(out, code);
const { collectRuleManagedIds, computeSetAttributeValue, findDefBySlug } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

// --- Stvarna konfiguracija Aree `Financije_all` s PROD-a (04.09.2026.) -------
const def = (id, slug, validation_rules = {}) => ({ id, slug, validation_rules });

const IZVOR = def('id-izvor', 'izvorplacanja', {
  type: 'suggest',
  depends_on: {
    attribute_slug: 'racun',
    options_map: { '*': [], 'Sašin tekući RF': ['Racun', 'Visa', 'Cash'] },
  },
});
const DATUM_NAPLATE = def('id-datum', 'datum_naplate', {});
const STATUS = def('id-status', 'status', {
  type: 'suggest',
  depends_on: {
    attribute_slug: 'izvorplacanja',
    default_map: { Cash: 'Izvrsen', Visa: 'Planiran', Racun: 'Izvrsen', Mastercard: 'Planiran' },
    options_map: { '*': [], Racun: ['Izvrsen', 'Planiran'] },
  },
});
const RACUN = def('id-racun', 'racun', { type: 'suggest', suggest: ['Kokin tekući ZABA'] });
const TIP = def('id-tip', 'tip', { type: 'suggest', suggest: ['Domaćinstvo'] });

const DEFS = [RACUN, IZVOR, DATUM_NAPLATE, STATUS, TIP];
const AUTOMATIONS = {
  rata: { date_map: { Visa: 3, Mastercard: 11 }, charge_date_slug: 'datum_naplate' },
  attribute_rules: [{
    name: 'Datum naplate po Izvoru',
    action: 'set_attribute',
    target_slug: 'datum_naplate',
    map_slug: 'izvorplacanja',
    date_map: { Cash: 'same', Visa: 'next:3', Racun: 'same', Mastercard: 'next:11' },
  }],
};

// Isti citac kao u aplikaciji (`parseValidationRules(...).dependsOn?.defaultMap`).
const getDefaultMap = d => d.validation_rules?.depends_on?.default_map;

const prod = collectRuleManagedIds(DEFS, AUTOMATIONS, getDefaultMap);

console.log('\n1. PROD konfiguracija — sto je izvedeno');
check('`datum_naplate` je `computed` (target set_attribute pravila)',
  prod.computed.has('id-datum') && prod.computed.size === 1);
check('`status` je `mapped` (ima default_map)',
  prod.mapped.has('id-status') && prod.mapped.size === 1);
check('`izvorplacanja` NIJE izvedeno — depends_on bez default_map je samo popis opcija',
  !prod.all.has('id-izvor'));
check('`racun` i `tip` su korisnikov unos', !prod.all.has('id-racun') && !prod.all.has('id-tip'));
check('`all` je unija', prod.all.size === 2);

console.log('\n2. Snimka shortcuta izostavlja upravo ta dva');
// Ono sto je forma imala u trenutku spremanja preseta `Isplata`.
const touched = {
  'id-racun': 'Kokin tekući ZABA',
  'id-tip': 'Domaćinstvo',
  'id-datum': '2026-10-11T12:00',   // izvedeno iz Mastercarda — NE smije u snimku
  'id-status': 'Planiran',          // izvedeno iz Izvora — NE smije u snimku
};
const snapshot = Object.fromEntries(
  Object.entries(touched).filter(([id]) => !prod.all.has(id)),
);
check('listopadski `datum_naplate` ne ulazi u shortcut', !('id-datum' in snapshot),
  JSON.stringify(snapshot));
check('`status` ne ulazi u shortcut', !('id-status' in snapshot));
check('korisnikov izbor ostaje', snapshot['id-racun'] === 'Kokin tekući ZABA' && snapshot['id-tip'] === 'Domaćinstvo');

console.log('\n3. Rubni slucajevi');
check('bez automations nema `computed`',
  collectRuleManagedIds(DEFS, undefined, getDefaultMap).computed.size === 0);
check('prazan default_map NIJE mapa — nista ne izvodi',
  !collectRuleManagedIds(
    [def('x', 'x', { type: 'suggest', depends_on: { attribute_slug: 'y', default_map: {}, options_map: {} } })],
    undefined, getDefaultMap,
  ).all.has('x'));
check('target koji u Arei ne postoji se preskace bez pada',
  collectRuleManagedIds([RACUN], AUTOMATIONS, getDefaultMap).all.size === 0);
// S118: PROD trigger je slugove pisao s crticom, app ih pise s podvlakom.
check('slug se pogadja i kad se crtica i podvlaka raziđu (S118)',
  collectRuleManagedIds([def('id-d2', 'datum-naplate')], AUTOMATIONS, getDefaultMap).computed.has('id-d2'));
check('atribut koji je i target i ima default_map broji se kao `computed`, ne dvaput',
  (() => {
    const both = collectRuleManagedIds(
      [def('id-datum', 'datum_naplate', { type: 'suggest', depends_on: { attribute_slug: 'izvorplacanja', default_map: { Racun: 'x' }, options_map: {} } })],
      AUTOMATIONS, getDefaultMap);
    return both.computed.has('id-datum') && !both.mapped.has('id-datum') && both.all.size === 1;
  })());

// ---------------------------------------------------------------------------
// 4. Jezgra koju od S127 koriste DVA toka (Add efekt + Edit change handler).
//    Dok je citao samo Add, greska u njoj bila je jedna greska; sada su dvije.
// ---------------------------------------------------------------------------
console.log('');
console.log('4. Evaluacija pravila — ista za Add i Edit');
const RULE = AUTOMATIONS.attribute_rules[0];
const BASE = new Date(2026, 8, 4, 10, 7); // 04.09.2026. 10:07, lokalno

const ev = v => computeSetAttributeValue(RULE, v, BASE);
check('Racun ⇒ isti dan', ev('Racun') === '2026-09-04T12:00', String(ev('Racun')));
check('Cash ⇒ isti dan', ev('Cash') === '2026-09-04T12:00', String(ev('Cash')));
check('Mastercard ⇒ 11. sljedeceg mjeseca', ev('Mastercard') === '2026-10-11T12:00', String(ev('Mastercard')));
check('Visa ⇒ 3. sljedeceg mjeseca', ev('Visa') === '2026-10-03T12:00', String(ev('Visa')));
// ⚠ `null` znaci „ne diraj target", NE „isprazni ga": prazniti bi brisalo datum
//    koji je mozda dosao s izvoda (Visa nema fiksan dan naplate — 855 redaka).
check('prazan Izvor ⇒ null (ne diraj target)', ev('') === null && ev(null) === null);
check('nepoznata vrijednost ⇒ null', ev('PayPal') === null);
// Prijelaz godine — `next:11` iz prosinca mora dati SIJECANJ iduce godine.
check('prosinac + next:11 ⇒ sijecanj iduce godine',
  computeSetAttributeValue(RULE, 'Mastercard', new Date(2026, 11, 28)) === '2027-01-11T12:00',
  String(computeSetAttributeValue(RULE, 'Mastercard', new Date(2026, 11, 28))));
// Edit handler bira pravilo tako da usporedi promijenjeni atribut s `map_slug`.
check('map_slug pogadja `izvorplacanja`, ne `racun`',
  findDefBySlug(DEFS, RULE.map_slug).id === 'id-izvor');
check('target_slug pogadja `datum_naplate`',
  findDefBySlug(DEFS, RULE.target_slug).id === 'id-datum');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
