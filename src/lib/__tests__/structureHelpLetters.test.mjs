/**
 * S160 — slova stupaca u pomocnom listu `HelpStructure` moraju odgovarati
 * stupcima u kojima zaglavlja STVARNO stoje na listu `Structure`.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Pomocni list je slova pisao rucno i zaostao je jedan stupac od umetanja
 *   `HiddenInAdd` (K): pisalo je „O TextOptions", a opcije su u P. Nadjeno
 *   u T-S160-3 — upute iz filea poslale su covjeka u krivi stupac.
 *   Isti razred kao EXCEL_FORMAT_ANALYSIS (S139): popis kolona ima SAMO `COLS`.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const out = join(process.cwd(), 'node_modules', '.cache', 'structureHelpLetters.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export { exportStructureExcel } from './src/lib/structureExcel';",
           resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out,
  external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000', VITE_APP_ENV: 'test',
    }),
  },
});
const { exportStructureExcel } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const buf = await exportStructureExcel([], {});
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const ws = wb.getWorksheet('Structure');
const help = wb.getWorksheet('HelpStructure');
ok('oba lista postoje', !!ws && !!help);

// Zaglavlje lista Structure: redak u kojem kolona A kaze `Type`.
const headerAt = new Map();   // naslov -> slovo
ws.eachRow((row) => {
  if (String(row.getCell(1).value ?? '') !== 'Type' || headerAt.size) return;
  row.eachCell((cell) => headerAt.set(String(cell.value), cell.address.replace(/\d+$/, '')));
});
ok('zaglavlje nadjeno', headerAt.size >= 20, String(headerAt.size));

// Retci reference u pomocnom listu: „P  TextOptions/Val.Min".
let checked = 0;
const wrong = [];
help.eachRow((row) => {
  row.eachCell((cell) => {
    const m = /^([A-Z]{1,2})\s{2}(.+)$/.exec(String(cell.value ?? ''));
    if (!m || !headerAt.has(m[2])) return;
    checked++;
    if (headerAt.get(m[2]) !== m[1]) wrong.push(`${m[2]}: pise ${m[1]}, stoji u ${headerAt.get(m[2])}`);
  });
});
ok('pomocni list navodi stupce', checked >= 20, String(checked));
ok('svako slovo odgovara stupcu na listu Structure', wrong.length === 0, wrong.join('; '));
ok('TextOptions je u P (stanje 04.10.2026.)', headerAt.get('TextOptions/Val.Min') === 'P');

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
