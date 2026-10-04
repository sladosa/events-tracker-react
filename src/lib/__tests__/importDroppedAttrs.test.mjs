/**
 * S160 — D3 minimum: uvoz mora IMENOVATI vrijednosti koje nece upisati.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   D3 pokus (S159, 03.10. TEST): file tudje Aree uvezen u istoimenu Areu
 *   drukcije strukture ⇒ pregled „10 novih", uvoz „10 created", a stiglo 29 od
 *   43 vrijednosti. `Lokacija` (7) i `Datum kontrole` (7) odbaceni bez rijeci,
 *   jer apply atribut kojeg kategorija nema preskoci (`if (!def) continue`).
 *
 * ⚠ Atribut na RODITELJU nije izgubljen (P1) — apply ga upise u parent event.
 *   Test to mjeri, inace bi upozorenje lagalo za svaki P1 atribut.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'importDropped.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { findDroppedAttributes, droppedAttributesWarning } from './src/lib/excelImport';",
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
const { findDroppedAttributes, droppedAttributesWarning } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

// Area `D3 Pokus`: L1 `Pregledi` (atribut `Ustanova`) > leaf `Lab` (atribut `Vrsta`)
// Druga Area s istom putanjom: `Druga` > `Pregledi > Lab`, atribut `Lokacija` — NE smije pokriti prvu.
const cat = (id, area, full, level, parent) => ({ id, name: full.split(' > ').pop(), full_path: full,
  area_id: area, area_name: area, level, parent_category_id: parent, sort_order: 0 });
const dict = {
  p1: cat('p1', 'D3 Pokus', 'Pregledi', 1, null),
  l1: cat('l1', 'D3 Pokus', 'Pregledi > Lab', 2, 'p1'),
  p2: cat('p2', 'Druga', 'Pregledi', 1, null),
  l2: cat('l2', 'Druga', 'Pregledi > Lab', 2, 'p2'),
};
const def = (category_id, name) => ({ id: `${category_id}-${name}`, category_id, name });
const defs = [def('p1', 'Ustanova'), def('l1', 'Vrsta'), def('l2', 'Lokacija')];

const row = (n, attributes, o = {}) => ({ event_id: null, area: 'D3 Pokus', category_path: 'Pregledi > Lab',
  event_date: '2026-10-01', session_start: '09:00', created_at: '', comment: '', attributes, _source_row: n, ...o });

const rows = [
  row(20, { Vrsta: 'Krv', Ustanova: 'KBC', Lokacija: 'Zagreb', 'Datum kontrole': '2026-11-01' }),
  row(21, { Vrsta: 'Urin', Lokacija: 'Split' }),
  row(22, { Lokacija: '', 'Datum kontrole': '_' }),           // prazno i `_` ne nose vrijednost
  row(23, { Lokacija: 'Rijeka' }, { category_path: 'Nema > Ovoga' }), // putanju javlja validacija
];
const d = findDroppedAttributes(rows, dict, defs);
const by = Object.fromEntries(d.map(x => [x.attrName, x]));

ok('atribut kojeg Area nema se javlja', by['Lokacija']?.count === 2, JSON.stringify(by['Lokacija']));
ok('… s brojevima redova', JSON.stringify(by['Lokacija']?.rows) === '[20,21]');
ok('drugi nepoznat atribut zasebno', by['Datum kontrole']?.count === 1);
ok('atribut LEAFA nije izgubljen', !by['Vrsta']);
ok('atribut RODITELJA (P1) nije izgubljen', !by['Ustanova']);
ok('istoimena putanja DRUGE Aree ne pokriva ovu', by['Lokacija']?.area === 'D3 Pokus');
ok('prazno, `_` i nepostojeca putanja se ne broje', d.reduce((s, x) => s + x.count, 0) === 3);

ok('nema izgubljenih ⇒ nema poruke', droppedAttributesWarning([]) === null);
const msg = droppedAttributesWarning(d) ?? '';
ok('poruka imenuje atribut, Areu i ukupan broj', msg.includes("'Lokacija'") && msg.includes("'D3 Pokus'") && msg.startsWith('3 '), msg);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
