/**
 * S175 / F5 — sheet `AreaSettings` (retci ključ-putanja) u Structure Excelu.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   `dashboard`, `groupings` i `export_profiles` su do S175 živjeli samo u bazi.
 *   Sheet ih nosi kao retke `Putanja | Tip | Vrijednost`; ako rastavljanje i
 *   sastavljanje nisu točno inverzni, svaki uvoz nepromijenjenog filea tiho
 *   prepiše config Aree (ili ga osakati). Fixture je STVARNI config svih Area
 *   s PROD-a (snimka 18.10.2026., ~325 vrijednosti za Financije_all).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'areaSettingsSheet.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/areaSettingsSheet'; export { sameJson } from './src/lib/structureImport';",
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
const M = await import(pathToFileURL(out).href);
const { flattenAreaSettings, unflattenAreaSettings, mergeAreaSettings, parsePath, cellToValue, changedTopKeys, sameJson } = M;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'src/lib/__tests__/fixtures/areaSettings_prod_2026-10-18.json'), 'utf-8'));

/** Kako uvoz vidi redak: Tip iz kolone, vrijednost kako bi je exceljs vratio. */
const asSheet = rows => rows.map((r, i) => ({ rowNum: i + 2, path: r.path, type: r.type, raw: r.value }));

// 1. Roundtrip nad stvarnim configom svake Aree
for (const [area, settings] of Object.entries(fixture)) {
  const rows = flattenAreaSettings(settings, area);
  const back = unflattenAreaSettings(asSheet(rows), area);
  ok(`${area}: ${rows.length} redaka, 0 grešaka`, back.errors.length === 0);
  ok(`${area}: rastavi → sastavi = isto`, sameJson(back.settings, settings));
}
const fa = fixture['Financije_all'];
const faRows = flattenAreaSettings(fa, 'Financije_all');
ok('Financije_all nosi dashboard, groupings, export_profiles', ['dashboard', 'groupings', 'export_profiles']
  .every(k => faRows.some(r => r.path.startsWith(k))));

// 2. F5-5: ime Aree u ključu profila ide kao {Area} i vraća se imenom iz kolone A
const prof = faRows.filter(r => typeof r.value === 'string' && r.value.startsWith('attr:'));
ok('profil: nijedan ključ ne nosi „Financije_all"', prof.length > 0 && prof.every(r => r.value.startsWith('attr:{Area}||')));
const copied = unflattenAreaSettings(asSheet(faRows), 'Kopija').settings;
ok('profil u drugoj Arei: attr:Kopija||Transakcija||…',
  JSON.stringify(copied.export_profiles).includes('"attr:Kopija||Transakcija||Racun"')
  && !JSON.stringify(copied.export_profiles).includes('Financije_all'));

// 3. F5-1: ključevi drugih sheetova NE idu u ovaj
const mixed = { ...fa, automations: { rata: { x: 1 } }, list_columns: { columns: [] }, comment_template: 'T', default_period: 'this-year' };
const mixedRows = flattenAreaSettings(mixed, 'A');
ok('automations/list_columns/comment_template/default_period nisu u sheetu',
  !mixedRows.some(r => /^(automations|list_columns|comment_template|default_period)\b/.test(r.path)));
ok('budući ključ ide sam od sebe', flattenAreaSettings({ novi_kljuc: { a: 1 } }, 'A').some(r => r.path === 'novi_kljuc.a'));

// 4. F5-2: merge čuva tuđe ključeve, ostalo točno iz sheeta (obrisan = obrisan)
const merged = mergeAreaSettings(mixed, { dashboard: fa.dashboard });
ok('merge: automations/list_columns/… ostaju', merged.automations && merged.list_columns && merged.comment_template === 'T');
ok('merge: groupings i export_profiles kojih nema u sheetu su obrisani', !('groupings' in merged) && !('export_profiles' in merged));
ok('changedTopKeys = [export_profiles, groupings]', JSON.stringify(changedTopKeys(mixed, merged, sameJson)) === '["export_profiles","groupings"]');
ok('changedTopKeys nepromijenjenog = []', changedTopKeys(fa, unflattenAreaSettings(asSheet(faRows), 'Financije_all').settings, sameJson).length === 0);

