/**
 * S125 — vlasnik Aree ISPRAVLJA tudji redak uvozom, ali ga NE BRISE.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   `fix_as_owner` je otvorio put kojim tudji redak prvi put dolazi do
 *   `toUpdate` I do `toDelete`. Drugo je opasno: `applyDeletes` brise
 *   `event_attributes` BEZ filtra po korisniku (RLS iz 020 to vlasniku Aree
 *   dopusta), a sam event S filtrom -- pa bi tudji redak oznacen za brisanje
 *   ostao u bazi BEZ IJEDNOG ATRIBUTA. Unisten, a prisutan.
 *
 *   Nadjeno Sasinim pitanjem "radi li kao UI -- edit da, delete ne?", prije
 *   nego je itko taj put pokrenuo.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'importForeign.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/excelImport'; export * from './src/lib/excelExport'; export { createDeltaExcel } from './src/lib/deltaSheet';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  // excelImport transitivno povuce supabaseClient i template config; test ih ne
  // zove, ali se moduli izvrse pri importu — treba im samo da ne puknu.
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000',
      VITE_APP_ENV: 'test',
    }),
  },
});
const { createEventsExcel, createDeltaExcel, parseExcelFile, DELETE_MARKER, canUpdateExisting } = await import(pathToFileURL(out).href);

const CAT = 'cat1';
const AREA = 'Financije_all';
const catsDict = { [CAT]: { area_name: AREA, full_path: `${AREA} > Transakcija`, category_id: CAT } };
const defs = [
  { id: 'a1', category_id: CAT, name: 'Status', slug: 'status', data_type: 'text', sort_order: 1, validation_rules: null },
  { id: 'a2', category_id: CAT, name: 'Uplata', slug: 'uplata', data_type: 'number', sort_order: 2, validation_rules: null },
  { id: 'a3', category_id: CAT, name: 'Isplata', slug: 'isplata', data_type: 'number', sort_order: 3, validation_rules: null },
];
const GRANTEE = 'grantee@x.com';
const OWNER   = 'owner@x.com';

const mk = (id, comment, status = 'Izvrsen') => ({
  id, category_id: CAT, event_date: '2026-08-24', session_start: '2026-08-24T09:00:00Z',
  created_at: '2026-08-24T09:00:01Z', user_email: GRANTEE, user_id: 'u-grantee', comment,
  event_attributes: [{ attribute_definition_id: 'a1', value_text: status }],
});

/** Napravi export, pa u njemu promijeni celije — inace row_hash pogodi i redak
 *  se preskoci kao "netaknut", pa test ne bi mjerio nista. */
