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
const { basketNetCents, compareWithBank, quickConfirmDays, basketAction } = await import(pathToFileURL(out).href);

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
console.log('D7 (S168) — dani koje traka nudi za „kojeg dana":');
const J = x => JSON.stringify(x);
ok('nedjelja 11.10., danas pon 12.10. => 11. i 12.',
   J(quickConfirmDays('2026-10-11', '2026-10-12')) === J(['2026-10-11', '2026-10-12']));
ok('na dan dospijeća => samo taj dan', J(quickConfirmDays('2026-10-11', '2026-10-11')) === J(['2026-10-11']));
ok('dospijeće sutra => ništa (budući dan se ne nudi)', quickConfirmDays('2026-10-12', '2026-10-11').length === 0);
ok('tjedan kasnije => najviše dospijeće + 3', J(quickConfirmDays('2026-10-11', '2026-10-20'))
   === J(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']));
ok('preko kraja mjeseca', J(quickConfirmDays('2026-10-30', '2026-11-02'))
   === J(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']));
// Svaki ponuđeni dan + Σ kao bankin broj ⇒ basketAction kaže „confirm" — ponuđen dan nikad nije odbijen.
const offered = quickConfirmDays('2026-10-11', '2026-10-20');
ok('svaki ponuđeni dan prolazi basketAction (confirm)', offered.every(d =>
   basketAction({ sumCents: 118934, settle: null, bank: 1189.34, bankDate: d,
                  dueDate: '2026-10-11', today: '2026-10-20' }).kind === 'confirm'));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
