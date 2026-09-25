/**
 * S149 — `hidden_in_add` na Structure uvozu.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   (1) File BEZ kolone `HiddenInAdd` tiho je brisao zastavicu: `hidden_in_add`
 *       zivi unutar `validation_rules`, koji se na UPDATE-u prepisuje u
 *       cijelosti, pa izostanak kolone nije znacio „ne diraj" nego „FALSE".
 *       Pogadja 3 atributa na PROD-u, sva tri u `Financije_all` (S139).
 *   (2) `HiddenInAdd` se citao samo s PRVOG retka atributa, a `IsRequired` (S131)
 *       sa svih — pa je `TRUE` na drugom retku `depends_on` atributa bio tiho
 *       zanemaren.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'structureHidden.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { groupAttributes, resolveHiddenInAdd } from './src/lib/structureImport';",
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
const { groupAttributes, resolveHiddenInAdd } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

console.log('');
console.log('Kolona HiddenInAdd koje NEMA ne dira zastavicu:');
ok('bez kolone, baza ima zastavicu => ostaje TRUE',
   resolveHiddenInAdd(false, false, { type: 'suggest', hidden_in_add: true }) === true);
ok('bez kolone, baza je nema => ostaje FALSE',
   resolveHiddenInAdd(false, false, { type: 'suggest' }) === false);
ok('bez kolone, nov atribut (nema retka u bazi) => FALSE',
   resolveHiddenInAdd(false, false, undefined) === false);
ok('kolona postoji i celija je prazna => FALSE (brisanje zastavice i dalje radi)',
   resolveHiddenInAdd(true, false, { hidden_in_add: true }) === false);
ok('kolona postoji i kaze TRUE => TRUE',
   resolveHiddenInAdd(true, true, {}) === true);

console.log('');
console.log('HiddenInAdd je ZASTAVICA preko svih redaka atributa (kao IsRequired):');
const row = (whenValue, hiddenInAdd) => ({
  rowNum: 10, type: 'Attribute', categoryPath: 'Financije_all > Transakcija', sort: 1,
  attrName: 'Stanje', slug: 'stanje', attrType: 'text', isRequired: false, hiddenInAdd,
  valType: 'suggest', defaultVal: '', valMax: '', unit: '', textOptions: 'a|b',
  dependsOn: 'racun', whenValue, description: '', commentTpl: '',
  disableSavePlus: '', addTimer: '', addDate: '',
});
const [g] = groupAttributes([row('ZABA', false), row('RF', true)]);
ok('TRUE samo na DRUGOM retku => atribut skriven', g.hiddenInAdd === true, `got ${g.hiddenInAdd}`);
const [g2] = groupAttributes([row('ZABA', false), row('RF', false)]);
ok('FALSE na svim retcima => nije skriven', g2.hiddenInAdd === false);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
