/**
 * S178 / F1 — sheet `Restructure options` (`src/lib/restructure/sheet.ts`, PREUREDJIVANJE_SPEC §11).
 * (Do S188 `Preuređivanje` / `kad:` / `postavi:` / `(prazno)`.)
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Sheet je ulaz u operaciju koja dira tisuće redaka. Krivo pročitan redak nije
 *   kozmetika: obrezan razmak sakrije novu opciju (S167), `(empty)` pročitan kao
 *   tekst upiše riječ „(empty)" u retke, a pomoćni tekst ispod tablice pročitan
 *   kao korak je korak koji nitko nije napisao. Uz to: export nosi PRAZAN sheet, a
 *   uvoz ga mora prepoznati kao prazan (0 redaka) — inače bi svaki Structure
 *   roundtrip javljao „koraci nisu primijenjeni".
 *
 *   S188: ispod `HELP` stoje PRIMJERI u pravim stupcima. Čitač koji ne stane na
 *   `HELP` izveo bi ih kao korake (preimenovanje opcije nad svim retcima!) — zato se
 *   mjeri pravi export, oba sheeta. I: svaki primjer mora proći parser bez greške.
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
    contents: "export * from './src/lib/restructure/sheet'; export { addStructureSheetsTo } from './src/lib/structureExcel';"
      + " export { readAttrSheet, parseAttrRows, ATTR_SHEET } from './src/lib/restructure/attrSheet';",
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
const { parseRestructureRows, readRestructureSheet, restructureHeader, addStructureSheetsTo, RESTRUCTURE_SHEET,
  legacyRestructureWarning, restructureExamples, readAttrSheet, parseAttrRows, ATTR_SHEET } = M;

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
ok('ime sheeta: Restructure options', RESTRUCTURE_SHEET === 'Restructure options');
ok('redoslijed: Step, Category, when:*, set:*, event_id, Note',
  eq(H, ['Step', 'Category', 'when: tip', 'when: podtip', 'when: namjena', 'set: tip', 'set: podtip', 'set: namjena', 'event_id', 'Note']));

console.log('\n── Retci iz spec-a §11 ──');
{
  const p = parseRestructureRows(H, [
    row(2, { Step: 1, Category: 'Transakcija', 'when: tip': 'Zabava', 'when: podtip': 'Audible_Koka', 'set: podtip': 'Audible', 'set: namjena': 'Koka', Note: 'O5' }),
    row(3, { Step: 99, Category: 'Transakcija', 'when: namjena': '(empty)', 'set: namjena': 'Zajedničko' }),
    row(4, { Step: 3, Category: 'Transakcija', 'when: tip': 'Kuća', 'when: podtip': 'Osiguranje', 'set: tip': 'Osiguranje', 'set: podtip': 'Kuća' }),
    row(5, { Step: 6, Category: 'Transakcija', 'set: namjena': 'Saša', event_id: `${ID1}, ${ID2.toUpperCase()}` }),
    row(6, {}),
  ]);
  ok('nema grešaka', p.errors.length === 0);
  ok('koraci po broju (1, 3, 6, 99), ne po retku', eq(p.steps.map(s => s.n), [1, 3, 6, 99]));
  ok('prazna ćelija = ključa nema', eq(p.steps[0].when, { tip: 'Zabava', podtip: 'Audible_Koka' }) && !('tip' in p.steps[0].set));
  ok('(empty) = null (u when)', p.steps[3].when.namjena === null);
  ok('event_id: zarez + razmak, mala slova', eq(p.steps[2].eventIds, [ID1, ID2]));
  ok('napomena', p.steps[0].note === 'O5');
  ok('prazan redak se ne broji', p.rowsRead === 4);
}

console.log('\n── Razmak se NE obrezuje (planer ga javlja, S167) ──');
{
  const p = parseRestructureRows(H, [row(2, { Step: 1, Category: 'Transakcija', 'when: tip': 'Kuća', 'set: tip': 'Dom ' })]);
  ok('„Dom " ostaje „Dom "', p.steps[0].set.tip === 'Dom ');
  const q = parseRestructureRows(H, [row(2, { Step: 1, Category: 'Transakcija', 'when: tip': 'Kuća', 'set: tip': ' (empty) ' })]);
  ok('„ (empty) " je i dalje (empty) — token, ne vrijednost', q.steps[0].set.tip === null);
  const r = parseRestructureRows(H, [row(2, { Step: 1, Category: 'Transakcija', 'when: tip': 'Kuća', 'set: tip': '(prazno)' })]);
  ok('stari token (prazno) je obična vrijednost — ne briše', r.steps[0].set.tip === '(prazno)');
}

console.log('\n── Isti korak u više redaka (dugi popis event_id) ──');
{
  const p = parseRestructureRows(H, [
    row(2, { Step: 6, Category: 'Transakcija', 'set: namjena': 'Saša', event_id: ID1 }),
    row(3, { Step: 6, Category: 'Transakcija', 'set: namjena': 'Saša', event_id: ID2 }),
    row(4, { Step: 7, Category: 'Transakcija', 'set: namjena': 'Saša', event_id: ID1 }),
    row(5, { Step: 7, Category: 'Transakcija', 'set: namjena': 'Koka', event_id: ID2 }),
  ]);
  ok('isti uvjeti ⇒ popisi spojeni', eq(p.steps[0].eventIds, [ID1, ID2]));
  ok('drukčiji uvjeti pod istim brojem ⇒ greška', p.errors.some(e => e.startsWith('row 5') && e.includes('Step 7')));
}

console.log('\n── Greške ──');
{
  const p = parseRestructureRows([...H, 'Nešto', 'kad: tip'], [
    row(2, { Step: 'a', Category: 'Transakcija' }),
    row(3, { Step: 2, 'when: tip': 'X' }),
    row(4, { Step: 4, Category: 'Transakcija', 'when: tip': 'X', event_id: 'nije-uuid' }),
  ]);
  ok('nepoznat stupac', p.errors.some(e => e.includes('"Nešto"')));
  ok('staro zaglavlje „kad: tip" je nepoznat stupac (ne čita se tiho)', p.errors.some(e => e.includes('"kad: tip"')));
  ok('Step nije broj', p.errors.some(e => e.startsWith('row 2')));
  ok('nema kategorije', p.errors.some(e => e.startsWith('row 3')));
  ok('kriv event_id', p.errors.some(e => e.startsWith('row 4') && e.includes('nije-uuid')));
  const q = parseRestructureRows(['Step', 'when: tip'], []);
  ok('bez Category u zaglavlju', q.errors.some(e => e.includes('Category')));
}

console.log('\n── Pravi .xlsx: upisano → pročitano, uputa se ne čita ──');
{
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('restructure OPTIONS');        // velika/mala slova se ne gledaju
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

console.log('\n── Stari sheet `Preuređivanje` (do S188): ne čita se, ali se JAVI ──');
{
  const mk = (withRow) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Preuređivanje');
    ws.addRow(['Korak', 'Kategorija', 'kad: tip', 'postavi: tip']);
    if (withRow) ws.addRow([1, 'Transakcija', 'Kuća', 'Dom']);
    ws.getCell('A4').value = 'HELP — preuređivanje';
    ws.getCell('A5').value = '  Primjer: 1 | Transakcija | …';
    return wb;
  };
  ok('stari sheet nije novi sheet', readRestructureSheet(mk(true)) === null);
  const w = legacyRestructureWarning(mk(true));
  ok('s upisanim retkom ⇒ upozorenje koje imenuje novo ime', !!w && w.includes('Restructure options') && w.includes('NOT read'));
  ok('prazan stari predložak ⇒ šuti (svaki stari export ga nosi)', legacyRestructureWarning(mk(false)) === null);
  ok('bez starog sheeta ⇒ šuti', legacyRestructureWarning(new ExcelJS.Workbook()) === null);
}

// ── Structure export: prazan predložak + PRIMJERI ispod HELP ─────────────
const area = { id: 'a1', name: 'Financije_all', settings: {} };
const attr = (slug, data_type, validation_rules) => ({ id: 'd-' + slug, slug, name: slug, data_type, validation_rules,
  category_id: 'c1', sort_order: 1, is_required: false, default_value: null, unit: null, description: null });
const defs = [
  attr('tip', 'text', { suggest: ['Kuća', 'Hrana', 'Zabava'] }),
  attr('podtip', 'text', { depends_on: { attribute_slug: 'tip', options_map: { '*': [], Kuća: ['Osiguranje', 'Struja'] } } }),
  attr('izvod_opis', 'text', { hidden_in_add: true }),
  attr('isplata', 'number', {}),
];
const nodes = [
  { id: 'a1', nodeType: 'area', name: 'Financije_all', fullPath: 'Financije_all', level: 0, isLeaf: false, description: null,
    sortOrder: 1, areaId: 'a1', parentCategoryId: null, attributeDefinitions: [], attrCount: 0, eventCount: 0, area, category: null },
  { id: 'c1', nodeType: 'category', name: 'Transakcija', fullPath: 'Financije_all > Transakcija', level: 1, isLeaf: true,
    description: null, sortOrder: 1, areaId: 'a1', parentCategoryId: null, attributeDefinitions: defs, attrCount: defs.length,
    eventCount: 0, area, category: { id: 'c1', name: 'Transakcija', area_id: 'a1', settings: null } },
];
const wbE = new ExcelJS.Workbook();
await addStructureSheetsTo(wbE, nodes, { filterAreaId: 'a1' });
const wbX = new ExcelJS.Workbook();
await wbX.xlsx.load(await wbE.xlsx.writeBuffer());

/** Retci ISPOD prvog HELP-a čiji je stupac A broj = primjeri. */
const examplesBelowHelp = (ws) => {
  const rows = [];
  let afterHelp = false;
  ws.eachRow((r, n) => {
    const a = r.getCell(1).value;
    if (typeof a === 'string' && a.startsWith('HELP')) afterHelp = true;
    else if (afterHelp && typeof a === 'number') rows.push({ rowNum: n, cells: r.values.slice(1).map(v => v ?? null) });
  });
  return rows;
};

