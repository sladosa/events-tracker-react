/**
 * S155 C3c — Edit na potvrdjenom retku: koja su polja bankina, je li redak
 * potvrdjen (zig ili sidro), i sto se od bankinog promijenilo.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Excel put je imao zastitu (kolona `Potvrda`, kvacica na uvozu, S143), a
 *   Edit nikakvu — a Koka od S151 radi kroz Edit. Dvije stvari se moraju
 *   drzati: (1) NASA polja (Tip, Podtip, opis) nikad ne pale upozorenje —
 *   upozorenje koje pali na reklasifikaciji nauci se otklikati; (2) ista
 *   vrijednost u tri oblika (baza, forma, uvoz) nije promjena — inace bi
 *   svako otvaranje ozigosanog retka tvrdilo da se `Datum naplate` mijenja.
 *
 * Zona je Zagreb: u UTC-u bi `+00:00` i lokalno podne bili isti dan i bez
 * ispravnog koda (isti razlog kao `localDate.test.mjs`).
 */
process.env.TZ = 'Europe/Zagreb';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'confirmedRowEdit.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/confirmedRowEdit';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const {
  bankFieldSpec, rowConfirmation, bankFieldChanges, canonValue, changesSignature, EVENT_DATE_KEY,
} = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

// Oblik PROD configa `Financije_all` (041 + 044) + zig iz C3b.
const SETTINGS = {
  dashboard: { widgets: [{
    type: 'balance_by_group', title: 'Stanje po računu', group_by: 'racun',
    plus: 'uplata', minus: 'isplata',
    filters: [
      { op: 'in', slug: 'izvorplacanja', values: ['Racun'] },
      { op: 'not_in', slug: 'status', values: ['Planiran'] },
    ],
  }] },
  automations: { attribute_rules: [{
    action: 'set_attribute', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
    date_map: { Racun: 'same', Mastercard: 'next:11' }, lock_slug: 'izvod_opis',
  }] },
};
const spec = bankFieldSpec(SETTINGS);
const has = (s) => spec.slugs.includes(s);

console.log('');
console.log('Bankina polja se izvode iz postojeceg configa:');
ok('iznosi, racun, Izvor, Status', ['uplata', 'isplata', 'racun', 'izvorplacanja', 'status'].every(has));
ok('target i sam zig', has('datum_naplate') && has('izvod_opis'));
ok('NASA polja nisu bankina', !has('tip') && !has('podtip'));
ok('zig i sidro-slug', spec.lockSlugs.join() === 'izvod_opis' && spec.groupSlug === 'racun');
const empty = bankFieldSpec({});
ok('Area bez configa => nista nije bankino', empty.slugs.length === 0 && empty.groupSlug === null);
ok('pravilo BEZ ziga ne cini target bankinim',
   !bankFieldSpec({ automations: { attribute_rules: [{ ...SETTINGS.automations.attribute_rules[0], lock_slug: undefined }] } })
     .slugs.includes('datum_naplate'));

const ANCHORS = [
  { group_value: 'Kokin tekući ZABA', confirmed_on: '2026-07-30', amount: 13815.33 },
  { group_value: 'Kokin tekući ZABA', confirmed_on: '2026-09-06', amount: 12772.86 },
  { group_value: 'Sašin tekući RF', confirmed_on: '2026-09-10', amount: 799.12 },
];
const ROW = new Map([
  ['racun', 'Kokin tekući ZABA'], ['izvorplacanja', 'Racun'], ['isplata', 45.94],
  ['datum_naplate', '2026-08-17T10:00:00+00:00'], ['tip', 'Hrana'],
  ['izvod_opis', 'KONZUM 1234 ZAGREB'],
]);

console.log('');
console.log('Je li redak potvrdjen:');
const c1 = rowConfirmation(spec, ROW, ANCHORS, '2026-08-17');
ok('zig + sidro', c1 && c1.stamps.length === 1 && c1.anchor?.confirmedOn === '2026-09-06');
ok('sidro je NAJRANIJE koje obuhvaca redak',
   rowConfirmation(spec, ROW, ANCHORS, '2026-07-01')?.anchor?.confirmedOn === '2026-07-30');
