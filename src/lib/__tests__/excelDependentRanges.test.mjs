/**
 * Excel izbornik OVISNOG atributa kad o ISTOM roditelju ovise dva atributa (BUG-S181-DEPNAME).
 *
 * /!\ STO OVAJ TEST CUVA
 *   Ime imenovanog raspona nosilo je samo slug RODITELJA (`Dep_tip_<Tip>`). Od S180
 *   o Tipu ovise i Podtip i Namjena, pa su dijelili imena: Namjena je nudila
 *   Podtipove, a `Dep_tip_auto_C5` je postao raspon od DVA popisa, koji Excel ne
 *   moze ponuditi — ni za Podtip. Izmjereno na TEST exportu 24.10.2026.
 *
 * /!\ KAKO MJERI
 *   Ne gleda tekst formule nego ono sto bi Excel IZRACUNAO: za svaku vrijednost
 *   Tipa (i prazan Tip) provede SUBSTITUTE lanac iz formule, nadje imenovani raspon
 *   i procita njegove opcije s lista `DropdownData`. Raspon od dva podrucja je pad.
 *
 * /!\ Namjena nosi `*` + vlastiti popis samo pod `auto C5` (kao PROD), pa test
 *   razlikuje „vlastiti popis" od „zamjene `*`" — oba popisa su ovdje RAZLICITA.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'excelDepRanges.bundle.mjs');
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

const TIPOVI = ['Domaćinstvo', 'Razno', 'auto C5', 'N/A'];
const PODTIPI = {
  '*': [],
  'Domaćinstvo': ['Režije', 'Hrana i ostalo'],
  'Razno': ['Pokloni', 'Temu'],
  'auto C5': ['gorivo', 'leasing'],
  'N/A': [],
};
const NAMJENA_SVI = ['Zajedničko', 'Koka', 'Saša', 'Nena / Kućište'];
const NAMJENA_C5  = ['Koka', 'Zajedničko'];          // namjerno drukčiji od `*`
const NAMJENA = { '*': NAMJENA_SVI, 'auto C5': NAMJENA_C5 };

const defs = [
  { id: 'a1', category_id: CAT, name: 'Racun',   slug: 'racun',         data_type: 'text',   sort_order: 1, validation_rules: null },
  { id: 'a2', category_id: CAT, name: 'Izvor',   slug: 'izvorplacanja', data_type: 'text',   sort_order: 2, validation_rules: null },
  { id: 'a3', category_id: CAT, name: 'Uplata',  slug: 'uplata',        data_type: 'number', sort_order: 3, validation_rules: null },
  { id: 'a4', category_id: CAT, name: 'Isplata', slug: 'isplata',       data_type: 'number', sort_order: 4, validation_rules: null },
  { id: 'a5', category_id: CAT, name: 'Status',  slug: 'status',        data_type: 'text',   sort_order: 5, validation_rules: null },
  { id: 'a7', category_id: CAT, name: 'Tip',     slug: 'tip',           data_type: 'text',   sort_order: 7,
    validation_rules: { type: 'suggest', options: TIPOVI } },
  { id: 'a8', category_id: CAT, name: 'Podtip',  slug: 'podtip',        data_type: 'text',   sort_order: 8,
    validation_rules: { type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: PODTIPI } } },
  { id: 'a9', category_id: CAT, name: 'Namjena', slug: 'namjena',       data_type: 'text',   sort_order: 9,
    validation_rules: { type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: NAMJENA } } },
];

const mk = (id, date, tip) => ({
  id, category_id: CAT, event_date: date, session_start: `${date}T09:00:00Z`,
  created_at: `${date}T09:00:01Z`, user_email: 'k@x.com', user_id: 'u1', comment: `redak ${id}`,
  event_attributes: [
    { attribute_definition_id: 'a1', value_text: 'ZABA' },
    { attribute_definition_id: 'a2', value_text: 'Racun' },
    { attribute_definition_id: 'a4', value_number: 3.2 },
    { attribute_definition_id: 'a5', value_text: 'Izvrsen' },
    { attribute_definition_id: 'a7', value_text: tip },
  ],
});

const { buffer } = await createDeltaExcel([mk('m1', '2026-08-27', 'Razno')], defs, catsDict, {
  groupLabel: 'ZABA',
  opening: { amount: 100, asOf: '2026-08-26' },
  anchor:  { amount: 100, confirmed_on: '2026-08-26' },
  plusSlug: 'uplata', minusSlug: 'isplata',
  filters: [
    { op: 'in',     slug: 'izvorplacanja', values: ['Racun'] },
    { op: 'not_in', slug: 'status',        values: ['Planiran'] },
  ],
  blankRows: 3, prefill: { Racun: 'ZABA', Izvor: 'Racun' },
  areaName: 'Financije_all', categoryPath: 'Financije_all > Transakcija',
  userEmail: 'k@x.com',
}, null, []);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer);
const ws = wb.getWorksheet('Events');
const dd = wb.getWorksheet('DropdownData');
let hdr = 0;
for (let r = 1; r <= ws.rowCount; r++) {
  if (String(ws.getCell(r, 1).value ?? '').trim() === 'event_id') { hdr = r; break; }
}
const colOf = (n) => {
  for (let c = 1; c <= 40; c++) {
    const v = String(ws.getCell(hdr, c).value ?? '').trim();
    if (v === n || v.startsWith(n + ' (')) return c;
  }
  return 0;
};
const names = new Map(wb.definedNames.model.map(n => [n.name, n.ranges]));

/** Što Excel izračuna: prefiks + SUBSTITUTE lanac nad vrijednošću Tipa ⇒ ime ⇒ opcije. */
function excelOptions(formula, tipValue) {
  const m = formula.match(/^INDIRECT\("([^"]+)"&/);
  if (!m) return { err: 'nije INDIRECT: ' + formula.slice(0, 60) };
  let s = tipValue;
  for (const p of formula.matchAll(/,"([^"]*)","([^"]*)"\)/g)) s = s.split(p[1]).join(p[2]);
  const name = m[1] + s;
  const ranges = names.get(name);
  if (!ranges) return { name, err: 'nema raspona' };
  if (ranges.length !== 1) return { name, err: `raspon od ${ranges.length} područja: ${ranges.join(' + ')}` };
  const rm = ranges[0].match(/!\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)$/);
  const opts = [];
  for (let r = +rm[2]; r <= +rm[4]; r++) opts.push(dd.getCell(`${rm[1]}${r}`).value);
  return { name, opts };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? ' | ' + extra : '')); }
};
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const row = hdr + 2;   // prvi prazan redak
const cPod = colOf('Podtip'), cNam = colOf('Namjena');
const fPod = ws.getCell(row, cPod).dataValidation?.formulae?.[0] ?? '';
const fNam = ws.getCell(row, cNam).dataValidation?.formulae?.[0] ?? '';

