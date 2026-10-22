/**
 * S178 / F1 — sheet `Preuređivanje` (`src/lib/restructure/sheet.ts`, PREUREDJIVANJE_SPEC §11).
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Sheet je ulaz u operaciju koja dira tisuće redaka. Krivo pročitan redak nije
 *   kozmetika: obrezan razmak sakrije novu opciju (S167), `(prazno)` pročitan kao
 *   tekst upiše riječ „(prazno)" u retke, a pomoćni tekst ispod tablice pročitan
 *   kao korak je korak koji nitko nije napisao. Uz to: export nosi PRAZAN sheet, a
 *   uvoz ga mora prepoznati kao prazan (0 redaka) — inače bi svaki Structure
 *   roundtrip javljao „koraci nisu primijenjeni".
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'restructureSheet.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/restructure/sheet'; export { addStructureSheetsTo } from './src/lib/structureExcel';",
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
const { parseRestructureRows, readRestructureSheet, restructureHeader, addStructureSheetsTo, RESTRUCTURE_SHEET } = M;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const H = restructureHeader(['tip', 'podtip', 'namjena']);
const col = name => H.indexOf(name);
const row = (rowNum, vals) => {
  const cells = H.map(() => null);
  for (const [k, v] of Object.entries(vals)) cells[col(k)] = v;
  return { rowNum, cells };
};
const ID1 = '3f2a0000-0000-4000-8000-000000000001', ID2 = '81c00000-0000-4000-8000-000000000002';

console.log('\n── Zaglavlje ──');
ok('redoslijed: Korak, Kategorija, kad:*, postavi:*, event_id, Napomena',
  eq(H, ['Korak', 'Kategorija', 'kad: tip', 'kad: podtip', 'kad: namjena', 'postavi: tip', 'postavi: podtip', 'postavi: namjena', 'event_id', 'Napomena']));

console.log('\n── Retci iz spec-a §11 ──');
{
  const p = parseRestructureRows(H, [
    row(2, { Korak: 1, Kategorija: 'Transakcija', 'kad: tip': 'Zabava', 'kad: podtip': 'Audible_Koka', 'postavi: podtip': 'Audible', 'postavi: namjena': 'Koka', Napomena: 'O5' }),
    row(3, { Korak: 99, Kategorija: 'Transakcija', 'kad: namjena': '(prazno)', 'postavi: namjena': 'Zajedničko' }),
    row(4, { Korak: 3, Kategorija: 'Transakcija', 'kad: tip': 'Kuća', 'kad: podtip': 'Osiguranje', 'postavi: tip': 'Osiguranje', 'postavi: podtip': 'Kuća' }),
    row(5, { Korak: 6, Kategorija: 'Transakcija', 'postavi: namjena': 'Saša', event_id: `${ID1}, ${ID2.toUpperCase()}` }),
    row(6, {}),
  ]);
  ok('nema grešaka', p.errors.length === 0);
  ok('koraci po broju (1, 3, 6, 99), ne po retku', eq(p.steps.map(s => s.n), [1, 3, 6, 99]));
  ok('prazna ćelija = ključa nema', eq(p.steps[0].when, { tip: 'Zabava', podtip: 'Audible_Koka' }) && !('tip' in p.steps[0].set));
  ok('(prazno) = null (u kad)', p.steps[3].when.namjena === null);
  ok('event_id: zarez + razmak, mala slova', eq(p.steps[2].eventIds, [ID1, ID2]));
  ok('napomena', p.steps[0].note === 'O5');
  ok('prazan redak se ne broji', p.rowsRead === 4);
}

console.log('\n── Razmak se NE obrezuje (planer ga javlja, S167) ──');
{
  const p = parseRestructureRows(H, [row(2, { Korak: 1, Kategorija: 'Transakcija', 'kad: tip': 'Kuća', 'postavi: tip': 'Dom ' })]);
  ok('„Dom " ostaje „Dom "', p.steps[0].set.tip === 'Dom ');
  const q = parseRestructureRows(H, [row(2, { Korak: 1, Kategorija: 'Transakcija', 'kad: tip': 'Kuća', 'postavi: tip': ' (prazno) ' })]);
  ok('„ (prazno) " je i dalje (prazno) — token, ne vrijednost', q.steps[0].set.tip === null);
}

console.log('\n── Isti korak u više redaka (dugi popis event_id) ──');
{
  const p = parseRestructureRows(H, [
    row(2, { Korak: 6, Kategorija: 'Transakcija', 'postavi: namjena': 'Saša', event_id: ID1 }),
    row(3, { Korak: 6, Kategorija: 'Transakcija', 'postavi: namjena': 'Saša', event_id: ID2 }),
    row(4, { Korak: 7, Kategorija: 'Transakcija', 'postavi: namjena': 'Saša', event_id: ID1 }),
    row(5, { Korak: 7, Kategorija: 'Transakcija', 'postavi: namjena': 'Koka', event_id: ID2 }),
  ]);
  ok('isti uvjeti ⇒ popisi spojeni', eq(p.steps[0].eventIds, [ID1, ID2]));
  ok('drukčiji uvjeti pod istim brojem ⇒ greška', p.errors.some(e => e.startsWith('redak 5') && e.includes('Korak 7')));
}

console.log('\n── Greške ──');
{
  const p = parseRestructureRows([...H, 'Nešto'], [
    row(2, { Korak: 'a', Kategorija: 'Transakcija' }),
    row(3, { Korak: 2, 'kad: tip': 'X' }),
    row(4, { Korak: 4, Kategorija: 'Transakcija', 'kad: tip': 'X', event_id: 'nije-uuid' }),
  ]);
  ok('nepoznat stupac', p.errors.some(e => e.includes('„Nešto"')));
  ok('Korak nije broj', p.errors.some(e => e.startsWith('redak 2')));
  ok('nema kategorije', p.errors.some(e => e.startsWith('redak 3')));
  ok('kriv event_id', p.errors.some(e => e.startsWith('redak 4') && e.includes('nije-uuid')));
  const q = parseRestructureRows(['Korak', 'kad: tip'], []);
  ok('bez Kategorije u zaglavlju', q.errors.some(e => e.includes('Kategorija')));
}

console.log('\n── Pravi .xlsx: upisano → pročitano, uputa se ne čita ──');
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Preuredjivanje');           // bez dijakritike — i to se prepoznaje
  ws.addRow(H);
  ws.addRow([1, 'Transakcija', 'Zabava', 'Audible_Koka', null, null, 'Audible', 'Koka', null, 'O5']);
  ws.addRow([]);
  ws.getCell('A4').value = 'HELP — uputa';
  ws.getCell('A5').value = '1';                            // ispod upute: NE smije biti korak
  ws.getCell('B5').value = 'Transakcija';
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const p = readRestructureSheet(wb2);
  ok('jedan korak, uputa i sve ispod nje preskočeno', p && p.steps.length === 1 && p.rowsRead === 1);
  ok('vrijednosti iz ćelija', p && eq(p.steps[0].set, { podtip: 'Audible', namjena: 'Koka' }));
  ok('nema sheeta ⇒ null', readRestructureSheet(new ExcelJS.Workbook()) === null);
}

console.log('\n── Structure export nosi PRAZAN predložak koji uvoz čita kao prazan ──');
{
  const area = { id: 'a1', name: 'Financije_all', settings: {} };
  const attr = (slug, data_type, validation_rules) => ({ id: 'd-' + slug, slug, name: slug, data_type, validation_rules,
    category_id: 'c1', sort_order: 1, is_required: false, default_value: null, unit: null, description: null });
  const defs = [attr('tip', 'text', { suggest: ['Kuća'] }), attr('podtip', 'text', { depends_on: { attribute_slug: 'tip', options_map: {} } }),
    attr('izvod_opis', 'text', { hidden_in_add: true }), attr('isplata', 'number', {})];
  const nodes = [
    { id: 'a1', nodeType: 'area', name: 'Financije_all', fullPath: 'Financije_all', level: 0, isLeaf: false, description: null,
      sortOrder: 1, areaId: 'a1', parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0, area, category: null },
    { id: 'c1', nodeType: 'category', name: 'Transakcija', fullPath: 'Financije_all > Transakcija', level: 1, isLeaf: true,
      description: null, sortOrder: 1, areaId: 'a1', parentCategoryId: null, attributeDefinitions: defs, attrCount: defs.length,
      eventCount: 0, area, category: { id: 'c1', name: 'Transakcija', area_id: 'a1', settings: null } },
  ];
  const wb = new ExcelJS.Workbook();
  await addStructureSheetsTo(wb, nodes, { filterAreaId: 'a1' });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const ws = wb2.getWorksheet(RESTRUCTURE_SHEET);
  const head = ws ? ws.getRow(1).values.slice(1) : [];
  ok('sheet postoji pod imenom „Preuređivanje"', !!ws);
  ok('stupci samo za tekstualne atribute S IZBORNIKOM (tip, podtip)', eq(head, restructureHeader(['tip', 'podtip'])));
  const p = readRestructureSheet(wb2);
  ok('uvoz ga čita kao prazan: 0 redaka, 0 grešaka', p && p.rowsRead === 0 && p.errors.length === 0);
  const help = [];
  ws.eachRow(r => { const v = r.getCell(1).value; if (typeof v === 'string' && v.includes('Tekstualni atributi')) help.push(v); });
  ok('uputa nabraja SVE tekstualne atribute leafa (i izvod_opis)', help.some(h => h.includes('izvod_opis') && !h.includes('isplata')));
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) { console.log('❌ restructureSheet'); process.exit(1); }
