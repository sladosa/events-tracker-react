/**
 * pickDeltaWindow tests
 * =====================
 * Cuva fazu 1 iz `docs/DELTA_WINDOW_SPEC.md`: prozor delta sheeta mjeri se
 * SIDRIMA, ne danima. Do S142 je sidro bilo tvrd pod prozora, pa je panel trazio
 * 60 dana a ZABA file nosio 12 -- i 47 `Racun` redaka je nestajalo bez poruke.
 *
 * Brojke u testu su IZMJERENE na PROD-u 18.09.2026. (SPEC §1.1, §1.2), ne
 * izmisljene: ZABA ima 16 sidara s rupom od 575 dana, RF tri.
 *
 * Pokrece se iz korijena projekta:
 *   node src/lib/__tests__/deltaWindow.test.mjs
 *
 * /!\ Test uvozi PRAVU funkciju (esbuild transpajlira .ts u temp .mjs), ne svoju
 *     kopiju -- inace bi kopija s vremenom odlutala od koda koji se isporucuje.
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

const src = readFileSync('src/lib/deltaWindow.ts', 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm' });
const dir = mkdtempSync(join(tmpdir(), 'dwin-'));
const out = join(dir, 'deltaWindow.mjs');
writeFileSync(out, code);
const { pickDeltaWindow } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${g}\n        want ${w}`); }
};

const TODAY = '2026-09-18';

// Stvarna sidra s PROD-a (SPEC §1.1 + handoff S141). Namjerno u NEUREDNOM redu --
// funkcija mora sortirati sama, kao i RPC.
const ZABA = [
  { group_value: 'Kokin tekući ZABA', confirmed_on: '2025-01-01', amount: 9000.00, created_at: '2025-01-02T10:00:00Z', note: 'Sasin zapis' },
  { group_value: 'Kokin tekući ZABA', confirmed_on: '2026-09-06', amount: 12772.86, created_at: '2026-09-06T08:00:00Z', note: 'ekran bankovne aplikacije' },
  { group_value: 'Kokin tekući ZABA', confirmed_on: '2026-07-30', amount: 13815.33, created_at: '2026-07-31T09:00:00Z', note: 'ispisano stanje s izvoda · ZABA_2026-07.pdf' },
  // Tudi racun -- ne smije nikad uci u izbor.
  { group_value: 'Sašin tekući RF',   confirmed_on: '2026-09-07', amount: 690.79,  created_at: '2026-09-07T08:00:00Z', note: null },
];

console.log('\nZABA -- Sasin slucaj: K=1 mora dati potvrdjen broj, ne izracun:');
const z1 = pickDeltaWindow(ZABA, 'Kokin tekući ZABA', TODAY, 1, 60);
eq('K=1 ⇒ sidro je PREDZADNJE (30.07.)', z1.anchor.confirmed_on, '2026-07-30');
eq('K=1 ⇒ otvarajuci iznos = 13.815,33', z1.anchor.amount, 13815.33);
eq('K=1 ⇒ prozor krece DAN POSLIJE sidra', z1.start, '2026-07-31');
// Ovo je jezgra promjene: `dayBefore` je TOCNO dan sidra, pa RPC vrati sam iznos
// sidra -- otvarajuce stanje bez ijednog dijela izracuna (T-S141-4).
eq('K=1 ⇒ dayBefore je DAN SIDRA (⇒ RPC vrati sam iznos sidra)', z1.dayBefore, '2026-07-30');
eq('K=1 ⇒ prozor je 50 dana (SPEC §1.2)', z1.spanDays, 50);
eq('K=1 ⇒ zadnje sidro (06.09.) pada UNUTAR prozora', z1.anchorsInWindow.map(a => a.confirmed_on), ['2026-09-06']);
eq('K=1 ⇒ nije clampan', z1.clamped, false);

console.log('\nZABA -- K=0 mora dati TOCNO dosadasnje ponasanje:');
const z0 = pickDeltaWindow(ZABA, 'Kokin tekući ZABA', TODAY, 0, 60);
eq('K=0 ⇒ sidro je ZADNJE (06.09.)', z0.anchor.confirmed_on, '2026-09-06');
eq('K=0 ⇒ prozor krece 07.09.', z0.start, '2026-09-07');
eq('K=0 ⇒ prozor je 12 dana (izmjereno na PROD-u)', z0.spanDays, 12);
eq('K=0 ⇒ nijedno sidro nije unutar prozora', z0.anchorsInWindow.length, 0);

console.log('\nRupa medju sidrima -- K=2 nije „malo siri prozor" nego 625 dana:');
const z2 = pickDeltaWindow(ZABA, 'Kokin tekući ZABA', TODAY, 2, 60);
eq('K=2 ⇒ sidro 01.01.2025.', z2.anchor.confirmed_on, '2025-01-01');
// 625, ne 626: provjereno neovisno (02.01.2025 → 18.09.2026 ukljucivo). Prva
// verzija testa je tvrdila 626 i PALA -- brojka pisana rukom protiv koda koji
// racuna. Tocno ono zbog cega test postoji.
eq('K=2 ⇒ prozor 625 dana ⇒ panel to MORA ispisati prije izvoza', z2.spanDays, 625);
eq('K=2 ⇒ dva sidra unutar prozora', z2.anchorsInWindow.length, 2);

console.log('\nClamp -- K veci od broja sidara ne smije pasti na „od pocetka vremena":');
const z9 = pickDeltaWindow(ZABA, 'Kokin tekući ZABA', TODAY, 9, 60);
eq('K=9 uz 3 sidra ⇒ uzeto najstarije', z9.anchor.confirmed_on, '2025-01-01');
eq('K=9 ⇒ clamped = true (panel to kaze)', z9.clamped, true);
eq('K=9 ⇒ stvarno upotrijebljen K je 2', z9.anchorsBackUsed, 2);
eq('K=9 ⇒ racun ima 3 sidra', z9.anchorsAvailable, 3);

console.log('\nRacun BEZ sidra -- fallback na dane, nikad na pocetak vremena:');
const none = pickDeltaWindow(ZABA, 'Nepostojeci racun', TODAY, 1, 60);
eq('bez sidra ⇒ anchor = null', none.anchor, null);
eq('bez sidra ⇒ fromAnchor = false', none.fromAnchor, false);
eq('bez sidra ⇒ prozor je tocno fallbackDays', none.spanDays, 60);
eq('bez sidra ⇒ krece 60 dana unatrag', none.start, '2026-07-21');

console.log('\nTudji racun i buduce sidro se ne smiju uzeti u obzir:');
eq('RF sidro ne ulazi u ZABA izbor', z0.anchorsAvailable, 3);
const future = pickDeltaWindow(
  [...ZABA, { group_value: 'Kokin tekući ZABA', confirmed_on: '2027-01-01', amount: 1, created_at: 'z', note: null }],
  'Kokin tekući ZABA', TODAY, 0, 60);
eq('sidro u BUDUCNOSTI se preskace (isto sto radi RPC)', future.anchor.confirmed_on, '2026-09-06');

console.log('\nIsti datum, dva zapisa -- tipfeler se ispravlja NOVIM retkom:');
const dup = pickDeltaWindow([
  { group_value: 'X', confirmed_on: '2026-09-06', amount: 3453.03, created_at: '2026-09-06T08:00:00Z', note: 'tipfeler' },
  { group_value: 'X', confirmed_on: '2026-09-06', amount: 12772.86, created_at: '2026-09-06T09:00:00Z', note: 'ispravak' },
], 'X', TODAY, 0, 60);
eq('kod istog datuma pobjedjuje ZADNJE upisano', dup.anchor.amount, 12772.86);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
