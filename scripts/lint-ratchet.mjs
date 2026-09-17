/**
 * Lint ratchet za DVA `react-hooks` pravila -- ona koja su u ovom projektu
 * dokazano kostala incidente (S111, S119/S120, S121, S129, S133).
 *
 * Zasto ratchet a ne `error`: danas ih ima 76. Tvrd gate bi zaustavio svaki
 * commit dok se svih 76 ne rijesi. Ratchet zabranjuje NOVE odmah, a postojece
 * pusta da padaju svojim tempom.
 *
 * /!\ Pada I KAD JE BROJ MANJI od baselinea -- namjerno. Baseline koji se ne
 *     spusta kad se nesto popravi tiho prestaje biti brana: sljedeca regresija
 *     stane ispod stare granice i prodje. Spustanje je jedna naredba:
 *         npm run lint:ratchet -- --update
 *     (invarijanta, ne disciplina -- isto pravilo kao `clearDraft()` u S121)
 *
 * Ostalih ~113 lint nalaza (`react-refresh`, `no-unused-vars`) ovaj alat
 * NAMJERNO ne dira: gate koji obuhvaca i kozmetiku nauci covjeka da ga zaobilazi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = join(ROOT, '.lint-baseline.json');
// /!\ `immutability` dodan u S139: bio je SKRIVEN iza `eslint-disable-next-line`
//     za DRUGO pravilo (`exhaustive-deps`) -- plugin preskoci cijeli efekt koji nosi
//     disable za bilo koje `react-hooks` pravilo. Kad je mrtva direktiva maknuta,
//     nalaz je ispilio. Mrtva suzbijanja zato nisu kozmetika nego slijepa mrlja.
const WATCHED = [
  'react-hooks/set-state-in-effect',
  'react-hooks/exhaustive-deps',
  'react-hooks/immutability',
];
const update = process.argv.includes('--update');

const eslint = new ESLint({ cwd: ROOT });
const results = await eslint.lintFiles(['.']);

const counts = Object.fromEntries(WATCHED.map((r) => [r, 0]));
const byFile = {};
for (const res of results) {
  for (const m of res.messages) {
    if (!WATCHED.includes(m.ruleId)) continue;
    counts[m.ruleId] += 1;
    const rel = res.filePath.slice(ROOT.length).split(String.fromCharCode(92)).join('/');
    byFile[rel] = (byFile[rel] || 0) + 1;
  }
}

if (update) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + String.fromCharCode(10));
  console.log('Baseline zapisan:', JSON.stringify(counts));
  process.exit(0);
}

let base;
try {
  base = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error('Nema ' + BASELINE + ' -- pokreni: npm run lint:ratchet -- --update');
  process.exit(1);
}

let worse = false;
let better = false;
for (const rule of WATCHED) {
  const now = counts[rule];
  const was = base[rule] ?? 0;
  const mark = now > was ? 'GORE' : now < was ? 'bolje' : 'isto';
  console.log(mark.padEnd(6) + rule.padEnd(36) + was + ' -> ' + now);
  if (now > was) worse = true;
  if (now < was) better = true;
}

if (worse) {
  console.log('');
  console.log('Nov nalaz u pravilu koje je ovdje vec proizvelo incidente. Po fileu:');
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + String(n).padStart(3) + '  ' + f);
  }
  process.exit(1);
}

if (better) {
  console.log('');
  console.log('Broj je pao -- spusti baseline istim commitom:');
  console.log('  npm run lint:ratchet -- --update');
  process.exit(1);
}

console.log('');
console.log('Bez promjene.');
