/**
 * dueVisa.test.mjs — Visa u traci: prozor i mjera po košari (S170)
 *
 * ZASTO POSTOJI
 *   Traka je znala samo MC: prozor ±3 dana oko dospijeća i neto Σ. Visa nema
 *   stalan dan naplate (3.–11., procjena 5.), a košara nosi zrcalo naplate
 *   (`PRIMLJENA UPLATA`, uplata s `Izvor = Visa`) koje bi neto Σ pojeo.
 *
 * /!\ MC BEZ `window`/`measure` mora ostati TOCNO kakav je bio — to se ovdje
 *     mjeri jednako kao Visa.
 * /!\ PROTUPROVJERA: staro ponasanje (neto, ±3, dani od dospijeca) pada na
 *     Visa tvrdnjama.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'dueVisa.bundle.mjs');
await build({
  stdin: { contents: "export * from './src/lib/dueBaskets';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const real = await import(pathToFileURL(out).href);

// Staro: neto uvijek, ±3, brzi dani od dospijeca
const OLD = {
  ...real,
  basketSumCents: row => real.basketNetCents(row),
  basketWindow: () => ({ before: 3, after: 3, quickFrom: 0 }),
};

const VISA = { account: 'Sašin tekući RF', text: 'Visa', window: { before: 2, after: 6 }, measure: 'gross' };
const MC = { account: 'Kokin tekući ZABA', text: 'TROŠKOVI UČINJENI MASTERCARD KARTICOM' };
const J = JSON.stringify;

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}${extra ? ' | ' + extra : ''}`); }
  };

  // Mjera — Visa kosara 05.06.2026. (DOSPJELO_SPEC §2): bruto 1.409,63, zrcalo 1.282,79
  const visaRow = { gross_plus: 1282.79, gross_minus: 1409.63 };
  ok('Visa: Σ = bruto isplata', lib.basketSumCents(visaRow, VISA) === 140963, lib.basketSumCents(visaRow, VISA));
  ok('MC: Σ = neto (povrat umanjuje)', lib.basketSumCents({ gross_plus: 3, gross_minus: 2868.04 }, MC) === 286504);

  // Prozor
  const wv = lib.basketWindow(VISA), wm = lib.basketWindow(MC);
  ok('MC bez configa: ±3, brzi dani od dospijeca', J(wm) === J({ before: 3, after: 3, quickFrom: 0 }), J(wm));
  ok('Visa: −2/+6', wv.before === 2 && wv.after === 6 && wv.quickFrom === -2, J(wv));

  // Brzi izbor dana: dospijece 05.11., danas 12.11.
  const visaDays = real.quickConfirmDays('2026-11-05', '2026-11-12', wv.after, wv.quickFrom);
  ok('Visa nudi 03.–11.11.', visaDays[0] === '2026-11-03' && visaDays.at(-1) === '2026-11-11' && visaDays.length === 9, J(visaDays));
  const mcDays = real.quickConfirmDays('2026-11-11', '2026-11-20', wm.after, wm.quickFrom);
  ok('MC i dalje 11.–14.', J(mcDays) === J(['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']), J(mcDays));

  // basketAction: banka skinula 11.11. (Visa 49× u povijesti na 11.)
  const act = real.basketAction({ sumCents: 140963, settle: null, bank: 1409.63, bankDate: '2026-11-11',
    dueDate: '2026-11-05', today: '2026-11-12', window: wv });
  ok('Visa 11. u prozoru ⇒ confirm', act.kind === 'confirm', J(act));
  const far = real.basketAction({ sumCents: 140963, settle: null, bank: 1409.63, bankDate: '2026-11-02',
    dueDate: '2026-11-05', today: '2026-11-12', window: wv });
  ok('Visa 02. (3 dana prije) ⇒ date-far', far.kind === 'none' && far.reason === 'date-far', J(far));
  const mcFar = real.basketAction({ sumCents: 100, settle: null, bank: 1, bankDate: '2026-11-15',
    dueDate: '2026-11-11', today: '2026-11-20', window: wm });
  ok('MC 15. (4 dana) ⇒ date-far kao prije', mcFar.kind === 'none' && mcFar.reason === 'date-far');

  // Pravilo B: skupni redak „Visa" 10.11. na RF-u prepoznat
  const cand = { id: 'x', event_date: '2026-11-10', comment: 'Visa',
    values: { racun: 'Sašin tekući RF', izvorplacanja: 'Racun', tip: 'Transfer', isplata: 1409.63 } };
  const m = real.matchSettleRow([cand], { text: 'Visa', account: VISA.account, groupSlug: 'racun',
    settle: { izvorplacanja: 'Racun', tip: 'Transfer' }, minusSlug: 'isplata', dueDate: '2026-11-05',
    window: lib.basketWindow(VISA) });
  ok('Visa skupni redak 5 dana iza procjene prepoznat', m?.id === 'x' && m.amountCents === 140963, J(m));
  return { pass, fail };
}

const r = run(real, 'novo');
const o = run(OLD, 'staro');
console.log(`dueVisa: ${r.pass} prolaz, ${r.fail} pad | protuprovjera (staro): ${o.fail} pad`);
if (r.fail > 0) { console.log('❌ dueVisa'); process.exit(1); }
if (o.fail === 0) { console.log('❌ protuprovjera ne pada — test ne čuva ništa'); process.exit(1); }
console.log('✅ dueVisa');