console.log('\n── Export: Restructure options ──');
{
  const ws = wbX.getWorksheet(RESTRUCTURE_SHEET);
  const head = ws ? ws.getRow(1).values.slice(1) : [];
  ok('sheet postoji pod imenom „Restructure options"', !!ws);
  ok('nema starog sheeta „Preuređivanje"', !wbX.getWorksheet('Preuređivanje'));
  ok('stupci samo za tekstualne atribute S IZBORNIKOM (tip, podtip)', eq(head, restructureHeader(['tip', 'podtip'])));
  const p = readRestructureSheet(wbX);
  ok('uvoz ga čita kao prazan: 0 redaka, 0 grešaka — PRIMJERI se ne izvode', p && p.rowsRead === 0 && p.errors.length === 0);
  const ex = examplesBelowHelp(ws);
  ok('pet primjera (preimenuj, spoji, premjesti, popuni, event_id)', ex.length === 5);
  const pe = parseRestructureRows(head, ex);
  ok('svaki primjer prolazi parser bez greške', pe.errors.length === 0 && pe.steps.length === 5);
  ok('primjer 1 = preimenovanje prve opcije', eq(pe.steps[0].when, { tip: 'Kuća' }) && eq(pe.steps[0].set, { tip: 'Kuća_new' }));
  ok('primjer 3 = premještanje podtipa (vrijednosti iz Aree)',
    eq(pe.steps[2].when, { tip: 'Kuća', podtip: 'Osiguranje' }) && eq(pe.steps[2].set, { tip: 'Hrana' }));
  ok('primjer 4 = popuni prazno ((empty) u when)', pe.steps[3].when.podtip === null && pe.steps[3].set.podtip === 'Osiguranje');
  const texts = [];
  ws.eachRow(r => { const v = r.getCell(1).value; if (typeof v === 'string') texts.push(v); });
  ok('ispod svakog primjera objašnjenje „↑ N."', [1, 2, 3, 4, 5].every(n => texts.some(t => t.includes(`↑ ${n}.`))));
  ok('uputa nabraja SVE tekstualne atribute leafa (i izvod_opis)',
    texts.some(h => h.includes('Text attributes') && h.includes('izvod_opis') && !h.includes('isplata')));
}

