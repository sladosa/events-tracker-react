/**
 * S152 — jedan graditelj `validation_rules` (BUG-S117-RULESHAPE + dva nalaza).
 *
 * ZASTO OVAJ TEST POSTOJI
 *   (1) Structure uvoz je nakon svakog spremanja panela javljao
 *       „Attributes updated 9" bez promjene: panel i uvoz pisali su isto
 *       pravilo u razlicitom obliku, a usporedba je gledala oblik.
 *   (2) „Other" u Add/Edit gradio je pravilo IZ NULE i brisao `default_map`
 *       (`Status`) i `hidden_in_add` (`Stanje`, `Valuta`).
 *   (3) Rename u panelu sirio je parsirani (camelCase) objekt pa bi ovisni
 *       atribut ostao bez `options_map`.
 *
 * Fixture su DOSLOVNA pravila s PROD-a (`Financije_all`, 26.09.2026.).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'validationRules.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export { buildRules, canonicalRules, sameRules, addOptionToRules, renameDependsOnParent } from './src/lib/validationRules';",
      "export { groupAttributes, buildValidationRules } from './src/lib/structureImport';",
      "export { buildAttrRows } from './src/lib/structureExcel';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000',
      VITE_APP_ENV: 'test',
    }),
  },
});
const {
  buildRules, canonicalRules, sameRules, addOptionToRules, renameDependsOnParent,
  groupAttributes, buildValidationRules, buildAttrRows,
} = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const J = (v) => JSON.stringify(v);

// ── PROD fixture ────────────────────────────────────────────
const STATUS = {
  type: 'suggest',
  depends_on: {
    default_map: { Cash: 'Izvrsen', Visa: 'Planiran', Racun: 'Izvrsen', Mastercard: 'Planiran' },
    options_map: { '*': [], Cash: ['Izvrsen', 'Planiran'], Visa: ['Izvrsen', 'Planiran'],
      Racun: ['Izvrsen', 'Planiran'], Mastercard: ['Izvrsen', 'Planiran'] },
    attribute_slug: 'izvorplacanja',
  },
};
const STANJE = { type: 'suggest', depends_on: { options_map: { '*': [], SKRIVENO: [] }, attribute_slug: 'smjer' }, hidden_in_add: true };
const VALUTA = { type: 'suggest', suggest: ['EUR', 'USD'], hidden_in_add: true };
const IZVOR = { type: 'suggest', depends_on: { options_map: { '*': [], 'Sašin tekući RF': ['Racun', 'Visa', 'Cash'],
  'Kokin tekući ZABA': ['Racun', 'Mastercard', 'Cash'] }, attribute_slug: 'racun' } };

// Oblik koji je panel pisao do S152 za isti atribut.
const panelShape = (r) => ({ ...r, suggest: [], allow_other: true });

console.log('');
console.log('(1) Panelov stari oblik NIJE promjena, prava promjena JEST:');
ok('Status: panel oblik == uvoz oblik', sameRules(panelShape(STATUS), STATUS));
ok('Izvor: panel oblik == uvoz oblik', sameRules(panelShape(IZVOR), IZVOR));
ok('redoslijed kljuceva nebitan', sameRules({ depends_on: STATUS.depends_on, type: 'suggest' }, STATUS));
ok('prazan `*` == nema `*` (izvoz ga dopise sam)',
   sameRules({ type: 'suggest', depends_on: { attribute_slug: 'x', options_map: { a: ['1'] } } },
             { type: 'suggest', depends_on: { attribute_slug: 'x', options_map: { a: ['1'], '*': [] } } }));
ok('`{type:suggest, suggest:[]}` == `{}`', sameRules({ type: 'suggest', suggest: [] }, {}));
ok('izgubljen default_map JEST promjena',
   !sameRules(STATUS, { ...STATUS, depends_on: { ...STATUS.depends_on, default_map: undefined } }));
ok('izgubljen hidden_in_add JEST promjena', !sameRules(STANJE, { ...STANJE, hidden_in_add: undefined }));
ok('nova opcija JEST promjena', !sameRules(VALUTA, { ...VALUTA, suggest: ['EUR', 'USD', 'GBP'] }));
ok('redoslijed opcija JEST promjena (dropdown ga prikazuje)', !sameRules(VALUTA, { ...VALUTA, suggest: ['USD', 'EUR'] }));
ok('neprazan fallback `suggest` uz depends_on JEST promjena',
   !sameRules(STATUS, { ...STATUS, suggest: ['X'] }));
ok('allow_other:false JEST promjena', !sameRules(VALUTA, { ...VALUTA, allow_other: false }));

console.log('');
console.log('(1b) Roundtrip PROD pravila: izvoz -> uvoz => ista pravila:');
const node = { fullPath: 'Financije_all > Transakcija' };
const toParsed = (r, i) => ({
  rowNum: 10 + i, type: 'Attribute', categoryPath: r.categoryPath, sort: r.sort,
  attrName: r.attrName, slug: r.slug, attrType: r.attrType,
  isRequired: r.isRequired === 'TRUE', hiddenInAdd: r.hiddenInAdd === 'TRUE',
  valType: r.valType, defaultVal: r.defaultVal, valMax: r.valMax, unit: r.unit,
  textOptions: r.textOptions, dependsOn: r.dependsOn, whenValue: r.whenValue,
  description: r.description, commentTpl: '', disableSavePlus: '', addTimer: '', addDate: '',
});
for (const [slug, rules] of [['status', STATUS], ['stanje', STANJE], ['valuta', VALUTA], ['izvorplacanja', IZVOR],
                             ['status_panel', panelShape(STATUS)]]) {
  const attr = { id: slug, name: slug, slug, data_type: 'text', sort_order: 1, is_required: false,
    validation_rules: rules, default_value: null, unit: null, description: null };
  const rows = buildAttrRows(node, attr).map(toParsed);
  const [g] = groupAttributes(rows);
  const back = buildValidationRules(g, g.hiddenInAdd);
  ok(`${slug}: nema laznog „updated"`, sameRules(rules, back), `${J(rules)} vs ${J(back)}`);
}

console.log('');
console.log('(2) „Other" mijenja SAMO popis opcija:');
const s2 = addOptionToRules(STATUS, 'Storniran', 'Mastercard');
ok('Status: default_map prezivi', J(s2.depends_on.default_map) === J(STATUS.depends_on.default_map), J(s2));
ok('Status: opcija dodana pod Mastercard',
   J(s2.depends_on.options_map.Mastercard) === J(['Izvrsen', 'Planiran', 'Storniran']));
ok('Status: ostale vrijednosti roditelja netaknute',
   J(s2.depends_on.options_map.Visa) === J(['Izvrsen', 'Planiran']));
ok('Status: fixture nije mutiran', STATUS.depends_on.options_map.Mastercard.length === 2);
const st2 = addOptionToRules(STANJE, 'nesto', 'SKRIVENO');
ok('Stanje: hidden_in_add prezivi', st2.hidden_in_add === true, J(st2));
const v2 = addOptionToRules(VALUTA, 'GBP', null);
ok('Valuta: hidden_in_add prezivi', v2.hidden_in_add === true, J(v2));
ok('Valuta: opcija dodana na kraj', J(v2.suggest) === J(['EUR', 'USD', 'GBP']));
ok('postojeca opcija => null (nema upisa)', addOptionToRules(VALUTA, 'EUR', null) === null);
ok('postojeca opcija pod roditeljem => null', addOptionToRules(STATUS, 'Planiran', 'Visa') === null);
ok('nova vrijednost roditelja => nov kljuc u mapi',
   J(addOptionToRules(STATUS, 'Izvrsen', 'Revolut').depends_on.options_map.Revolut) === J(['Izvrsen']));
ok('prazno pravilo => suggest s jednom opcijom',
   J(addOptionToRules(null, 'A', null)) === J({ type: 'suggest', suggest: ['A'] }));
ok('stari format bez `suggest` => krece od parsiranih opcija',
   J(addOptionToRules({ dropdown: { options: ['a'] } }, 'b', null, ['a']).suggest) === J(['a', 'b']));
ok('rezultat ne nosi allow_other (kanonski oblik)', !('allow_other' in v2));

console.log('');
console.log('(3) Rename roditelja cuva options_map:');
const r3 = renameDependsOnParent(STATUS, 'izvorplacanja', 'izvor');
ok('attribute_slug preusmjeren', r3.depends_on.attribute_slug === 'izvor');
ok('options_map prezivi', J(r3.depends_on.options_map) === J(STATUS.depends_on.options_map));
ok('default_map prezivi', J(r3.depends_on.default_map) === J(STATUS.depends_on.default_map));
ok('nema camelCase kljuceva', !('optionsMap' in r3.depends_on) && !('attributeSlug' in r3.depends_on));
ok('drugi roditelj => null', renameDependsOnParent(STATUS, 'racun', 'x') === null);

console.log('');
console.log('buildRules — kanonski oblik:');
ok('depends_on bez allow_other i bez suggest',
   J(buildRules({ dependsOn: { parentSlug: 'p', optionsMap: { a: ['1'] }, defaultMap: {} } }))
   === J({ type: 'suggest', depends_on: { attribute_slug: 'p', options_map: { a: ['1'] } } }));
ok('prazan default_map se ne pise', !('default_map' in buildRules({ dependsOn: { parentSlug: 'p', optionsMap: {}, defaultMap: {} } }).depends_on));
ok('hidden_in_add na praznom pravilu', J(buildRules({ hiddenInAdd: true })) === J({ hidden_in_add: true }));
ok('suggest bez opcija => {}', J(buildRules({ options: [] })) === J({}));
ok('max prezivi', buildRules({ options: ['a'], max: 5 }).max === 5);
ok('canonical ne mutira ulaz', (() => { const x = panelShape(STATUS); canonicalRules(x); return x.allow_other === true; })());

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
