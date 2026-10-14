/**
 * basketsView.test.mjs — pločica „Košare": košare po računu, „ostaje"
 * kumulativno, naplaćena košara se ne oduzima dvaput (S171)
 *
 * /!\ „Ostaje" je tvrdnja o novcu. Košara čija je skupna naplata VEĆ upisana
 *     je već u saldu — oduzeti je opet = dvaput (PROTUPROVJERA ispod).
 * /!\ Visa Σ je bruto (zrcalo `PRIMLJENA UPLATA`, S170) — ista mjera kao traka.
 * /!\ U lipama: 0,1 + 0,2 ne smije dati 0,30000000000000004 (S145).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'basketsView.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/basketsView';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@': join(process.cwd(), 'src') },
  external: ['react', 'react-dom'],
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'x' }) },
});
const m = await import(pathToFileURL(out).href + '?t=' + Date.now());

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`}`);
};

const ZABA = 'Kokin tekući ZABA';
const RF = 'Sašin tekući RF';
const due = {
  basket_by: 'izvorplacanja', due_slug: 'datum_naplate', status_slug: 'status', pending: 'Planiran',
  baskets: {
    Mastercard: { account: ZABA, text: 'TROŠKOVI UČINJENI MASTERCARD KARTICOM' },
    Visa: { account: RF, text: 'Visa', window: { before: 2, after: 6 }, measure: 'gross' },
  },
};
const row = (basket, due_date, minus, plus = 0, n = 3, n_pending = n) =>
  ({ basket, due_date, n, n_pending, gross_plus: plus, gross_minus: minus });

const baskets = [
  row('Mastercard', '2026-12-11', 430.09),
  row('Visa', '2026-11-05', 612.40, 1409.63),   // zrcalo naplate u košari — bruto ga ne broji
  row('Mastercard', '2026-11-11', 493.90, 3.00), // povrat umanjuje (neto)
  row('Mastercard', '2026-10-11', 100.10),       // dospjelo
];
const balances = new Map([[ZABA, 12893.68], [RF, 799.12]]);
const today = '2026-10-14';

const plan = (settled = []) => m.planBasketView({ baskets, due, balances, settled: new Set(settled), today });

const g = plan();
eq('računi redom prve košare', g.map(x => x.account), [ZABA, RF]);
eq('ZABA košare po dospijeću', g[0].rows.map(r => r.due_date), ['2026-10-11', '2026-11-11', '2026-12-11']);
eq('MC neto: 493,90 − 3,00', g[0].rows[1].sumCents, 49090);
eq('Visa bruto: zrcalo ne pojede Σ', g[1].rows[0].sumCents, 61240);
eq('ostaje kumulativno (ZABA)', g[0].rows.map(r => r.remainingCents), [1279358, 1230268, 1187259]);
eq('ostaje RF', g[1].rows[0].remainingCents, 79912 - 61240);
eq('Visa = procjena (~)', g[1].rows[0].estimate, true);
eq('MC nije procjena', g[0].rows[0].estimate, false);
eq('dospjelo označeno', g[0].rows.map(r => r.overdue), [true, false, false]);

// PROTUPROVJERA: naplata dospjele košare već upisana ⇒ već je u saldu.
const s = plan(['Mastercard|2026-10-11']);
eq('naplaćena se ne oduzima drugi put', s[0].rows.map(r => r.remainingCents), [1289368, 1240278, 1197269]);
eq('naplaćena označena', s[0].rows[0].settled, true);
eq('zadano otvorena = prva NEnaplaćena (Visa 05.11. prije MC 11.11.)', m.defaultOpenKey(s), 'Visa|2026-11-05');
eq('zadano otvorena = dospjela kad nije naplaćena', m.defaultOpenKey(g), 'Mastercard|2026-10-11');

// Saldo računa nepoznat ⇒ „ostaje" se ne izmišlja.
const noRf = m.planBasketView({ baskets, due, balances: new Map([[ZABA, 1]]), settled: new Set(), today });
eq('bez salda: ostaje null', noRf[1].rows[0].remainingCents, null);
eq('bez salda: balanceCents null', noRf[1].balanceCents, null);

// Zatvorena košara (nema `Planiran`) i nepoznata kartica se ne pokazuju.
const closed = m.planBasketView({
  baskets: [row('Mastercard', '2026-09-11', 50, 0, 4, 0), row('Amex', '2026-11-01', 9)],
  due, balances, settled: new Set(), today,
});
eq('zatvorena i nekonfigurirana ispadaju', closed, []);

// Lipe
const cents = m.planBasketView({
  baskets: [row('Mastercard', '2026-11-11', 0.1), row('Mastercard', '2026-12-11', 0.2)],
  due, balances: new Map([[ZABA, 0.3]]), settled: new Set(), today,
});
eq('lipe: 0,30 − 0,10 − 0,20 = 0', cents[0].rows[1].remainingCents, 0);

// needsSettleCheck: MC ±3, Visa od 2 dana prije procjene
eq('MC 11.10. danas 14.10. ⇒ provjeri', m.needsSettleCheck('2026-10-11', today, due.baskets.Mastercard), true);
eq('MC 17.10. (3 dana) ⇒ provjeri', m.needsSettleCheck('2026-10-17', today, due.baskets.Mastercard), true);
eq('MC 11.11. ⇒ ne (banka još ne može)', m.needsSettleCheck('2026-11-11', today, due.baskets.Mastercard), false);
eq('Visa 16.10. (2 dana) ⇒ provjeri', m.needsSettleCheck('2026-10-16', today, due.baskets.Visa), true);
eq('Visa 17.10. ⇒ ne', m.needsSettleCheck('2026-10-17', today, due.baskets.Visa), false);

console.log(failed ? `\n❌ ${failed} pao` : '\n✅ sve prolazi');
process.exit(failed ? 1 : 0);
