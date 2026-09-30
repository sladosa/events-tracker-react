/**
 * S155 C5 faza 1 — kosara protiv bankinog broja.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Tolerancija je 0,00 (odluka D3: MC se slaze u cent 4 od 4, a svaka
 *   tolerancija bi progutala naknadu od 1,32). Uz toleranciju nula, zbroj
 *   decimala u floatu (`0,1 + 0,2`) bi zelenu kosaru obojao kao razliku —
 *   isti kvar koji je u S112 bojao crveno savrseno uskladjen Excel.
 *   I: prazno/necitljivo polje ne smije tvrditi NISTA — ni „slaze se" ni
 *   razliku jednaku cijeloj kosari.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'dueBaskets.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/dueBaskets';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { basketNetCents, compareWithBank } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

console.log('');
console.log('Sigma kosare je NETO, u lipama:');
ok('MC 11.09. (bez povrata)', basketNetCents({ gross_plus: 0, gross_minus: 1068.70 }) === 106870);
ok('povrat umanjuje naplatu (ZABA 11.08.)', basketNetCents({ gross_plus: 3.00, gross_minus: 2868.04 }) === 286504);
ok('par +105,30 / -105,30 => 0', basketNetCents({ gross_plus: 105.30, gross_minus: 105.30 }) === 0);
const floaty = 0.1 + 0.2;   // 0.30000000000000004 — binarna greska zapisa
ok('float zbroj s greskom zapisa ne pravi lipu razlike',
   compareWithBank(basketNetCents({ gross_plus: 0, gross_minus: floaty }), 0.3).state === 'ok',
   String(floaty));
ok('ista greska na strani povrata', basketNetCents({ gross_plus: 0.1 + 0.2, gross_minus: 0.3 }) === 0);

console.log('');
console.log('Usporedba s bankom, tolerancija 0,00:');
ok('isti iznos => slaze se', compareWithBank(106870, 1068.70).state === 'ok');
const c = compareWithBank(106870, 1068.69);
ok('jedna lipa => razlika (D3)', c.state === 'diff' && c.diffCents === 1);
const n = compareWithBank(71401, 736.51);
ok('banka skinula vise => negativna razlika', n.state === 'diff' && n.diffCents === -2250);
ok('prazno polje => ne tvrdi nista', compareWithBank(106870, null).state === 'empty');
ok('NaN => ne tvrdi nista', compareWithBank(106870, NaN).state === 'empty');

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
