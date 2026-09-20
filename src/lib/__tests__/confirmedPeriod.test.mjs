/**
 * S143 faza 4 — „je li ovaj redak vec unutar potvrdjenog stanja?"
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Isto pitanje postavljaju DVA mjesta: delta sheet (kolona `Potvrda`, kroz
 *   Excel formulu) i uvoz (guard). Raziđu li se, sheet bi redak oznacio kao
 *   potvrdjen a uvoz bi ga pustio bez pitanja — i to bi bilo nevidljivo, jer
 *   izmjena retka prije sidra NE MICE saldo.
 *   Zato je pravilo izdvojeno u cistu funkciju i ovdje se mjeri bez baze.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'confirmedPeriod.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/confirmedPeriod';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'e.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { findCoveringAnchor, hrDate } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const ZABA = 'Kokin tekući ZABA';
const RF   = 'Sašin tekući RF';
const A = [
  { group_value: ZABA, confirmed_on: '2026-09-06', amount: 12772.86 },
  { group_value: ZABA, confirmed_on: '2026-07-30', amount: 13815.33 },
  { group_value: ZABA, confirmed_on: '2025-01-01', amount:  3054.41 },
  { group_value: RF,   confirmed_on: '2026-09-07', amount:   690.79 },
];

console.log('');
console.log('Koja potvrda obuhvaca redak:');
{
  // /!\ NAJRANIJA potvrda koja ga obuhvaca, ne najnovija — isto pravilo po
  //   kojem kolona `Potvrda` dodjeljuje oznake. Najnovija bi za svaki stari
  //   redak imenovala isto (zadnje) sidro, pa bi poruka bila bezvrijedna: ne
  //   bi rekla KADA je redak postao potvrden.
  const m = findCoveringAnchor(A, ZABA, '2025-08-17');
  ok('nadje potvrdu koja obuhvaca redak', m !== null);
  ok('to je NAJRANIJA takva, ne najnovija', m?.confirmedOn === '2026-07-30',
     `got ${m?.confirmedOn}`);
  ok('nosi iznos te potvrde (poruka mora IMENOVATI sidro)', m?.amount === 13815.33,
     `got ${m?.amount}`);
}

console.log('');
console.log('Granica je `>=`, ne `>` (sidro potvrduje stanje na KRAJU svog dana):');
{
  // §2.17: saldo su promjene STROGO NAKON sidra ⇒ redak datiran tocno na dan
  // sidra je vec uracunat u potvrdjeni iznos.
  ok('redak TOCNO na dan sidra JE potvrden',
     findCoveringAnchor(A, ZABA, '2025-01-01')?.confirmedOn === '2025-01-01');
  ok('redak dan POSLIJE pripada sljedecoj potvrdi',
     findCoveringAnchor(A, ZABA, '2025-01-02')?.confirmedOn === '2026-07-30');
  ok('redak poslije SVIH potvrda nije potvrden',
     findCoveringAnchor(A, ZABA, '2026-09-07') === null);
}

console.log('');
console.log('Potvrde su PO RACUNU, ne po Arei:');
{
  // Lazna oznaka na tudjem racunu gora je od izostanka — naucila bi korisnika
  // da guard preskace.
  ok('RF sidro ne potvrduje ZABA redak',
     findCoveringAnchor([A[3]], ZABA, '2025-08-17') === null);
  ok('ZABA sidra ne potvrduju RF redak',
     findCoveringAnchor(A.slice(0, 3), RF, '2025-08-17') === null);
  ok('a vlastiti racun se i dalje prepozna',
     findCoveringAnchor(A, RF, '2025-08-17')?.confirmedOn === '2026-09-07');
}

console.log('');
console.log('Nepoznat racun ili datum -> bez tvrdnje:');
{
  ok('bez racuna nema odgovora', findCoveringAnchor(A, null, '2025-08-17') === null);
  ok('bez datuma nema odgovora', findCoveringAnchor(A, ZABA, null) === null);
  ok('prazan racun nije racun',  findCoveringAnchor(A, '', '2025-08-17') === null);
  ok('Area bez sidara ne tvrdi nista', findCoveringAnchor([], ZABA, '2025-08-17') === null);
}

console.log('');
console.log('Usporedba je STRINGOVNA, bez vremenskih zona:');
{
  // /!\ `new Date('2026-01-01')` je UTC ponoc; u lokalnoj zoni iza UTC-a to je
  //   31.12. — pa bi granica preskocila dan. `YYYY-MM-DD` se usporeduje kao
  //   tekst i to je ispravno po konstrukciji formata.
  ok('prijelaz godine ne pomice dan',
     findCoveringAnchor([{ group_value: ZABA, confirmed_on: '2025-12-31', amount: 1 }], ZABA, '2026-01-01') === null);
  ok('a dan prije je i dalje potvrden',
     findCoveringAnchor([{ group_value: ZABA, confirmed_on: '2025-12-31', amount: 1 }], ZABA, '2025-12-31') !== null);
}

console.log('');
console.log('Ispis datuma:');
ok('hrDate daje DD.MM.YYYY.', hrDate('2026-07-30') === '30.07.2026.', `got ${hrDate('2026-07-30')}`);

rmSync(out, { force: true });
console.log('');
console.log(`${fail === 0 ? `All ${pass} tests passed.` : `${fail} FAILED, ${pass} passed.`}`);
process.exit(fail === 0 ? 0 : 1);
