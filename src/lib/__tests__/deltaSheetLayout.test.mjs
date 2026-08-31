import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';

import { join } from 'node:path';
import ExcelJS from 'exceljs';

// ⚠ Bundle mora zavrsiti UNUTAR projekta — iz temp direktorija node ne moze
//   razrijesiti `exceljs` (external), pa import padne s ERR_MODULE_NOT_FOUND.
const out = join(process.cwd(), 'node_modules', '.cache', 'deltaSheet.bundle.mjs');
mkdirSync(join(process.cwd(),'node_modules','.cache'), { recursive: true });
await build({
  entryPoints: ['src/lib/deltaSheet.ts'], bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  // deltaSheet transitivno povuce supabaseClient; test ga ne zove, ali modul se
  // izvrsi pri importu — pa mu treba samo da se ne srusi na praznom env-u.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"http://localhost:54321"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
    'import.meta.env.VITE_APP_ENV': '"test"',
  },
});
const { createDeltaExcel } = await import(pathToFileURL(out).href);

const CAT = 'cat1';
const catsDict = { [CAT]: { area_name: 'Financije_all', full_path: 'Financije_all > Transakcija', category_id: CAT } };
const defs = [
  { id: 'a1', category_id: CAT, name: 'Racun',  slug: 'racun',          data_type: 'text',   sort_order: 1, validation_rules: null },
  { id: 'a2', category_id: CAT, name: 'Izvor',  slug: 'izvorplacanja',  data_type: 'text',   sort_order: 2, validation_rules: null },
  { id: 'a3', category_id: CAT, name: 'Uplata', slug: 'uplata',         data_type: 'number', sort_order: 3, validation_rules: null },
  { id: 'a4', category_id: CAT, name: 'Isplata',slug: 'isplata',        data_type: 'number', sort_order: 4, validation_rules: null },
  { id: 'a5', category_id: CAT, name: 'Status', slug: 'status',         data_type: 'text',   sort_order: 5, validation_rules: null },
];
const mk = (id, date, racun, izvor, isplata, status) => ({
  id, category_id: CAT, event_date: date, session_start: `${date}T09:00:00Z`,
  created_at: `${date}T09:00:01Z`, user_email: 'k@x.com', user_id: 'u1', comment: `redak ${id}`,
  event_attributes: [
    { attribute_definition_id: 'a1', value_text: racun }, { attribute_definition_id: 'a2', value_text: izvor },
    { attribute_definition_id: 'a4', value_number: isplata }, { attribute_definition_id: 'a5', value_text: status },
  ],
});
const main = [mk('m1','2026-08-02','ZABA','Racun',3.2,'Izvrsen'), mk('m2','2026-08-03','ZABA','Racun',1.6,'Izvrsen'),
              mk('m3','2026-08-04','ZABA','Racun',2.4,'Izvrsen')];
const planned = [mk('p1','2026-07-11','ZABA','Mastercard',137.78,'Planiran'), mk('p2','2026-07-11','ZABA','Mastercard',63.33,'Planiran')];
const BLANKS = 5;

async function buildSheet(planned) {
  const { buffer, warnings } = await createDeltaExcel(main, defs, catsDict, {
    groupLabel: 'ZABA', opening: { amount: 13815.33, asOf: '2026-07-30' },
    anchor: { amount: 13815.33, confirmed_on: '2026-07-30' },
    plusSlug: 'uplata', minusSlug: 'isplata',
    filters: [{ op:'in', slug:'izvorplacanja', values:['Racun'] }, { op:'not_in', slug:'status', values:['Planiran'] }],
    blankRows: BLANKS, prefill: { Racun: 'ZABA', Izvor: 'Racun' },
    areaName: 'Financije_all', categoryPath: 'Financije_all > Transakcija', userEmail: 'k@x.com',
  }, null, planned);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('Events');
  let hdr = 0;
  for (let r = 1; r <= ws.rowCount; r++) if (String(ws.getCell(r,1).value ?? '').trim() === 'event_id') { hdr = r; break; }
  const colOf = (n) => { for (let c=1;c<=ws.columnCount;c++) if (String(ws.getCell(hdr,c).value??'').trim()===n) return c; return 0; };
  return { ws, hdr, ctrl: colOf('Stanje (kontrola)'), hash: colOf('row_hash'), warnings };
}
const raw = (ws,r,c) => ws.getCell(r,c).value;
const txt = (ws,r,c) => { const v = raw(ws,r,c); return v==null ? '' : (typeof v==='object' && 'formula' in v ? 'f()' : String(v)); };