// 5. F5-4: obrisan redak usred niza ne traži prenumeriranje
const gappy = unflattenAreaSettings([
  { rowNum: 2, path: 'd.w[0].t', type: 'text', raw: 'a' },
  { rowNum: 3, path: 'd.w[2].t', type: 'text', raw: 'c' },
  { rowNum: 4, path: 'd.w[7].t', type: 'text', raw: 'h' },
], 'A');
ok('rupe u nizu se zatvaraju, redoslijed po indeksu', JSON.stringify(gappy.settings) === '{"d":{"w":[{"t":"a"},{"t":"c"},{"t":"h"}]}}');
const unordered = unflattenAreaSettings([
  { rowNum: 2, path: 'w[1]', type: 'number', raw: 2 },
  { rowNum: 3, path: 'w[0]', type: 'number', raw: 1 },
], 'A');
ok('niz složen po indeksu, ne po redu u sheetu', JSON.stringify(unordered.settings) === '{"w":[1,2]}');

// 6. Tip: Excel ne čuva namjeru
ok('text "05" ostaje tekst', cellToValue(5, 'text').value === '5' && cellToValue('05', 'text').value === '05');
ok('number iz teksta s zarezom', cellToValue('3,5', 'number').value === 3.5);
ok('bool iz exceljs boolean i iz teksta', cellToValue(true, 'bool').value === true && cellToValue('FALSE', 'bool').value === false);
ok('kriv broj = greška, ne nula', 'error' in cellToValue('abc', 'number'));
ok('nepoznat Tip = greška', 'error' in cellToValue('x', 'string'));
ok('prazan Tip: broj ⇒ broj, tekst ⇒ tekst, prazno ⇒ null',
  cellToValue(7, '').value === 7 && cellToValue('x', '').value === 'x' && cellToValue('', '').value === null);
const empties = flattenAreaSettings({ a: [], b: {}, c: null, d: { e: [] } }, 'A');
ok('prazni [] / {} / null preživljavaju', sameJson(unflattenAreaSettings(asSheet(empties), 'A').settings, { a: [], b: {}, c: null, d: { e: [] } }));

// 7. Ključevi s posebnim znakovima
const odd = { groupings: { 'a.b': { 'x[1]': 1, ' rub ': 2, 'navod"': 3 } } };
const oddRows = flattenAreaSettings(odd, 'A');
ok('ključ s točkom ide u ["…"]', oddRows.some(r => r.path === 'groupings["a.b"]["x[1]"]'));
ok('posebni ključevi: roundtrip', sameJson(unflattenAreaSettings(asSheet(oddRows), 'A').settings, odd));
ok('parsePath: a.b[0]["c.d"]', JSON.stringify(parsePath('a.b[0]["c.d"]')) ===
  '[{"kind":"key","key":"a"},{"kind":"key","key":"b"},{"kind":"index","index":0},{"kind":"key","key":"c.d"}]');

// 8. Neispravni retci se JAVLJAJU, ne gutaju
const badRes = unflattenAreaSettings([
  { rowNum: 2, path: 'a..b', type: 'text', raw: 'x' },
  { rowNum: 3, path: 'a[x]', type: 'text', raw: 'x' },
  { rowNum: 4, path: 'k.v', type: 'text', raw: 'x' },
  { rowNum: 5, path: 'k.v', type: 'text', raw: 'y' },
  { rowNum: 6, path: 'k.v.z', type: 'text', raw: 'z' },
  { rowNum: 7, path: 'n', type: 'number', raw: 'abc' },
  { rowNum: 8, path: 'ok', type: 'text', raw: 'da' },
], 'A');
ok('5 neispravnih redaka ⇒ 5 poruka s brojem retka', badRes.errors.length === 5 && badRes.errors.every(e => /^red \d+/.test(e)));
ok('ispravan redak uz neispravne i dalje stiže', badRes.settings.ok === 'da' && badRes.settings.k.v === 'x');

console.log(`\nareaSettingsSheet: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
