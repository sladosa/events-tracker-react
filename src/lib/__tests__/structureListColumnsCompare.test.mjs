/**
 * S153 — `List columns changed (areas)` na uvozu nepromijenjenog filea.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Uvoz je usporedjivao `list_columns.columns` doslovnim `JSON.stringify`, a
 *   JSONB presloži kljuceve unutar svakog objekta (duljina imena, pa abecedno).
 *   Uvoz slaze `{role, label, slugs, ..., map}`, baza vraca `{map, role, label, ...}`
 *   => svaki uvoz Aree s `pair`/`map`/`sep` kolonom javljao je `1` i prepisivao
 *   identican sadrzaj (izmjereno na TEST-u 27.09.2026., T-S152-1).
 *   Dolje je DOSLOVNO ono sto baza vraca za `Financije_all`, i DOSLOVNO ono sto
 *   uvoz iz tog exporta slozi.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'structureListColumnsCompare.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { sameJson } from './src/lib/structureImport';",
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
const { sameJson } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };

// Kako ga vraca JSONB (TEST, 27.09.2026.)
const fromDb = [
  { role: 'date', label: 'Datum', width: 'w-28', mobile: 'line1' },
  { map: { 'Sašin tekući RF': 'RF', 'Kokin tekući ZABA': 'ZABA' }, role: 'attr', label: 'Račun', slugs: ['racun'], width: 'w-32', mobile: 'line1' },
  { plus: 'uplata', role: 'pair', unit: '€', label: 'Iznos', minus: 'isplata', width: 'w-36', mobile: 'line1' },
  { sep: '/', role: 'attr', label: 'Tip/Podtip', slugs: ['tip', 'podtip'], mobile: 'line2' },
  { role: 'comment', label: 'Opis', mobile: 'line2' },
  { role: 'user', mobile: 'line1' },
  { role: 'balance', unit: '€', label: 'Stanje', width: 'w-28', mobile: 'hide' },
  { role: 'actions' },
];
// Kako ga slozi uvoz (redoslijed dodjele u structureImport §10)
const fromImport = [
  { role: 'date', label: 'Datum', mobile: 'line1', width: 'w-28' },
  { role: 'attr', label: 'Račun', slugs: ['racun'], mobile: 'line1', width: 'w-32', map: { 'Sašin tekući RF': 'RF', 'Kokin tekući ZABA': 'ZABA' } },
  { role: 'pair', label: 'Iznos', plus: 'uplata', minus: 'isplata', unit: '€', mobile: 'line1', width: 'w-36' },
  { role: 'attr', label: 'Tip/Podtip', slugs: ['tip', 'podtip'], sep: '/', mobile: 'line2' },
  { role: 'comment', label: 'Opis', mobile: 'line2' },
  { role: 'user', mobile: 'line1' },
  { role: 'balance', label: 'Stanje', unit: '€', mobile: 'hide', width: 'w-28' },
  { role: 'actions' },
];

ok('isti sadrzaj, drugi redoslijed kljuceva => ISTO', sameJson(fromDb, fromImport));
ok('doslovni JSON.stringify ih razlikuje (zato test postoji)',
  JSON.stringify(fromDb) !== JSON.stringify(fromImport));

// Protuprovjere: prava promjena mora ostati vidljiva
const clone = () => JSON.parse(JSON.stringify(fromImport));
let c = clone(); c[2].unit = 'EUR';
ok('promijenjena vrijednost => RAZLIKA', !sameJson(fromDb, c));
c = clone(); [c[0], c[1]] = [c[1], c[0]];
ok('zamijenjen redoslijed KOLONA => RAZLIKA', !sameJson(fromDb, c));
c = clone(); c[3].slugs = ['podtip', 'tip'];
ok('zamijenjen redoslijed slugova => RAZLIKA', !sameJson(fromDb, c));
c = clone(); c.pop();
ok('maknuta kolona => RAZLIKA', !sameJson(fromDb, c));
c = clone(); c[1].map['Novi račun'] = 'NR';
ok('nova kratica u Map => RAZLIKA', !sameJson(fromDb, c));
c = clone(); delete c[0].width;
ok('maknut kljuc => RAZLIKA', !sameJson(fromDb, c));

// add_header: odsutno i undefined su isto
ok('add_header: undefined vs undefined => ISTO', sameJson(undefined, undefined));
ok('add_header: {timer,date} vs {date,timer} => ISTO',
  sameJson({ date: true, timer: false }, { timer: false, date: true }));
ok('add_header: undefined vs {date:true} => RAZLIKA', !sameJson(undefined, { date: true }));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
