/**
 * Dropdowni na PRAZNIM RETCIMA delta sheeta (S130).
 *
 * /!\ STO OVAJ TEST CUVA
 *   Prazni retci ispod glavnog bloka su jedino mjesto gdje covjek UPISUJE nove
 *   transakcije. Do S130 im je `addDeltaHelpersTo` dodjeljivao validaciju tako
 *   da PREPISE `dataValidation` zadnjeg povijesnog retka. Za statican popis
 *   (`Tip`) to prolazi, ali `Podtip` je `depends_on` i njegova formula nosi
 *   APSOLUTNU adresu roditeljske celije:
 *       INDIRECT("Dep_tip_"&SUBSTITUTE(N18,...))
 *   Kopija je zato svakom praznom retku nudila podtipove `Tipa` sa ZADNJEG
 *   POVIJESNOG retka. Izmjereno prije popravka: pet praznih redaka, svih pet
 *   gleda `N18`.
 *
 * /!\ ZASTO POVIJESNI RETCI NOSE BAS `Prihodi`
 *   Test mora razlikovati ispravan od pokvarenog koda, a to moze samo ako se
 *   ono sto pokvareni kod proizvodi razlikuje od ocekivanog (v. CLAUDE.md,
 *   S129). Da zadnji povijesni redak nosi isti `Tip` koji covjek upisuje u
 *   prazan, pokvarena kopija bi ponudila TOCNU listu i test bi prosao nad
 *   pokvarenim kodom. Zato je zadnji povijesni `Prihodi` (Placa/Povrat) — lista
 *   koju u praznom retku nitko ne treba.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'deltaBlankDv.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/deltaSheet';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"http://localhost:54321"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
    'import.meta.env.VITE_APP_ENV': '"test"',
  },
});
const { createDeltaExcel } = await import(pathToFileURL(out).href);

const CAT = 'cat1';
const catsDict = {
  [CAT]: { area_name: 'Financije_all', full_path: 'Financije_all > Transakcija', category_id: CAT },
};

const TIPOVI = ['Domacinstvo', 'Prihodi', 'Transfer', 'Zabava'];
const PODTIPI = {
  Domacinstvo: ['Rezije', 'Hrana', 'Parking'],
  Prihodi:     ['Placa', 'Povrat'],
  Transfer:    ['cash - bankomat', 'izmedju racuna'],
  Zabava:      ['Wellness', 'Kave/jelo vani'],
};

const defs = [
  { id: 'a1', category_id: CAT, name: 'Racun',   slug: 'racun',         data_type: 'text',   sort_order: 1, validation_rules: null },
  { id: 'a2', category_id: CAT, name: 'Izvor',   slug: 'izvorplacanja', data_type: 'text',   sort_order: 2, validation_rules: null },
  { id: 'a3', category_id: CAT, name: 'Uplata',  slug: 'uplata',        data_type: 'number', sort_order: 3, validation_rules: null },
  { id: 'a4', category_id: CAT, name: 'Isplata', slug: 'isplata',       data_type: 'number', sort_order: 4, validation_rules: null },
  { id: 'a5', category_id: CAT, name: 'Status',  slug: 'status',        data_type: 'text',   sort_order: 5, validation_rules: null },
  { id: 'a6', category_id: CAT, name: 'Datum naplate', slug: 'datum_naplate', data_type: 'datetime', sort_order: 6, validation_rules: null },
  { id: 'a7', category_id: CAT, name: 'Tip',     slug: 'tip',           data_type: 'text',   sort_order: 7,
    validation_rules: { type: 'suggest', options: TIPOVI } },
  { id: 'a8', category_id: CAT, name: 'Podtip',  slug: 'podtip',        data_type: 'text',   sort_order: 8,
    validation_rules: { type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: PODTIPI } } },
];

const mk = (id, date, tip, podtip, izvor = 'Racun', status = 'Izvrsen') => ({
  id, category_id: CAT, event_date: date, session_start: `${date}T09:00:00Z`,
  created_at: `${date}T09:00:01Z`, user_email: 'k@x.com', user_id: 'u1', comment: `redak ${id}`,
  event_attributes: [
    { attribute_definition_id: 'a1', value_text: 'ZABA' },
    { attribute_definition_id: 'a2', value_text: izvor },
    { attribute_definition_id: 'a4', value_number: 3.2 },
    { attribute_definition_id: 'a5', value_text: status },
    { attribute_definition_id: 'a7', value_text: tip },
    { attribute_definition_id: 'a8', value_text: podtip },
  ],
});

const BLANKS = 5;

async function buildSheet(main, planned = []) {
  const { buffer } = await createDeltaExcel(main, defs, catsDict, {
    groupLabel: 'ZABA',
    opening: { amount: 12784.36, asOf: '2026-08-26' },
    anchor:  { amount: 12784.36, confirmed_on: '2026-08-26' },
    plusSlug: 'uplata', minusSlug: 'isplata',
    filters: [
      { op: 'in',     slug: 'izvorplacanja', values: ['Racun'] },
      { op: 'not_in', slug: 'status',        values: ['Planiran'] },
    ],
    blankRows: BLANKS, prefill: { Racun: 'ZABA', Izvor: 'Racun' },
    areaName: 'Financije_all', categoryPath: 'Financije_all > Transakcija',
    userEmail: 'k@x.com',
  }, null, planned);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('Events');
  let hdr = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (String(ws.getCell(r, 1).value ?? '').trim() === 'event_id') { hdr = r; break; }
  }
  const colOf = (n) => {
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = String(ws.getCell(hdr, c).value ?? '').trim();
      if (v === n || v.startsWith(n + ' (')) return c;
    }
    return 0;
  };
  return { ws, hdr, cTip: colOf('Tip'), cPodtip: colOf('Podtip'), cDue: colOf('Datum naplate') };
}

const dvOf = (ws, r, c) => ws.getCell(r, c).dataValidation ?? null;
const refsIn = (dv) => (((dv && dv.formulae) || [])[0] || '').match(/\b[A-Z]{1,2}\d+\b/g) || [];
const colLtr = (c) => String.fromCharCode(64 + c);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' | ' + extra : '')); }
};

console.log('');
console.log('Prazni retci ispod glavnog bloka (3 povijesna, zadnji nosi `Prihodi`):');
{
  const main = [
    mk('m1', '2026-08-27', 'Domacinstvo', 'Parking'),
    mk('m2', '2026-08-28', 'Zabava',      'Wellness'),
    mk('m3', '2026-08-29', 'Prihodi',     'Placa'),   // <- zadnji povijesni
  ];
  const planned = [mk('p1', '2026-09-05', 'Domacinstvo', 'Hrana', 'Mastercard', 'Planiran')];
  const { ws, hdr, cTip, cPodtip, cDue } = await buildSheet(main, planned);

  const lastHist  = hdr + main.length;
  const blankFrom = lastHist + 1;
  const blankTo   = lastHist + BLANKS;

  ok('zadnji povijesni redak stvarno nosi `Prihodi` (inace test ne mjeri nista)',
     String(ws.getCell(lastHist, cTip).value || '') === 'Prihodi',
     'nasao "' + ws.getCell(lastHist, cTip).value + '"');

  let tipOk = 0, ownRef = 0, frozenRef = 0, dueOk = 0;
  for (let r = blankFrom; r <= blankTo; r++) {
    const tipDv = dvOf(ws, r, cTip);
    if (tipDv && String(((tipDv.formulae) || [])[0] || '').includes('Domacinstvo')) tipOk++;

    const refs = refsIn(dvOf(ws, r, cPodtip));
    if (refs.length === 1 && refs[0] === colLtr(cTip) + r) ownRef++;
    if (refs.includes(colLtr(cTip) + lastHist)) frozenRef++;

    const dueDv = dvOf(ws, r, cDue);
    if (dueDv && dueDv.type === 'date') dueOk++;
  }

  ok('svih ' + BLANKS + ' praznih ima dropdown za Tip', tipOk === BLANKS, tipOk + '/' + BLANKS);
  ok('svih ' + BLANKS + ' praznih ima Podtip vezan na VLASTITI Tip', ownRef === BLANKS, ownRef + '/' + BLANKS);
  ok('nijedan prazan redak ne gleda Tip zadnjeg povijesnog retka',
     frozenRef === 0, 'zamrznutih: ' + frozenRef + '/' + BLANKS);
  ok('svih ' + BLANKS + ' praznih ima provjeru datuma na `Datum naplate`', dueOk === BLANKS, dueOk + '/' + BLANKS);

  // Sekciju „planirano" pise isti pisac retka — mora nositi svoju adresu.
  // Raspored: prazni retci, 3 retka kontrole kosare, redak-razdjelnik.
  const planRow = blankTo + 4;
  const pRefs = refsIn(dvOf(ws, planRow, cPodtip));
  ok('redak sekcije „planirano" gleda vlastiti Tip',
     pRefs.length === 1 && pRefs[0] === colLtr(cTip) + planRow,
     'nasao ' + (pRefs.join(',') || '(nista)') + ' na retku ' + planRow);
}

console.log('');
console.log('Usklaen racun (glavni blok PRAZAN — nema predloska za kopiranje):');
{
  const { ws, hdr, cTip, cPodtip } = await buildSheet([], []);
  const blankFrom = hdr + 1;
  const blankTo   = hdr + BLANKS;

  let tipOk = 0, ownRef = 0;
  for (let r = blankFrom; r <= blankTo; r++) {
    const tipDv = dvOf(ws, r, cTip);
    if (tipDv && String(((tipDv.formulae) || [])[0] || '').includes('Domacinstvo')) tipOk++;
    const refs = refsIn(dvOf(ws, r, cPodtip));
    if (refs.length === 1 && refs[0] === colLtr(cTip) + r) ownRef++;
  }
  ok('svih ' + BLANKS + ' praznih ima dropdown za Tip', tipOk === BLANKS, tipOk + '/' + BLANKS);
  ok('svih ' + BLANKS + ' praznih ima Podtip vezan na vlastiti Tip', ownRef === BLANKS, ownRef + '/' + BLANKS);
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
