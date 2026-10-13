/**
 * rataCountProblem.test.mjs — `Rate?` = Da bez broja rata ne prolazi tiho (S170)
 *
 * ZASTO POSTOJI
 *   `detectRata` za `count <= 1` vraca null ⇒ Finish spremi redak koji tvrdi da
 *   je plan na rate, a rata nema, bez ijedne rijeci (Sasa na T-S168-1).
 *
 * /!\ PROTUPROVJERA: „bez provjere" (uvijek null) mora pasti.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'rataCountProblem.bundle.mjs');
await build({
  stdin: { contents: "export * from './src/lib/rataAutomation';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@': join(process.cwd(), 'src') },
});
const real = await import(pathToFileURL(out).href);
const OLD = { rataCountProblem: () => null };

// Isti slugovi kao `Financije_all` (automations.rata)
const DEFS = [
  { id: 'd-rate', slug: 'rate', name: 'Rate?' },
  { id: 'd-broj', slug: 'brojrata', name: 'Broj rata' },
  { id: 'd-iznos', slug: 'isplata', name: 'Isplata' },
];
const CFG = { trigger_slug: 'rate', count_slug: 'brojrata', amount_slug: 'isplata' };

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}${extra ? ' | ' + extra : ''}`); }
  };
  const p = (vals, cfg = CFG) => lib.rataCountProblem(id => vals[id], DEFS, cfg ?? undefined);

  const empty = p({ 'd-rate': true });
  ok('Da + prazan broj ⇒ poruka', typeof empty === 'string' && empty.includes('Broj rata') && empty.includes('prazan'), String(empty));
  ok('Da + broj 1 ⇒ poruka', typeof p({ 'd-rate': true, 'd-broj': 1 }) === 'string');
  ok('"true" kao tekst + prazan ⇒ poruka', typeof p({ 'd-rate': 'true', 'd-broj': '' }) === 'string');
  ok('Da + 2,5 ⇒ poruka', typeof p({ 'd-rate': true, 'd-broj': '2,5' }) === 'string');
  ok('Da + 6 ⇒ u redu', p({ 'd-rate': true, 'd-broj': 6 }) === null);
  ok('Da + "3" ⇒ u redu', p({ 'd-rate': true, 'd-broj': '3' }) === null);
  ok('Ne + prazan ⇒ u redu', p({ 'd-rate': false }) === null);
  ok('bez okidača ⇒ u redu', p({}) === null);
  ok('Area bez rata configa ⇒ u redu', p({ 'd-rate': true }, null) === null);
  return { pass, fail };
}

const r = run(real, 'novo');
const o = run(OLD, 'staro');
console.log(`rataCountProblem: ${r.pass} prolaz, ${r.fail} pad | protuprovjera (staro): ${o.fail} pad`);
if (r.fail > 0) { console.log('❌ rataCountProblem'); process.exit(1); }
if (o.fail === 0) { console.log('❌ protuprovjera ne pada — test ne čuva ništa'); process.exit(1); }
console.log('✅ rataCountProblem');