let pass=0, fail=0;
const ok = (name, cond, extra='') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

console.log('');
console.log('Sa sekcijom "planirano" (3 glavna + 5 praznih + 2 planirana):');
{
  const { ws, hdr, ctrl, hash } = await buildSheet(planned);
  const mainEnd = hdr + main.length;            // 3 glavna retka
  const blankTo = mainEnd + BLANKS;
  const sep     = blankTo + 1;
  const pFrom   = blankTo + 2;

  ok('glavni blok je na svom mjestu', txt(ws,hdr+1,1)==='m1' && txt(ws,mainEnd,1)==='m3');
  ok('prazni retci ne gaze sekciju (Area prepisan, event_id prazan)',
     txt(ws,mainEnd+1,2)==='Financije_all' && txt(ws,mainEnd+1,1)==='' && txt(ws,blankTo,1)==='');
  // ⚠ Kljucno: separator MORA imati praznu kolonu B, inace ga import vidi kao redak.
  ok('separator ima praznu kolonu B (import ga ne vidi kao redak)', txt(ws,sep,2)==='');
  ok('naslov sekcije je na separatoru', txt(ws,sep,8).startsWith('PLANIRANO'));
  ok('planirani retci su ispod separatora', txt(ws,pFrom,1)==='p1' && txt(ws,pFrom+1,1)==='p2');
  // Bez row_hasha bi svaki uvoz iznova pisao te retke (D7 skip prestaje raditi).
  ok('planirani retci NOSE row_hash (D7 skip radi)',
     txt(ws,pFrom,hash).length===16 && txt(ws,pFrom+1,hash).length===16, `got ${txt(ws,pFrom,hash)}`);
  // Kartcna stavka ne mice saldo => celija mora biti PRAZNA, nikad 0,00.
  ok('kontrolni stupac je prazan na planiranima', raw(ws,pFrom,ctrl)==null && raw(ws,pFrom+1,ctrl)==null);
  ok('kontrolni stupac postoji na glavnom bloku i praznima',
     txt(ws,hdr+1,ctrl)==='f()' && txt(ws,blankTo,ctrl)==='f()');
  ok('kosara: Σ i razlika su formule, "naplaceno" je prazno za rucni unos',
     txt(ws,pFrom+2+1,ctrl)==='f()' && raw(ws,pFrom+2+2,ctrl)==null && txt(ws,pFrom+2+3,ctrl)==='f()');
  ok('autofilter staje na praznim retcima, ne obuhvaca sekciju',
     String(ws.autoFilter).endsWith(String(blankTo)), `got ${ws.autoFilter}`);
}

console.log('');
console.log('Regresija — bez planiranih redaka layout mora ostati kakav je bio:');
{
  const { ws, hdr, ctrl } = await buildSheet([]);
  const mainEnd = hdr + main.length, blankTo = mainEnd + BLANKS;
  ok('nema naslova sekcije', !String(txt(ws,blankTo+1,8)).startsWith('PLANIRANO'));
  ok('glavni blok + prazni retci nepromijenjeni',
     txt(ws,hdr+1,1)==='m1' && txt(ws,blankTo,2)==='Financije_all' && txt(ws,blankTo,ctrl)==='f()');
  ok('autofilter i dalje staje na praznima', String(ws.autoFilter).endsWith(String(blankTo)));
}

rmSync(out, { force: true });
console.log('');
console.log(`${fail===0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail===0?0:1);
