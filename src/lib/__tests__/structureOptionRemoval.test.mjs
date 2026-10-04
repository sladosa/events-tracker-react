/**
 * S160 — K-1: koje opcije Structure uvoz BRISE iz izbornika.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Uvoz pravilo zamjenjuje u cijelosti („file pobjeduje", T-S152-1), pa opcija
 *   maknuta iz filea nestane iz baze. Brana prije upisa broji retke po opciji
 *   koju `removedOptions` vrati — promasi li ona opciju, brana sutke propusti
 *   brisanje; izmisli li je, uvoz staje bez razloga i covjek nauci otklikati.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'optionRemoval.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { removedOptions, allOptions } from './src/lib/validationRules';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { removedOptions } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const sug = (...o) => ({ type: 'suggest', suggest: o });
const dep = (map) => ({ type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: map } });

ok('suggest: maknuta opcija se javlja', eq(removedOptions(sug('A', 'B', 'C'), sug('A', 'C')), ['B']));
ok('suggest: dodana opcija nije brisanje', removedOptions(sug('A'), sug('A', 'B')).length === 0);
ok('suggest: isti popis drugim redom nije brisanje', removedOptions(sug('A', 'B'), sug('B', 'A')).length === 0);
ok('depends_on: opcija maknuta iz jedne liste', eq(
  removedOptions(dep({ Auto: ['gorivo', 'servis'], Hrana: ['ducan'] }), dep({ Auto: ['gorivo'], Hrana: ['ducan'] })), ['servis']));
ok('depends_on: cijeli WhenValue maknut', eq(
  removedOptions(dep({ Auto: ['gorivo'], Hrana: ['ducan'] }), dep({ Auto: ['gorivo'] })), ['ducan']));
ok('depends_on: opcija preseljena pod drugi WhenValue nije brisanje iz izbornika', removedOptions(
  dep({ A: ['x'], B: [] }), dep({ A: [], B: ['x'] })).length === 0);
ok('suggest → depends_on: opcija koja je ostala u mapi nije brisanje', removedOptions(
  sug('x', 'y'), dep({ A: ['x'], B: ['y'] })).length === 0);
ok('sve maknuto (pravilo prazno)', eq(removedOptions(sug('A', 'B'), {}), ['A', 'B']));
ok('stara baza bez pravila', removedOptions(null, sug('A')).length === 0);
ok('pravilo kao JSON string (stari zapis)', eq(removedOptions(JSON.stringify(sug('A', 'B')), sug('A')), ['B']));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
