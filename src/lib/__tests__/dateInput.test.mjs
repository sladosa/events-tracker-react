/**
 * S155 — BUG-S155-EDITNAN: polja datuma/vremena u zaglavlju Add i Edita.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Add i Edit su imali svaka svoju kopiju parsiranja i razisle su se dvaput:
 *   (1) Edit nije ignorirao prazno polje ⇒ brisanje dana dalo je NaN datum, a
 *       inkrementalni pomak je nakon toga svaki pomak pretvarao u NaN, sat na 00:00;
 *   (2) godina bez dopune na 4 znamenke (`2-08-07`) ⇒ polje prazno usred tipkanja.
 *   Izmjereno u T-S155-2 (Sasa, 30.09.), obje slike.
 */
process.env.TZ = 'Europe/Zagreb';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'dateInput.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/dateInput';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { toDateInputValue, toTimeInputValue, applyDateInput, applyTimeInput } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const BASE = new Date(2026, 7, 7, 14, 1, 1);   // 07.08.2026. 14:01:01 lokalno

console.log('');
console.log('Prazno / necitljivo polje se ne javlja (Edit je dobivao NaN):');
ok('prazan datum => null', applyDateInput(BASE, '') === null);
ok('prazno vrijeme => null', applyTimeInput(BASE, '') === null);
ok('smece => null', applyDateInput(BASE, '2026-8') === null && applyTimeInput(BASE, 'ab') === null);
ok('godina s 6 znamenki (Chrome bez max) => null', applyDateInput(BASE, '252026-05-05') === null);
ok('neispravna baza => null (ne siri NaN dalje)', applyDateInput(new Date(NaN), '2026-08-05') === null);

console.log('');
console.log('Promjena datuma zadrzava sat, promjena sata zadrzava datum:');
const d = applyDateInput(BASE, '2026-08-05');
ok('05.08. u 14:01', d && d.getDate() === 5 && d.getHours() === 14 && d.getMinutes() === 1, String(d));
const t = applyTimeInput(BASE, '09:30');
ok('09:30 istog dana, sekunde na nulu', t && t.getDate() === 7 && t.getHours() === 9 && t.getMinutes() === 30 && t.getSeconds() === 0);

console.log('');
console.log('Medjustanje godine dok se tipka (Chrome javlja 0002):');
const y2 = applyDateInput(BASE, '0002-08-07');
ok('0002 je citljiv datum (namjerno propusten)', y2 && y2.getFullYear() === 2 && y2.getHours() === 14);
ok('i vraca se u polje kao 0002-08-07, ne 2-08-07', toDateInputValue(y2) === '0002-08-07', toDateInputValue(y2));
ok('obican datum', toDateInputValue(BASE) === '2026-08-07');
ok('vrijeme HH:MM', toTimeInputValue(BASE) === '14:01');
ok('neispravan datum => prazno polje, ne NaN', toDateInputValue(new Date(NaN)) === '' && toTimeInputValue(new Date(NaN)) === '');

console.log('');
console.log('Gotov datum za filtar:');
const { isCompleteDateValue } = await import(pathToFileURL(out).href);
ok('obican datum', isCompleteDateValue('2026-09-30'));
ok('6 znamenki godine (S155, To = 202566) => ne', !isCompleteDateValue('202566-09-30'));
ok('medjustanje 0002 => ne', !isCompleteDateValue('0002-09-30'));
ok('prazno => ne', !isCompleteDateValue(''));
ok('granice ukljucene', isCompleteDateValue('1900-01-01') && isCompleteDateValue('2200-12-31') && !isCompleteDateValue('2201-01-01'));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
