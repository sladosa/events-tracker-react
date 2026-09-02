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
  stdin: {
    contents: "export * from './src/lib/deltaSheet'; export * from './src/lib/exportProfile';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  // deltaSheet transitivno povuce supabaseClient; test ga ne zove, ali modul se
  // izvrsi pri importu — pa mu treba samo da se ne srusi na praznom env-u.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"http://localhost:54321"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
    'import.meta.env.VITE_APP_ENV': '"test"',
  },
});
const { createDeltaExcel, readProfileFromWorkbook, applyProfileToWorkbook } = await import(pathToFileURL(out).href);

const CAT = 'cat1';
const catsDict = { [CAT]: { area_name: 'Financije_all', full_path: 'Financije_all > Transakcija', category_id: CAT } };
const defs = [
  { id: 'a1', category_id: CAT, name: 'Racun',  slug: 'racun',          data_type: 'text',   sort_order: 1, validation_rules: null },
  { id: 'a2', category_id: CAT, name: 'Izvor',  slug: 'izvorplacanja',  data_type: 'text',   sort_order: 2, validation_rules: null },
  { id: 'a3', category_id: CAT, name: 'Uplata', slug: 'uplata',         data_type: 'number', sort_order: 3, validation_rules: null },
  { id: 'a4', category_id: CAT, name: 'Isplata',slug: 'isplata',        data_type: 'number', sort_order: 4, validation_rules: null },
  { id: 'a5', category_id: CAT, name: 'Status', slug: 'status',         data_type: 'text',   sort_order: 5, validation_rules: null },
  { id: 'a6', category_id: CAT, name: 'Datum naplate', slug: 'datum_naplate', data_type: 'datetime', sort_order: 6, validation_rules: null },
];
const mk = (id, date, racun, izvor, isplata, status, due) => ({
  id, category_id: CAT, event_date: date, session_start: `${date}T09:00:00Z`,
  created_at: `${date}T09:00:01Z`, user_email: 'k@x.com', user_id: 'u1', comment: `redak ${id}`,
  event_attributes: [
    { attribute_definition_id: 'a1', value_text: racun }, { attribute_definition_id: 'a2', value_text: izvor },
    { attribute_definition_id: 'a4', value_number: isplata }, { attribute_definition_id: 'a5', value_text: status },
    ...(due ? [{ attribute_definition_id: 'a6', value_datetime: due }] : []),
  ],
});
const main = [mk('m1','2026-08-02','ZABA','Racun',3.2,'Izvrsen'), mk('m2','2026-08-03','ZABA','Racun',1.6,'Izvrsen'),
              mk('m3','2026-08-04','ZABA','Racun',2.4,'Izvrsen')];
const planned = [mk('p1','2026-07-11','ZABA','Mastercard',137.78,'Planiran'), mk('p2','2026-07-11','ZABA','Mastercard',63.33,'Planiran')];
const BLANKS = 5;

