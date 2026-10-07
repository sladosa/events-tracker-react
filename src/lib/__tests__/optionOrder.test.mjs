/**
 * optionOrder.test.mjs — dugi izbornici abecedno (S164)
 *
 * ZASTO POSTOJI
 *   Koka i Sasa: 18 Tipova je stajalo redom kojim su nastali
 *   (`N/A, auto C5, auto Lacetti, Prijevoz, Domacinstvo, ...`), pa se trazilo ocima.
 *
 * /!\ Odluka je po ATRIBUTU: Podtip pod `Razno` (6) mora biti abecedan jer je
 *     Podtip pod `Zabava` (11) — isti izbornik ne smije imati dva ponasanja.
 * /!\ PROTUPROVJERA: staro ponasanje (redoslijed iz baze) mora pasti na tvrdnjama
 *     o redoslijedu — inace test ne cuva nista.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'optionOrder.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/optionOrder';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const real = await import(pathToFileURL(out).href);

// Stvarni popisi s PROD-a (07.10.2026.)
const TIP = ['N/A', 'auto C5', 'auto Lacetti', 'Prijevoz', 'Domaćinstvo', 'Informatika', 'Investicije',
  'Kuća', 'Prihodi', 'Osiguranje', 'Advokati', 'Porezi', 'Projekti', 'Putovanja', 'Razno', 'Transfer',
  'Zabava', 'Zdravlje'];
const PODTIP = {
  Razno: ['Odjeća/obuća/ostalo_Koka', 'Odjeća/obuća/ostalo_Sasa', 'Pokloni', 'Temu', 'Razno, sitnice', "Nena's funds"],
  Zabava: ['Kino/Kazalište/Muzeji', 'Audible_Koka', 'Audible_Sasa', 'Kindle_Koka', 'Disney', 'Sky', 'Prime',
    'HBOmax', 'Youtube', 'Spotify', 'Wellness'],
};
const SMJER = ['Uplata', 'Isplata', 'PROVJERI'];

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}${extra ? ' | ' + extra : ''}`); }
  };
  const tip = lib.orderForDisplay(TIP, [TIP]);
  ok('N/A ostaje prvi', tip[0] === 'N/A', tip.join(', '));
  ok('Advokati odmah iza N/A', tip[1] === 'Advokati', tip.join(', '));
  ok('auto C5 medju A (velicina slova se ne gleda)', tip.indexOf('auto C5') === 2, tip.join(', '));
  ok('Zdravlje zadnji', tip[tip.length - 1] === 'Zdravlje', tip.join(', '));
  ok('Domaćinstvo prije Informatika', tip.indexOf('Domaćinstvo') < tip.indexOf('Informatika'));
  ok('isti skup opcija, nista izgubljeno', [...tip].sort().join() === [...TIP].sort().join());
  const all = Object.values(PODTIP);
  const razno = lib.orderForDisplay(PODTIP.Razno, all);
  ok('kratki popis dugog atributa je abecedan (Razno)', razno[0] === "Nena's funds", razno.join(', '));
  const smjer = lib.orderForDisplay(SMJER, [SMJER]);
  ok('kratak atribut cuva redoslijed vlasnika (Smjer)', smjer.join() === SMJER.join(), smjer.join(', '));
  ok('ulaz se ne mijenja', TIP[1] === 'auto C5');
  ok('č poslije c (hr kolacija)', lib.sortOptions(['čaj', 'cvijet', 'dan'])[1] === 'čaj',
    lib.sortOptions(['čaj', 'cvijet', 'dan']).join(', '));
  return { pass, fail };
}

const r = run(real, 'optionOrder');
// Protuprovjera: redoslijed iz baze (stanje prije S164) mora pasti.
const stari = { orderForDisplay: o => [...o], sortOptions: o => [...o] };
const s = run(stari, 'PROTUPROVJERA stari redoslijed');
console.log(`optionOrder: ${r.pass} prolaz, ${r.fail} pad · protuprovjera pada ${s.fail} (mora > 0)`);
if (r.fail > 0 || s.fail === 0) process.exit(1);