console.log('');
console.log('Podtip i Namjena ovise o istom Tipu:');
ok('Podtip i Namjena imaju RAZLIČIT prefiks raspona',
   fPod.split('"')[1] !== fNam.split('"')[1], `${fPod.split('"')[1]} / ${fNam.split('"')[1]}`);

for (const tip of ['Domaćinstvo', 'Razno', 'auto C5']) {
  const p = excelOptions(fPod, tip);
  ok(`Podtip pod „${tip}" = njegovi podtipovi`, p.opts && same(p.opts, PODTIPI[tip]), p.err ?? JSON.stringify(p.opts));
}
for (const tip of ['Domaćinstvo', 'Razno', 'N/A']) {
  const n = excelOptions(fNam, tip);
  ok(`Namjena pod „${tip}" = popis \`*\``, n.opts && same(n.opts, NAMJENA_SVI), n.err ?? JSON.stringify(n.opts));
}
{
  const n = excelOptions(fNam, 'auto C5');
  ok('Namjena pod „auto C5" = VLASTITI popis, ne `*`', n.opts && same(n.opts, NAMJENA_C5), n.err ?? JSON.stringify(n.opts));
  const e = excelOptions(fNam, '');
  ok('Namjena uz prazan Tip = popis `*`', e.opts && same(e.opts, NAMJENA_SVI), e.err ?? JSON.stringify(e.opts));
}
ok('nijedan imenovani raspon nema više od jednog područja',
   [...names.values()].every(r => r.length === 1),
   [...names].filter(([, r]) => r.length > 1).map(([n]) => n).join(', '));

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
