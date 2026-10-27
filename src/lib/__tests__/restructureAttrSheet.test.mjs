/**
 * S186 / F2 — sheet `Restructure attributes` (`src/lib/restructure/attrSheet.ts`, PREUREDJIVANJE_SPEC §28).
 *
 * STO CUVA
 *   - stupci po NASLOVU (redoslijed i dijakritika nisu bitni), nepoznat stupac je greška;
 *   - `promijeni tip` / `spoji u` i njihova obavezna / zabranjena polja;
 *   - mapa u `Pretvorba` s DIARY ključem `:-|` (794 dana) — goli `|` je dio vrijednosti,
 *     parovi se odvajaju s „ | "; nerazdvojen par je GREŠKA, ne tiho čudan ključ;
 *   - korak iz sheeta ide u PRAVI planer (`planRetype`) i daje predviđanje;
 *   - Structure export nosi prazan predložak (i atribute roditeljske razine), uvoz ga
 *     čita kao prazan, a F1 sheet `Preuređivanje` se s njim ne brka.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'restructureAttrSheet.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/restructure/attrSheet'; export { planRetype } from './src/lib/restructure/retype';"
      + " export { findRestructureSheet, RESTRUCTURE_SHEET } from './src/lib/restructure/sheet';"
      + " export { addStructureSheetsTo } from './src/lib/structureExcel';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000', VITE_APP_ENV: 'test',
    }),
  },
});
const M = await import(pathToFileURL(out).href);
const { parseConv, parseAttrRows, readAttrSheet, attrHeader, toRetypeInput, planRetype,
  addStructureSheetsTo, ATTR_SHEET, findRestructureSheet, RESTRUCTURE_SHEET } = M;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const MOOD = ':-( = 1 | :-/ = 2 | :-| = 3 | :-) = 4 | :-D = 5';

console.log('\n── Pretvorba ──');
ok('number (interno broj)', eq(parseConv('number'), { conv: { kind: 'broj' } }));
ok('mm:ss (veličina slova nije bitna)', eq(parseConv(' MM:SS '), { conv: { kind: 'mm:ss' } }));
ok('mapa s :-| — pet ključeva, ništa se ne raspada',
  eq(parseConv(MOOD), { conv: { kind: 'mapa', map: { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 } } }));
ok('broj u mapi s decimalnim zarezom', eq(parseConv('slab = 1,5 | jak = 3'), { conv: { kind: 'mapa', map: { slab: 1.5, jak: 3 } } }));
ok('par bez razmaka iza | ⇒ greška (ne tiho čudan ključ)', 'error' in parseConv(':-( = 1 |:-/ = 2'));
ok('par bez razmaka ispred | ⇒ greška', 'error' in parseConv(':-( = 1| :-/ = 2'));
ok('vrijednost nije broj ⇒ greška', 'error' in parseConv(':-( = loše | :-) = 4'));
ok('ista vrijednost dvaput ⇒ greška', 'error' in parseConv(':-) = 4 | :-) = 5'));
ok('nepoznata pretvorba ⇒ greška', 'error' in parseConv('decimal'));

console.log('\n── Retci ──');
const H = attrHeader();
const row = (rowNum, o) => ({ rowNum, cells: H.map(h => o[h] ?? null) });
{
  const p = parseAttrRows(H, [
    row(2, { Step: 2, Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'total_ascent', 'Delete source': 'yes' }),
    row(3, { Step: 1, Operation: 'change type', Category: 'Activity', Attribute: 'mood', 'New type': 'number', Conversion: MOOD, Note: 'P2' }),
    row(4, {}),
    row(5, { Step: 3, Operation: 'Change Type', Category: 'Outdoor', Attribute: 'pace', 'New type': 'text' }),
  ]);
  ok('bez grešaka', p.errors.length === 0);
  ok('3 retka pročitana (prazan se ne broji)', p.rowsRead === 3);
  ok('koraci složeni po broju', eq(p.steps.map(s => s.n), [1, 2, 3]));
  ok('A1 korak', eq(p.steps[0], { n: 1, kind: 'retype', category: 'Activity', slug: 'mood', to: 'number',
    conv: { kind: 'mapa', map: { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 } }, note: 'P2' }));
  ok('A4 korak, DA ⇒ obriši izvor', eq(p.steps[1], { n: 2, kind: 'merge', category: 'Outdoor', slug: 'vr', into: 'total_ascent', dropSource: true }));
  ok('„tekst" = text, bez pretvorbe', eq(p.steps[2], { n: 3, kind: 'retype', category: 'Outdoor', slug: 'pace', to: 'text' }));
}
{
  const p = parseAttrRows(H, [
    row(2, { Step: 1, Operation: 'change type', Category: 'Activity', Attribute: 'mood', 'New type': 'number' }),
    row(3, { Step: 2, Operation: 'change type', Category: 'Outdoor', Attribute: 'pace', 'New type': 'text', Conversion: 'number' }),
    row(4, { Step: 3, Operation: 'change type', Category: 'Outdoor', Attribute: 'pace', 'New type': 'date' }),
    row(5, { Step: 4, Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'vr' }),
    row(6, { Step: 5, Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'x', 'Delete source': 'maybe' }),
    row(7, { Step: 6, Operation: 'delete', Category: 'Outdoor', Attribute: 'vr' }),
    row(8, { Step: 6, Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'x' }),
    row(9, { Step: 'x', Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'x' }),
    row(10, { Step: 7, Operation: 'merge into', Attribute: 'vr', 'Into attribute': 'x' }),
    row(11, { Step: 8, Operation: 'merge into', Category: 'Outdoor', Attribute: 'vr', 'Into attribute': 'x', Conversion: 'number' }),
  ]);
  const has = (r, s) => p.errors.some(e => e.startsWith(`row ${r}:`) && e.includes(s));
  ok('tekst → broj bez Pretvorbe', has(2, 'needs a Conversion'));
  ok('broj → tekst s Pretvorbom', has(3, 'takes no Conversion'));
  ok('nepoznat tip', has(4, 'New type'));
  ok('spoji sam u sebe', has(5, 'into itself'));
  ok('Obriši izvor nije DA/NE', has(6, 'yes or no'));
  ok('nepoznata operacija', has(7, 'Operation must be'));
  ok('isti Korak dvaput', has(8, 'already exists'));
  ok('Korak nije broj', has(9, 'whole number'));
  ok('nema Kategorije', has(10, 'Category'));
  ok('Pretvorba uz spoji', has(11, 'only for'));
  ok('nijedan neispravan redak ne postaje korak', p.steps.length === 0);
}
{
  const p = parseAttrRows(['Attribute', 'category', 'OPERATION', 'Step', 'New type', 'Conversion', 'Delete source'],
    [{ rowNum: 2, cells: ['mood', 'Activity', 'change type', 1, 'number', 'number', null] }]);
  ok('drukčiji redoslijed stupaca i veličina slova', p.errors.length === 0 && p.steps[0]?.slug === 'mood');
  const q = parseAttrRows([...H, 'Boja'], []);
  ok('nepoznat stupac ⇒ greška', q.errors.some(e => e.includes('"Boja"')));
  const r = parseAttrRows(['Step', 'Category', 'Attribute'], []);
  ok('nedostaje Operation ⇒ greška, nijedan korak', r.errors.some(e => e.includes('Operation')) && r.steps.length === 0);
}

console.log('\n── Korak iz sheeta → pravi planer ──');
{
  const p = parseAttrRows(H, [row(2, { Step: 1, Operation: 'change type', Category: 'Activity', Attribute: 'mood', 'New type': 'number', Conversion: MOOD })]);
  const snap = {
    areaId: 'area-1', settings: {}, presets: [], anchors: [],
    categories: [{ id: 'c-act', name: 'Activity' }],
    attributes: [{ id: 'a-mood', category_id: 'c-act', slug: 'mood', name: 'mood', data_type: 'text', default_value: null, validation_rules: {} }],
    values: [
      { id: '1', event_id: 'e1', event_date: '2024-06-13', value_text: ':-|', value_number: null },
      { id: '2', event_id: 'e2', event_date: '2024-06-14', value_text: ':-)', value_number: null },
      { id: '3', event_id: 'e3', event_date: '2024-07-04', value_text: ':-D', value_number: null },
    ],
  };
  const plan = planRetype(toRetypeInput(p.steps[0]), snap);
  ok('planer bez grešaka', plan.errors.length === 0);
  ok(':-| → 3, :-) → 4, :-D → 5', eq(plan.predicted, { 1: 3, 2: 4, 3: 5 }));
  ok('rpc paket za 3 retka', plan.rpc?.p_expected === 3);
}

console.log('\n── Radna knjiga ──');
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('restructure Attributes');   // veličina slova nije bitna
  ws.addRow(H);
  ws.addRow([1, 'change type', 'Activity', 'mood', 'number', null, MOOD, null, null]);
  ws.addRow([]);
  ws.getCell('A4').value = 'HELP — uputa';
  ws.getCell('A5').value = 2;                               // ispod upute: NE smije biti korak
  ws.getCell('B5').value = 'merge into';
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const p = readAttrSheet(wb2);
  ok('jedan korak, uputa i sve ispod nje preskočeno', p && p.steps.length === 1 && p.rowsRead === 1 && p.errors.length === 0);
  ok('mapa preživi Excel', p && p.steps[0].conv?.map?.[':-|'] === 3);
  ok('nema sheeta ⇒ null', readAttrSheet(new ExcelJS.Workbook()) === null);
}

console.log('\n── Structure export nosi prazan predložak ──');
{
  const area = { id: 'a1', name: 'Fitness_Garmin', settings: {} };
  const attr = (slug, data_type, cat) => ({ id: 'd-' + slug, slug, name: slug, data_type, validation_rules: {},
    category_id: cat, sort_order: 1, is_required: false, default_value: null, unit: null, description: null });
  const node = (id, name, fullPath, level, isLeaf, parent, defs) => ({ id, nodeType: 'category', name, fullPath, level, isLeaf,
    description: null, sortOrder: 1, areaId: 'a1', parentCategoryId: parent, attributeDefinitions: defs, attrCount: defs.length,
    eventCount: 0, area, category: { id, name, area_id: 'a1', settings: null } });
  const nodes = [
    { id: 'a1', nodeType: 'area', name: 'Fitness_Garmin', fullPath: 'Fitness_Garmin', level: 0, isLeaf: false, description: null,
      sortOrder: 1, areaId: 'a1', parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0, area, category: null },
    node('c-act', 'Activity', 'Fitness_Garmin > Activity', 1, false, null, [attr('mood', 'text', 'c-act'), attr('kcal', 'number', 'c-act')]),
    node('c-out', 'Outdoor', 'Fitness_Garmin > Activity > Outdoor', 2, true, 'c-act', [attr('pace', 'text', 'c-out')]),
  ];
  const wb = new ExcelJS.Workbook();
  await addStructureSheetsTo(wb, nodes, { filterAreaId: 'a1' });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const ws = wb2.getWorksheet(ATTR_SHEET);
  ok('sheet postoji pod imenom „Restructure attributes"', !!ws);
  ok('zaglavlje = attrHeader()', ws && eq(ws.getRow(1).values.slice(1), attrHeader()));
  const p = readAttrSheet(wb2);
  ok('uvoz ga čita kao prazan: 0 redaka, 0 grešaka', p && p.rowsRead === 0 && p.errors.length === 0);
  const help = [];
  ws?.eachRow(r => { const v = r.getCell(1).value; if (typeof v === 'string' && v.includes('Attributes —')) help.push(v); });
  ok('uputa nosi atribut RODITELJSKE razine (Activity: mood (text), kcal (number))',
    help.some(h => h.includes('Activity:') && h.includes('mood (text)') && h.includes('kcal (number)')));
  ok('F1 sheet se s njim ne brka', findRestructureSheet(wb2)?.name === RESTRUCTURE_SHEET);
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) { console.log('❌ restructureAttrSheet'); process.exit(1); }