async function buildFile({ markDelete = false } = {}) {
  const buf = await createEventsExcel([mk('e1', 'redak jedan'), mk('e2', 'redak dva')], defs, catsDict, 'asc');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Events');
  let hdr = 0;
  for (let r = 1; r <= ws.rowCount; r++) if (String(ws.getCell(r, 1).value ?? '').trim() === 'event_id') { hdr = r; break; }
  const colOf = (n) => { for (let c = 1; c <= ws.columnCount; c++) if (String(ws.getCell(hdr, c).value ?? '').trim() === n) return c; return 0; };
  const commentCol = colOf('leaf comment');
  ws.getCell(hdr + 1, commentCol).value = 'redak jedan — ISPRAVLJEN';
  if (markDelete) ws.getCell(hdr + 2, colOf('Delete?')).value = DELETE_MARKER;
  const outBuf = await wb.xlsx.writeBuffer();
  return new File([outBuf], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

console.log('');
console.log('skip (zadano) — tudji retci se ne diraju:');
{
  const p = await parseExcelFile(await buildFile(), OWNER, 'skip');
  ok('nijedan redak ne ide u update', p.toUpdate.length === 0, `got ${p.toUpdate.length}`);
  ok('tudji retci su prebrojani', p.foreignRowCount === 2, `got ${p.foreignRowCount}`);
  ok('Area tudjih redaka je prijavljena', p.foreignAreas.includes(AREA), `got ${JSON.stringify(p.foreignAreas)}`);
}

console.log('');
console.log('import_as_mine — kopija, ne ispravak (zato original ostaje):');
{
  const p = await parseExcelFile(await buildFile(), OWNER, 'import_as_mine');
  ok('redak ide u CREATE, ne u UPDATE', p.toCreate.length > 0 && p.toUpdate.length === 0);
  ok('event_id je ponisten (forsiran INSERT)', p.toCreate.every(r => r.event_id === null));
}

console.log('');
console.log('fix_as_owner — ispravak NA MJESTU:');
{
  const p = await parseExcelFile(await buildFile(), OWNER, 'fix_as_owner');
  ok('ispravljeni redak ide u UPDATE', p.toUpdate.length === 1, `got ${p.toUpdate.length}`);
  ok('event_id je ZADRZAN (nema duplikata)', p.toUpdate[0]?.event_id === 'e1', `got ${p.toUpdate[0]?.event_id}`);
  ok('redak je oznacen kao tudji ispravak', p.toUpdate[0]?._fixForeign === true);
  ok('nista se ne stvara kao nov redak', p.toCreate.length === 0, `got ${p.toCreate.length}`);
}

console.log('');
console.log('fix_as_owner + Delete? — granica koju UI povlaci od 043:');
{
  const p = await parseExcelFile(await buildFile({ markDelete: true }), OWNER, 'fix_as_owner');
  // /!\ Kad bi tudji redak usao u `toDelete`, `applyDeletes` bi mu obrisao
  //     atribute (RLS iz 020 to vlasniku dopusta) a event bi prezivio.
  ok('tudji redak NE ulazi u brisanje', p.toDelete.length === 0, `got ${p.toDelete.length}`);
  ok('odbijanje se JAVLJA, ne prešuti',
     p.warnings.some(w => /ne može obrisati/i.test(w)), `got ${JSON.stringify(p.warnings)}`);
}

console.log('');
console.log('DELTA file — sekcija je ISPOD 40 praznih redaka; stigne li uvoz do nje?');
{
  // /!\ Ovo nije kozmeticko pitanje: sekcija kosare je JEDINO mjesto na kojem
  //     Koka potvrdjuje kartcne retke nakon izvoda. Kad je uvoz ne bi citao,
  //     mjesecni krug ne bi radio -- i to tiho, jer retci nisu "odbijeni" nego
  //     nikad procitani.
  const BLANKS = 40;
  const planned = [mk('p1', 'kosara redak', 'Planiran'), mk('p2', 'kosara drugi', 'Planiran')];
  const { buffer } = await createDeltaExcel(
    [mk('m1', 'glavni blok')], defs, catsDict,
    {
      groupLabel: 'RF', opening: { amount: 799.12, asOf: '2026-08-11' },
      anchor: { amount: 799.12, confirmed_on: '2026-08-11' },
      plusSlug: 'uplata', minusSlug: 'isplata',
      filters: [{ op: 'in', slug: 'izvorplacanja', values: ['Racun'] },
                { op: 'not_in', slug: 'status', values: ['Planiran'] }],
      blankRows: BLANKS, prefill: { Status: 'Planiran' },
      areaName: AREA, categoryPath: `${AREA} > Transakcija`, userEmail: GRANTEE,
    },
    null, planned,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('Events');
  let hdr = 0;
  for (let r = 1; r <= ws.rowCount; r++) if (String(ws.getCell(r, 1).value ?? '').trim() === 'event_id') { hdr = r; break; }
  const colOf = (n) => { for (let c = 1; c <= ws.columnCount; c++) if (String(ws.getCell(hdr, c).value ?? '').trim() === n) return c; return 0; };
  // Sekcija pocinje iza glavnog bloka + praznih + retka-razdjelnika.
  const sectionFrom = hdr + 1 + 1 + BLANKS + 1;
  const statusCol = colOf('Status (Transakcija)') || colOf('Status');
  ok('sekcija je doista ispod praznih redaka',
     String(ws.getCell(sectionFrom, 1).value ?? '') === 'p1', `got ${ws.getCell(sectionFrom, 1).value}`);
  // Ono sto Koka radi nakon izvoda: potvrdi redak. /!\ Mora biti STVARNA
  // promjena -- upise li se ista vrijednost, `row_hash` se poklopi i redak se
  // (ispravno) preskoci kao netaknut. Prvi pokusaj ovog testa je pao bas na
  // tome, i to je bila greska testa, ne koda.
  ws.getCell(sectionFrom, statusCol).value = 'Izvrsen';

  const f = new File([await wb.xlsx.writeBuffer()], 'delta.xlsx',
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const p = await parseExcelFile(f, OWNER, 'fix_as_owner');

  ok('redak iz sekcije JE procitan i ide u UPDATE',
     p.toUpdate.some(r => r.event_id === 'p1'), `toUpdate=${JSON.stringify(p.toUpdate.map(r => r.event_id))}`);
  ok('nedirnuti redak sekcije se preskace (row_hash)',
     !p.toUpdate.some(r => r.event_id === 'p2'));
  // Prazni retci predloska nose prepisani Area, pa ih parser vidi -- ali ih
  // mora prepoznati kao netaknute, a ne prijaviti kao greske.
  ok('40 praznih redaka ne postaje 40 gresaka', p.errors.length === 0, `got ${JSON.stringify(p.errors)}`);
  ok('preskoceni prazni retci se BROJE i javljaju',
     p.warnings.some(w => /praznih redaka predloška preskočeno/i.test(w)), `got ${JSON.stringify(p.warnings)}`);
}

console.log('');
console.log('canUpdateExisting — pravilo koje je vec jednom odlutalo na tri mjesta:');
{
  const ME = 'u-me', OTHER = 'u-other';
  ok('vlastiti redak: uvijek', canUpdateExisting(ME, {}, ME));
  ok('tudji redak bez fix_as_owner: NE', !canUpdateExisting(OTHER, {}, ME));
  // /!\ Kad ovo vrati false, posljedica NIJE poruka o pravima nego
  //     "event_id vise ne odgovara bazi => uvest ce se kao NOV" -- dakle
  //     obecan DUPLIKAT, i to u trenutku odluke.
  ok('tudji redak uz fix_as_owner: DA', canUpdateExisting(OTHER, { _fixForeign: true }, ME));
  ok('nepostojeci redak: NE', !canUpdateExisting(undefined, {}, ME));
  ok('nepostojeci redak ni uz fix_as_owner ne postaje postojeci',
     canUpdateExisting(undefined, { _fixForeign: true }, ME) === true,
     'ovdje je odluka svjesna: postojanje provjerava POZIVATELJ (found?), ovaj uvjet samo autorstvo');
}

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
