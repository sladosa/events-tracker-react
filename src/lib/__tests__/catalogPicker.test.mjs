/**
 * catalogPicker.test.mjs — model izbornika iz kataloga (S190, korak 5)
 *
 * ZASTO POSTOJI
 *   Saša (31.10.): bez tražilice; u skupini prvo ono što TAJ korisnik najčešće radi u zadnjih
 *   12 mjeseci, najviše 6 + „Sve"; uz skupinu „zadnje prije N d" računajući i SPOREDNU skupinu
 *   (erg opterećuje i Upper-pull). Svako od toga je pravilo koje se tiho može izgubiti.
 *
 * STO CUVA
 *   - korištenje = broj RAZLIČITIH dana (dvije serije istog dana su jedan trening) + zadnji dan;
 *   - redoslijed skupina = popis opcija, pa nepoznate abecedno, pa „bez skupine";
 *   - u skupini: učestalost pa ime (hr kolacija);
 *   - odmor po skupini uključuje sporednu; skupina bez korištenja = null;
 *   - otvorena skupina = skupina trenutne vrijednosti.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'catalogPicker.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  entryPoints: ['src/lib/catalogPicker.ts'],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`); }
};
const J = JSON.stringify;
const item = (value, label, group, group2 = null) =>
  ({ eventId: 'e-' + value, ownerId: 'o', value, label, group, group2, values: {}, rowIds: {}, photos: [] });

console.log('\n── Korištenje ──');
const usage = m.usageFrom([
  { value: 'pull_m', day: '2026-10-01' }, { value: 'pull_m', day: '2026-10-01' },   // 2 serije, 1 trening
  { value: 'pull_m', day: '2026-10-20' },
  { value: 'biceps', day: '2026-09-01' },
  { value: 'erg', day: '2026-10-28' },
  { value: null, day: '2026-10-28' },
]);
ok('dvije serije istog dana = 1 trening', usage.get('pull_m').days12 === 2, J(usage.get('pull_m')));
ok('zadnji dan', usage.get('pull_m').last === '2026-10-20');
ok('prazna vrijednost se ne broji', !usage.has(null) && !usage.has(''));

console.log('\n── Skupine ──');
const items = [
  item('biceps', 'Biceps', 'Upper-pull'),
  item('pull_m', 'Povlačenje na mašini', 'Upper-pull'),
  item('zgib_m', 'Zgib uz pomoć', 'Upper-pull'),
  item('cucanj', 'Čučanj', 'Legs-main'),
  item('erg', 'Veslački ergometar', 'Legs-main', 'Upper-pull'),
  item('istezanje', 'Istezanje', null),
  item('x', 'Nešto', 'Zzz-nova'),
];
const groups = m.pickerGroups(items, usage, ['Upper-push', 'Upper-pull', 'Legs-main'], '2026-10-31');
ok('redoslijed: popis, pa nepoznate, pa bez skupine', J(groups.map(g => g.key)) === J(['Upper-pull', 'Legs-main', 'Zzz-nova', '']), J(groups.map(g => g.key)));
const up = groups.find(g => g.key === 'Upper-pull');
ok('u skupini: učestalost pa ime', J(up.items.map(i => i.value)) === J(['pull_m', 'biceps', 'zgib_m']), J(up.items.map(i => i.value)));
ok('odmor Upper-pull uključuje erg (sporedna) ⇒ 3 d', up.daysSince === 3, String(up.daysSince));
const lm = groups.find(g => g.key === 'Legs-main');
ok('Legs-main ⇒ 3 d (erg)', lm.daysSince === 3, String(lm.daysSince));
ok('neopterećena skupina = null', groups.find(g => g.key === '').daysSince === null);
ok('hr kolacija: Čučanj ispred Veslački (oba 0×… erg 1×)', J(lm.items.map(i => i.value)) === J(['erg', 'cucanj']), J(lm.items.map(i => i.value)));

console.log('\n── Otvorena skupina ──');
ok('skupina trenutne vrijednosti', m.initialGroup(items, 'biceps') === 'Upper-pull');
ok('bez skupine ⇒ ""', m.initialGroup(items, 'istezanje') === '');
ok('nepoznata vrijednost ⇒ null', m.initialGroup(items, 'nema') === null);
ok('prazno ⇒ null', m.initialGroup(items, null) === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
