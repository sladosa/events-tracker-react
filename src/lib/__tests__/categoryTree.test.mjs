/**
 * S162 — stablo kategorija iz `categoryCache` umjesto upita po razini.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Lista, raspon datuma i „Filter by" su do S162 svaki svojim upitima tražili
 *   id-jeve Aree, potomke i leaf (3 serijska kruga prije upita liste). Sada su
 *   to čiste funkcije nad mapom iz memorije — i moraju dati ISTI odgovor kao
 *   stari upiti, inače lista tiho pokaže krive retke.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'categoryTree.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/categoryTree';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { areaCategoryIds, descendantIds, ancestorIds, leafOnly } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        dobio ${g}\n        htio  ${w}`); }
};
const sorted = a => [...a].sort();

// Fitness-oblik (3 razine) + Financije-oblik (leaf na L1) + druga Area.
const rows = [
  { id: 'fit',     area_id: 'A', parent_category_id: null },
  { id: 'cardio',  area_id: 'A', parent_category_id: 'fit' },
  { id: 'run',     area_id: 'A', parent_category_id: 'cardio' },
  { id: 'bike',    area_id: 'A', parent_category_id: 'cardio' },
  { id: 'gym',     area_id: 'A', parent_category_id: 'fit' },
  { id: 'tx',      area_id: 'F', parent_category_id: null },
  { id: 'otherL1', area_id: 'B', parent_category_id: null },
];
const map = new Map(rows.map(r => [r.id, { ...r, name: r.id }]));

console.log('areaCategoryIds:');
eq('sve razine Aree A', sorted(areaCategoryIds(map, 'A')), sorted(['fit', 'cardio', 'run', 'bike', 'gym']));
eq('Area bez kategorija ⇒ []', areaCategoryIds(map, 'nema'), []);

console.log('leafOnly:');
eq('leaf Aree A', sorted(leafOnly(map, areaCategoryIds(map, 'A'))), ['bike', 'gym', 'run']);
eq('Financije: L1 leaf ostaje', leafOnly(map, areaCategoryIds(map, 'F')), ['tx']);

console.log('descendantIds:');
eq('cardio + djeca, sam prvi', descendantIds(map, 'cardio'), ['cardio', 'run', 'bike']);
eq('leaf ⇒ samo on (lista: isLeafCategory)', descendantIds(map, 'run'), ['run']);
eq('nepoznat id ⇒ samo on (kao stari upit bez djece)', descendantIds(map, 'x'), ['x']);
eq('cijelo stablo', sorted(descendantIds(map, 'fit')), sorted(['fit', 'cardio', 'run', 'bike', 'gym']));

console.log('ancestorIds:');
eq('run ⇒ run, cardio, fit', ancestorIds(map, 'run'), ['run', 'cardio', 'fit']);
eq('korijen ⇒ sam', ancestorIds(map, 'tx'), ['tx']);

console.log('ciklus u podacima ne vrti petlju:');
const cyc = new Map([
  ['a', { id: 'a', area_id: 'Z', parent_category_id: 'b', name: 'a' }],
  ['b', { id: 'b', area_id: 'Z', parent_category_id: 'a', name: 'b' }],
]);
eq('descendantIds', sorted(descendantIds(cyc, 'a')), ['a', 'b']);
eq('ancestorIds', ancestorIds(cyc, 'a'), ['a', 'b']);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