async function buildSheet(planned, extra = {}) {
  const { buffer, warnings } = await createDeltaExcel(main, defs, catsDict, {
    groupLabel: 'ZABA', opening: { amount: 13815.33, asOf: '2026-07-30' },
    anchor: { amount: 13815.33, confirmed_on: '2026-07-30' },
    plusSlug: 'uplata', minusSlug: 'isplata',
    filters: [{ op:'in', slug:'izvorplacanja', values:['Racun'] }, { op:'not_in', slug:'status', values:['Planiran'] }],
    blankRows: BLANKS, prefill: { Racun: 'ZABA', Izvor: 'Racun' },
    areaName: 'Financije_all', categoryPath: 'Financije_all > Transakcija', userEmail: 'k@x.com',
    ...extra,
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
console.log('Kosara (split.due_slug u configu) — sekcija nosi i vec potvrdjene retke:');
{
  // Bit kosare: jedan redak je jos `Planiran`, drugi je vec `Izvrsen`. Prije
  // S125 je drugi ispadao iz sekcije I iz glavnog bloka, pa ga file nije imao —
  // a bas se on nije dao ispraviti uvozom (izmjereno: gorivo 55,00, PROD).
  const basket = [mk('b1','2026-09-01','ZABA','Mastercard',100,'Planiran','2027-01-11T12:00:00Z'),
                  mk('b2','2026-09-02','ZABA','Mastercard',55,'Izvrsen','2027-01-11T12:00:00Z')];
  const { ws, hdr, ctrl } = await buildSheet(basket, { dueSlug: 'datum_naplate' });
  const sep = hdr + main.length + BLANKS + 1, pFrom = sep + 1;
  // Tekst se mijenja jer se mijenja i posao: u kosari nisu svi retci planirani,
  // pa uputa ne smije glasiti "potvrdi svaki redak" nego "slozi zbroj".
  ok('naslov je KOSARA, ne PLANIRANO', String(txt(ws,sep,8)).startsWith('KOSARA'));
  ok('vec potvrdjen redak JE u sekciji', txt(ws,pFrom+1,1)==='b2', `got ${txt(ws,pFrom+1,1)}`);
  // /!\ Neto: povrat u istoj kosari inace naduva zbroj i izmisli razliku
  //     prema izvodu. Izmjereno na ZABA kosari 11.08. (povrat 3,00).
  const f = String(raw(ws,pFrom+2+1,ctrl)?.formula ?? '');
  ok('Σ kosare je NETO (oduzima kolonu uplata)', f.includes('-SUM('), `got ${f}`);
  ok('Σ kosare i dalje ROUND-a na 2 decimale', f.startsWith('ROUND('), `got ${f}`);

  // Stupac `Provjeri` — FORMULA, da napomena nestane cim korisnik popravi redak.
  const hintCol = ctrl + 1;
  // Naslov stoji u retku-razdjelniku, tocno iznad redaka na koje se odnosi —
  // ne u zaglavlju lista desetke redaka iznad.
  ok('naslov Provjeri je u retku-razdjelniku', txt(ws,sep,hintCol)==='Provjeri', `got ${txt(ws,sep,hintCol)}`);
  ok('naslov Provjeri NIJE u zaglavlju lista', txt(ws,hdr,hintCol)!=='Provjeri');
  // /!\ Objasnjenje ide kao Data Validation input message, ne kao biljeska:
  //     biljeska kod desnog ruba izlazi izvan ekrana i pri skrolanju se odreze.
  const dv = ws.getCell(sep,hintCol).dataValidation;
  ok('objasnjenje je input message, ne biljeska', !!dv?.showInputMessage && !ws.getCell(sep,hintCol).note);
  // /!\ Prekoracenje limita daje neispravan OOXML i Excel nudi "repair" —
  //     tada se gubi sadrzaj, ne samo poruka. Zato granice cuva test.
  ok('promptTitle <= 32 znaka', (dv?.promptTitle ?? '').length <= 32, `got ${(dv?.promptTitle ?? '').length}`);
  ok('prompt <= 255 znakova', (dv?.prompt ?? '').length <= 255, `got ${(dv?.prompt ?? '').length}`);
  const sumDv = ws.getCell(pFrom+2+1, ctrl).dataValidation;
  ok('Σ košare: prompt <= 255 znakova', (sumDv?.prompt ?? '').length <= 255, `got ${(sumDv?.prompt ?? '').length}`);
  const h = String(raw(ws,pFrom+1,hintCol)?.formula ?? '');
  ok('napomena je formula nad TODAY(), ne upisan tekst', h.includes('TODAY()'), `got ${h}`);
  // /!\ Odbaceni automat "dospjelo => izvrseno" ne smije se vratiti kao savjet.
  ok('napomena NE savjetuje promjenu u Izvrsen', !/promijeni/i.test(h), `got ${h}`);
  ok('napomena upucuje na izvod', h.includes('s izvoda'), `got ${h}`);
}

console.log('');
console.log('Delta file nosi `Filter` list — bez njega uvoz ne zna je li file zastario:');
{
  const { buffer } = await createDeltaExcel(main, defs, catsDict, {
    groupLabel: 'ZABA', opening: { amount: 1, asOf: '2026-07-30' }, anchor: null,
    plusSlug: 'uplata', minusSlug: 'isplata', filters: [],
    blankRows: 2, prefill: {}, areaName: 'Financije_all',
    categoryPath: 'Financije_all > Transakcija', userEmail: 'k@x.com',
  }, null, [], { exportType: 'Activities delta', exportedAt: '20260902_150257' });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buffer);
  const f = wb2.getWorksheet('Filter');
  ok('delta file ima `Filter` list', !!f);
  // /!\ Bez ovoga se provjera zastarjelosti tiho preskace -- i to bas na fileu
  //     koji se koristi svaki mjesec (izmjereno 2026-09-02).
  let vidjeno = '';
  if (f) for (let r = 1; r <= f.rowCount; r++)
    if (String(f.getCell(r,1).value ?? '').trim() === 'Exported at') vidjeno = String(f.getCell(r,2).value ?? '');
  ok('`Exported at` je upisan', vidjeno === '2026-09-02 15:02:57', `got ${vidjeno}`);
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

console.log('');
console.log('row_hash: profil ga smije sakriti, Delete? nikad:');
{
  const { ws, hdr } = await buildSheet([]);
  const colOf = (n) => { for (let c=1;c<=ws.columnCount;c++) if (String(ws.getCell(hdr,c).value??'').trim()===n) return c; return 0; };
  const hCol = colOf('row_hash'), dCol = colOf('Delete?');
  ok('zaglavlje row_hash nosi objasnjenje (biljeska)',
     !!ws.getCell(hdr, hCol).note && String(JSON.stringify(ws.getCell(hdr,hCol).note)).includes('Otisak retka'));

  // Korisnik sakrije row_hash i Delete? rukom, pa iz tog filea napravi profil.
  ws.getColumn(hCol).hidden = true;
  ws.getColumn(dCol).hidden = true;
  const prof = readProfileFromWorkbook(ws.workbook);
  const hKey = prof.columns.find(c => c.key === 'row_hash');
  ok('profil je zapamtio row_hash kao skriven', !!hKey && hKey.hidden === true);
  // ⚠ Ovo je pravilo, ne detalj: `Delete?` je okidac brisanja i mora ostati vidljiv.
  ok('profil NIJE zapamtio Delete?', !prof.columns.some(c => String(c.key).includes('Delete')));

  // Primjena na svjez list: row_hash se skriva, Delete? ostaje vidljiv.
  const fresh = await buildSheet([]);
  applyProfileToWorkbook(fresh.ws.workbook, prof, [], {});
  const fCol = (n) => { for (let c=1;c<=fresh.ws.columnCount;c++) if (String(fresh.ws.getCell(fresh.hdr,c).value??'').trim()===n) return c; return 0; };
  ok('primjena profila SAKRIVA row_hash', fresh.ws.getColumn(fCol('row_hash')).hidden === true);
  ok('primjena profila OSTAVLJA Delete? vidljiv', !fresh.ws.getColumn(fCol('Delete?')).hidden);
}

rmSync(out, { force: true });
console.log('');
console.log(`${fail===0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail===0?0:1);
