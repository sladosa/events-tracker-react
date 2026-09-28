/**
 * S154 — `+` na Arei s JEDNIM leafom ide ravno na taj leaf.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Koka je zatjecala filtar na `Financije_all > All Categories` i sivi `+`.
 *   `Financije_all` ima jedan leaf (`Transakcija`), pa pitanje „u koju
 *   kategoriju?" ondje nema dva odgovora. Obrnuto je jednako vazno: Area s
 *   DVA leafa ne smije pogadjati — pogresna kategorija je gora od pitanja.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'singleLeaf.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { findSingleLeaf, categoryNamePath } from './src/lib/singleLeaf';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { findSingleLeaf, categoryNamePath } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const c = (id, name, area, parent = null) => ({ id, name, area_id: area, parent_category_id: parent });
const CATS = [
  // Financije_all: jedan leaf na L1
  c('tx', 'Transakcija', 'fin'),
  // Fitness: roditelj s dva leafa + roditelj s jednim leafom (dvije razine)
  c('gym', 'Gym', 'fit'),
  c('str', 'Strength', 'fit', 'gym'),
  c('car', 'Cardio', 'fit', 'gym'),
  c('out', 'Outdoor', 'fit'),
  c('hike', 'Hiking', 'fit', 'out'),
  c('trail', 'Trail', 'fit', 'hike'),
  // Area bez kategorija: 'prazna'
];
const map = new Map(CATS.map(x => [x.id, x]));

console.log('');
console.log('Jedan leaf => ide na njega:');
ok('Area s jednim leafom (Financije_all)', findSingleLeaf(CATS, 'fin', null) === 'tx');
ok('roditelj s jednim leafom dvije razine nize', findSingleLeaf(CATS, 'fit', 'out') === 'trail');
ok('medjurazina s jednim leafom', findSingleLeaf(CATS, 'fit', 'hike') === 'trail');
ok('odabran sam leaf => on', findSingleLeaf(CATS, 'fit', 'str') === 'str');

console.log('');
console.log('Vise od jednog ili nijedan => ne pogadja:');
ok('Area s tri leafa', findSingleLeaf(CATS, 'fit', null) === null);
ok('roditelj s dva leafa', findSingleLeaf(CATS, 'fit', 'gym') === null);
ok('Area bez kategorija', findSingleLeaf(CATS, 'prazna', null) === null);
ok('bez Aree i kategorije', findSingleLeaf(CATS, null, null) === null);
ok('nepoznata kategorija', findSingleLeaf(CATS, 'fit', 'nema') === null);
ok('kategorija druge Aree istog imena ne ulazi u brojanje',
   findSingleLeaf([...CATS, c('tx2', 'Transakcija', 'fin_old')], 'fin', null) === 'tx');

console.log('');
console.log('Putanja (bez Aree):');
ok('L1 leaf', JSON.stringify(categoryNamePath(map, 'tx')) === '["Transakcija"]');
ok('L3 leaf', JSON.stringify(categoryNamePath(map, 'trail')) === '["Outdoor","Hiking","Trail"]');

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
