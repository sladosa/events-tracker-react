/**
 * S156 C5 faza 2 — skupni redak i potvrda kosare.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Tri tihe greske su ovdje moguce, i svaka se vidi tek u novcu:
 *   (1) traka ne prepozna vec upisan skupni redak => nudi DRUGI => saldo
 *       broji naplatu dvaput;
 *   (2) potvrda (Planiran -> Izvrsen) se ponudi kad se kosara NE slaze s
 *       bankom => razlika se prešuti (odluka D2: saldo po banci, kosara ostaje
 *       otvorena);
 *   (3) datum izvan prozora => redak koji sljedeci put nitko ne prepozna.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'dueSettle.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/dueBaskets';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { matchSettleRow, basketAction, settleValues, daysBetween, SETTLE_WINDOW_DAYS,
  findSuspectSettleRows, adoptChanges } =
  await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const TEXT = 'TROŠKOVI UČINJENI MASTERCARD KARTICOM';
const SETTLE = { izvorplacanja: 'Racun', tip: 'Transfer', podtip: 'izmedju racuna' };
// oblik stvarnog retka s PROD-a (2026-09-11, 1.068,70)
const prodRow = (over = {}) => ({
  id: 'r1', event_date: '2026-09-11', comment: TEXT,
  values: { ...SETTLE, racun: 'Kokin tekući ZABA', status: 'Izvrsen', isplata: 1068.7 },
  ...over,
});
const P = {
  text: TEXT, account: 'Kokin tekući ZABA', groupSlug: 'racun', settle: SETTLE,
  plusSlug: 'uplata', minusSlug: 'isplata', dueDate: '2026-09-11',
};

console.log('');
console.log('daysBetween (stringovno, preko promjene ljetnog vremena):');
ok('24.10. -> 26.10. = 2 (DST 25.10.)', daysBetween('2026-10-24', '2026-10-26') === 2);
ok('11.10. -> 08.10. = -3', daysBetween('2026-10-11', '2026-10-08') === -3);
ok('prozor je 3 dana (isti broj kao alat)', SETTLE_WINDOW_DAYS === 3);

console.log('');
console.log('Pravilo B — prepoznaj vec upisan skupni redak:');
{
  const m = matchSettleRow([prodRow()], P);
  ok('PROD oblik je prepoznat', m?.id === 'r1', JSON.stringify(m));
  ok('iznos u lipama, neto', m?.amountCents === 106870, String(m?.amountCents));
  ok('count = 1', m?.count === 1);
}
ok('drugi opis => nije skupni redak', matchSettleRow([prodRow({ comment: 'Konzum' })], P) === null);
ok('opis s razmakom na kraju je isti', matchSettleRow([prodRow({ comment: TEXT + ' ' })], P) !== null);
ok('drugi racun => nije', matchSettleRow([prodRow({ values: { ...prodRow().values, racun: 'Sasin tekuci RF' } })], P) === null);
ok('bez `tip` => nije (settle je CIJELI)', matchSettleRow([prodRow({ values: { ...prodRow().values, tip: 'Hrana' } })], P) === null);
ok('Izvor = Mastercard => nije (to je kartican redak, ne naplata)',
   matchSettleRow([prodRow({ values: { ...prodRow().values, izvorplacanja: 'Mastercard' } })], P) === null);
ok('3 dana od dospijeca => jest', matchSettleRow([prodRow({ event_date: '2026-09-14' })], P) !== null);
ok('4 dana od dospijeca => nije', matchSettleRow([prodRow({ event_date: '2026-09-15' })], P) === null);
ok('4 dana PRIJE => nije', matchSettleRow([prodRow({ event_date: '2026-09-07' })], P) === null);
{
  const m = matchSettleRow([
    prodRow({ id: 'far', event_date: '2026-09-13' }),
    prodRow({ id: 'near', event_date: '2026-09-11', values: { ...prodRow().values, isplata: 1000 } }),
  ], P);
  ok('dva pogotka => najblizi po datumu', m?.id === 'near', JSON.stringify(m));
  ok('dva pogotka => count = 2 (kaze se naglas)', m?.count === 2);
}
{
  const m = matchSettleRow([prodRow({ values: { ...prodRow().values, isplata: undefined, uplata: 5 } })], P);
  ok('naplata kao uplata => negativan neto', m?.amountCents === -500, String(m?.amountCents));
}

console.log('');
console.log('Sto traka nudi (basketAction):');
const base = { sumCents: 85958, settle: null, bank: 859.58, bankDate: '2026-10-11', dueDate: '2026-10-11', today: '2026-10-12' };
ok('Σ = banka, datum upisan => confirm', basketAction(base).kind === 'confirm');
{
  const a = basketAction({ ...base, bank: 881.08 });
  ok('Σ != banka => record (NE confirm — D2)', a.kind === 'record', JSON.stringify(a));
  ok('razlika: kosara manja od banke => negativna', a.diffCents === -2150, String(a.diffCents));
}
ok('float upis 0,1+0,2 ne pravi lipu razlike',
   basketAction({ ...base, sumCents: 30, bank: 0.1 + 0.2 }).kind === 'confirm');
ok('prazno polje => none/no-bank', basketAction({ ...base, bank: null }).reason === 'no-bank');
ok('necitljivo => none/unreadable', basketAction({ ...base, bank: NaN }).reason === 'unreadable');
ok('nula => none/not-positive', basketAction({ ...base, bank: 0 }).reason === 'not-positive');
ok('bez datuma => none/no-date (datum se ne pogadja, BUG-S115)', basketAction({ ...base, bankDate: null }).reason === 'no-date');
ok('datum u buducnosti => none', basketAction({ ...base, bankDate: '2026-10-13' }).reason === 'date-future');
ok('datum 4 dana od dospijeca => none/date-far', basketAction({ ...base, bankDate: '2026-10-07', today: '2026-10-12' }).reason === 'date-far');
ok('datum 3 dana od dospijeca => dopusten', basketAction({ ...base, bankDate: '2026-10-08', bank: 859.58 }).kind === 'confirm');
{
  const settle = { id: 'x', date: '2026-10-11', amountCents: 85958, count: 1 };
  ok('skupni redak postoji, Σ = njegov iznos => flip', basketAction({ ...base, settle, bank: null }).kind === 'flip');
  ok('skupni redak postoji => upisani broj se NE gleda (nema drugog retka)',
     basketAction({ ...base, settle, bank: 1 }).kind === 'flip');
  const m = basketAction({ ...base, sumCents: 83808, settle });
  ok('skupni redak postoji, Σ != => mismatch (D6)', m.kind === 'mismatch', JSON.stringify(m));
  ok('mismatch nosi razliku', m.diffCents === -2150, String(m.diffCents));
}

console.log('');
console.log('Vrijednosti skupnog retka:');
{
  const v = settleValues({ settle: SETTLE, groupSlug: 'racun', account: 'Kokin tekući ZABA',
    statusSlug: 'status', done: 'Izvrsen', plusSlug: 'uplata', minusSlug: 'isplata', amountCents: 85958 });
  ok('settle atributi', v.izvorplacanja === 'Racun' && v.tip === 'Transfer' && v.podtip === 'izmedju racuna');
  ok('racun = racun kosare', v.racun === 'Kokin tekući ZABA');
  ok('status = done (inace ga saldo ne broji)', v.status === 'Izvrsen');
  ok('iznos u isplatu, u eurima', v.isplata === 859.58 && !('uplata' in v), JSON.stringify(v));
  ok('datum naplate NIJE ovdje (racuna ga pravilo)', !('datum_naplate' in v));
}
{
  const v = settleValues({ settle: SETTLE, groupSlug: 'racun', account: 'A',
    statusSlug: 'status', done: 'Izvrsen', plusSlug: 'uplata', minusSlug: 'isplata', amountCents: -300 });
  ok('negativna naplata ide u uplatu', v.uplata === 3 && !('isplata' in v), JSON.stringify(v));
}

console.log('');
console.log('Pravilo C (S157) — rucni redak istog iznosa, ma kako opisan:');
{
  // T-S156-1 na TEST-u: 1.244,74 od 11.07., BEZ opisa => pravilo B ga ne vidi
  const FILTERS = [
    { op: 'in', slug: 'izvorplacanja', values: ['Racun'] },
    { op: 'not_in', slug: 'status', values: ['Planiran'] },
  ];
  const manual = (over = {}) => ({
    id: 'm1', event_date: '2026-09-11', comment: 'MC',
    values: { racun: 'Kokin tekući ZABA', izvorplacanja: 'Racun', status: 'Izvrsen',
      tip: 'Domaćinstvo', podtip: 'Hrana i ostalo', isplata: 1068.7 },
    ...over,
  });
  const C = { account: 'Kokin tekući ZABA', groupSlug: 'racun', filters: FILTERS, statusSlug: 'status',
    plusSlug: 'uplata', minusSlug: 'isplata', bankCents: 106870, bankDate: '2026-09-11' };
  const ids = (list) => list.map(r => r.id).join(',');

  ok('rucni redak „MC" s krivim Podtipom => sumnjiv', ids(findSuspectSettleRows([manual()], C)) === 'm1');
  ok('pravilo B ga NE vidi (zato pravilo C postoji)', matchSettleRow([manual()], P) === null);
  ok('bez opisa => sumnjiv', ids(findSuspectSettleRows([manual({ comment: null })], C)) === 'm1');
  ok('iznos u cent, ne priblizno (1.068,71 nije)',
     findSuspectSettleRows([manual({ values: { ...manual().values, isplata: 1068.71 } })], C).length === 0);
  ok('float iznos s greskom zapisa je isti cent',
     findSuspectSettleRows([manual({ values: { ...manual().values, isplata: 1068.7000000001 } })], C).length === 1);
  ok('drugi racun => nije',
     findSuspectSettleRows([manual({ values: { ...manual().values, racun: 'Sašin tekući RF' } })], C).length === 0);
  ok('kartican redak (ne mice saldo) => nije',
     findSuspectSettleRows([manual({ values: { ...manual().values, izvorplacanja: 'Mastercard' } })], C).length === 0);
  ok('`Planiran` Racun redak => JEST (duplikat cim se potvrdi)',
     findSuspectSettleRows([manual({ values: { ...manual().values, status: 'Planiran' } })], C).length === 1);
  ok('3 dana od upisanog dana => jest', findSuspectSettleRows([manual({ event_date: '2026-09-14' })], C).length === 1);
  ok('4 dana => nije', findSuspectSettleRows([manual({ event_date: '2026-09-15' })], C).length === 0);
  ok('uplata istog iznosa (neto suprotan) => nije',
     findSuspectSettleRows([manual({ values: { ...manual().values, isplata: undefined, uplata: 1068.7 } })], C).length === 0);
  ok('dva => najblizi prvi',
     ids(findSuspectSettleRows([manual({ id: 'far', event_date: '2026-09-13' }), manual({ id: 'near' })], C)) === 'near,far');

  const ch = adoptChanges(manual(), { text: TEXT, settle: SETTLE, statusSlug: 'status', done: 'Izvrsen' });
  const sig = ch.map(c => `${c.slug ?? '@'}:${c.from}>${c.to}`).sort().join(' | ');
  ok('ispravak: opis + Tip + Podtip, NE Izvor/status (vec su ispravni)',
     sig === `@:MC>${TEXT} | podtip:Hrana i ostalo>izmedju racuna | tip:Domaćinstvo>Transfer`, sig);
  const ch2 = adoptChanges(manual({ values: { ...manual().values, status: 'Planiran' } }),
    { text: TEXT, settle: SETTLE, statusSlug: 'status', done: 'Izvrsen' });
  ok('`Planiran` rucni redak => status ide u Izvrsen', ch2.some(c => c.slug === 'status' && c.to === 'Izvrsen'));
  ok('ispravak NIKAD ne dira iznos ni racun',
     !ch2.some(c => ['isplata', 'uplata', 'racun'].includes(c.slug)));
  ok('vec ispravan redak => nema izmjena',
     adoptChanges(prodRow(), { text: TEXT, settle: SETTLE, statusSlug: 'status', done: 'Izvrsen' }).length === 0);
  // nakon ispravka ga pravilo B MORA prepoznati — inace bi traka pitala opet
  const fixed = manual({ comment: TEXT, values: { ...manual().values, tip: 'Transfer', podtip: 'izmedju racuna' } });
  ok('ispravljen redak pravilo B prepoznaje', matchSettleRow([fixed], P)?.id === 'm1');
}

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
