/**
 * Pokrece SVE `*.test.mjs` iz `src/` i vraca exit 1 ako ijedan padne.
 *
 * Zasto postoji: do S139 tih je testova bilo 11, svi su prolazili, i NISTA ih
 * nije pokretalo -- ni npm skripta ni CI (koji vrti samo typecheck + build).
 * Guard koji nitko ne zove ne cuva nista.
 *
 * /!\ Provjerava i NESUKLADNOST: file koji ispise pad a zavrsi s exit 0
 *     prijavljuje se kao POKVAREN TEST, ne kao prolaz. Bez toga bi ovaj runner
 *     ponovio tocno kvar zbog kojeg je nastao -- `structureExcel.test.mjs` je
 *     brojao padove u `failed` i nikad ga nije procitao, pa je ispisivao kriz i
 *     izlazio s 0 (izmjereno sabotazom jedne tvrdnje, S139).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const CROSS = String.fromCharCode(10060);   // kriz -- bez literala u izvoru
const NL = String.fromCharCode(10);

function findTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...findTests(p));
    else if (name.endsWith('.test.mjs')) out.push(p);
  }
  return out;
}

const files = findTests(SRC).sort();
if (files.length === 0) {
  console.error('Nijedan *.test.mjs nije nadjen u src/ -- to je vjerojatno kvar runnera.');
  process.exit(1);
}

const FAILY = new RegExp(CROSS + '|' + '\bFAIL');
const ERRY = new RegExp(CROSS + '|' + '\bFAIL|Error');
const TICK = new RegExp(String.fromCharCode(9989), 'g');

let failed = 0;
let broken = 0;

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  const output = (r.stdout || '') + (r.stderr || '');

  if (r.status !== 0) {
    failed++;
    console.log('PAO       ' + rel);
    const why = output.split(NL).filter((l) => ERRY.test(l)).slice(0, 6);
    if (why.length) console.log(why.join(NL));
  } else if (FAILY.test(output)) {
    broken++;
    console.log('POKVAREN  ' + rel + '  -- ispisuje pad, a izlazi s exit 0');
  } else {
    const n = (output.match(TICK) || []).length;
    console.log('ok        ' + rel + (n ? '  (' + n + ')' : ''));
  }
}

console.log(NL + files.length + ' fileova / ' + failed + ' palo / ' + broken + ' pokvarenih');
process.exit(failed + broken ? 1 : 0);