const noStamp = new Map(ROW); noStamp.set('izvod_opis', '   ');
ok('prazan zig (razmaci) nije zig, sidro ostaje', rowConfirmation(spec, noStamp, ANCHORS, '2026-08-17')?.stamps.length === 0);
ok('poslije svih sidara, bez ziga => nije potvrdjen', rowConfirmation(spec, noStamp, ANCHORS, '2026-09-20') === null);
const rf = new Map(noStamp); rf.set('racun', 'Revolut');
ok('sidro drugog racuna ne vrijedi', rowConfirmation(spec, rf, ANCHORS, '2026-08-17') === null);
ok('sidra nisu ucitana (null) => sidro se ne tvrdi, zig i dalje',
   rowConfirmation(spec, ROW, null, '2026-08-17')?.anchor === null
   && rowConfirmation(spec, noStamp, null, '2026-08-17') === null);

const card = new Map(noStamp); card.set('izvorplacanja', 'Mastercard');
ok('KARTICNI redak u razdoblju sidra => sidro NE vrijedi (ne ulazi u saldo; T-S155-4)',
   rowConfirmation(spec, card, ANCHORS, '2026-08-17') === null);
const planned = new Map(noStamp); planned.set('status', 'Planiran');
ok('Racun ali Planiran (not_in) => sidro ne vrijedi', rowConfirmation(spec, planned, ANCHORS, '2026-08-17') === null);
const cardStamped = new Map(ROW); cardStamped.set('izvorplacanja', 'Mastercard');
ok('karticni redak SA zigom => zig vrijedi, sidro ne',
   (() => { const c = rowConfirmation(spec, cardStamped, ANCHORS, '2026-08-17'); return c && c.stamps.length === 1 && c.anchor === null; })());

console.log('');
console.log('Ista vrijednost u tri oblika nije promjena:');
ok('datum iz baze = datum iz forme (isti dan)', canonValue('2026-08-17T10:00:00+00:00') === canonValue('2026-08-17T12:00'));
ok('uvoz (ponoc UTC) = isti lokalni dan', canonValue('2026-08-17T00:00:00+00:00') === '2026-08-17');
ok('broj = tekst broja', canonValue(45.94) === canonValue('45.94') && canonValue('45.940') === '45.94');
ok('null = prazno', canonValue(null) === canonValue('') && canonValue(undefined) === '');
ok('tekst se ne dira', canonValue(' Racun ') === 'Racun');

console.log('');
console.log('Sto se od bankinog promijenilo:');
const same = new Map(ROW); same.set('datum_naplate', '2026-08-17T12:00');
ok('otvoren i spremljen bez izmjena => nista',
   bankFieldChanges(spec, ROW, same, '2026-08-17', '2026-08-17').length === 0);
const reclass = new Map(ROW); reclass.set('tip', 'Kucanstvo');
ok('reklasifikacija (Tip) NIJE bankina izmjena',
   bankFieldChanges(spec, ROW, reclass, '2026-08-17', '2026-08-17').length === 0);
const typo = new Map(ROW); typo.set('isplata', 54.94);
const ch = bankFieldChanges(spec, ROW, typo, '2026-08-17', '2026-08-17');
ok('iznos promijenjen => prijavljen s obje vrijednosti',
   ch.length === 1 && ch[0].key === 'isplata' && ch[0].from === '45.94' && ch[0].to === '54.94');
const izvor = new Map(ROW); izvor.set('izvorplacanja', 'Visa');
ok('Izvor promijenjen (izbacuje iz salda) => prijavljen',
   bankFieldChanges(spec, ROW, izvor, '2026-08-17', '2026-08-17').some(f => f.key === 'izvorplacanja'));
const d = bankFieldChanges(spec, ROW, same, '2026-08-17', '2026-08-18');
ok('datum retka promijenjen => prijavljen pod posebnim kljucem', d.length === 1 && d[0].key === EVENT_DATE_KEY);
const cleared = new Map(ROW); cleared.set('izvod_opis', '');
ok('brisanje ziga je bankina izmjena (izlaz postoji, ali se vidi)',
   bankFieldChanges(spec, ROW, cleared, '2026-08-17', '2026-08-17').some(f => f.key === 'izvod_opis'));

console.log('');
console.log('Potvrda vrijedi samo za izmjene koje je covjek vidio:');
const s1 = changesSignature([{ id: 'e1', list: ch }]);
const ch2 = bankFieldChanges(spec, ROW, new Map([...typo, ['isplata', 64.94]]), '2026-08-17', '2026-08-17');
ok('druga vrijednost => drugi otisak', s1 !== changesSignature([{ id: 'e1', list: ch2 }]));
ok('ista izmjena => isti otisak', s1 === changesSignature([{ id: 'e1', list: bankFieldChanges(spec, ROW, typo, '2026-08-17', '2026-08-17') }]));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