console.log('\n── Primjeri: Area bez depends_on djeteta / bez izbornika ──');
{
  const h = restructureHeader(['tip']);
  const ex = restructureExamples(h, { category: 'T', menu: 'tip', options: ['A', 'B'] });
  const pe = parseRestructureRows(h, ex.map((e, i) => ({ rowNum: i + 2, cells: e.cells })));
  ok('bez djeteta: preimenuj, spoji, popuni, event_id (4), bez greške', ex.length === 4 && pe.errors.length === 0);
  ok('bez izbornika ⇒ nema primjera', restructureExamples(h, null).length === 0);
}

console.log('\n── Export: Restructure attributes ──');
{
  const ws = wbX.getWorksheet(ATTR_SHEET);
  const p = readAttrSheet(wbX);
  ok('uvoz ga čita kao prazan: 0 redaka, 0 grešaka — PRIMJERI se ne izvode', p && p.rowsRead === 0 && p.errors.length === 0);
  const ex = examplesBelowHelp(ws);
  const pe = parseAttrRows(ws.getRow(1).values.slice(1), ex);
  ok('četiri primjera (number, mm:ss, map, → text), svi bez greške', ex.length === 4 && pe.errors.length === 0 && pe.steps.length === 4);
  ok('primjer s mapom: tri para', pe.steps[2].conv?.kind === 'mapa' && Object.keys(pe.steps[2].conv.map).length === 3);
  ok('tekstualni primjer je atribut BEZ izbornika (izvod_opis), brojčani isplata',
    pe.steps[0].slug === 'izvod_opis' && pe.steps[3].slug === 'isplata');
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) { console.log('❌ restructureSheet'); process.exit(1); }
