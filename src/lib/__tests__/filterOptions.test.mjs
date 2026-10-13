/**
 * filterOptions.test.mjs — „Filter by" nudi izbornik i za depends_on atribut (S170)
 *
 * ZASTO POSTOJI
 *   Izbornik je dobivao samo atribut s ravnim `suggest` popisom. `Podtip`,
 *   `Izvor` i `Status` (opcije po roditelju) dobivali su polje za tekst s
 *   `ilike` — `Popravci` je vracao 30 redaka umjesto 18.
 *
 * /!\ Dugi atribut se grupira po roditelju, kratki je ravan popis BEZ
 *     ponavljanja (`Status` bi inace imao 4 grupe s istim `Planiran, Izvrsen`).
 * /!\ PROTUPROVJERA: staro pravilo (samo `parsed.options`) mora pasti.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'filterOptions.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/filterOptions'; export { parseValidationRules } from './src/hooks/useAttributeDefinitions';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@': join(process.cwd(), 'src') },
  external: ['react', 'react-dom'],
  // useAttributeDefinitions vuče supabaseClient — lažna adresa, nijedan poziv ne ide van
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'x' }) },
});
const real = await import(pathToFileURL(out).href);

// Oblici pravila kao na TEST/PROD `Financije_all` (13.10.2026.)
const RULES = {
  tip: { type: 'suggest', suggest: ['N/A', 'auto C5', 'Kuća', 'Zabava', 'Prijevoz', 'Domaćinstvo', 'Razno', 'Zdravlje'] },
  podtip: { type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: {
    '*': [], 'N/A': [],
    Kuća: ['Popravci, održavanje', 'Režije', 'Osiguranje'],
    'auto C5': ['gorivo', 'popravci', 'registracija', 'gume'],
    'auto Lacetti': ['gorivo', 'servis'],
    Zabava: ['Kino/Kazalište/Muzeji', 'Audible_Koka', 'Audible_Sasa', 'Kindle_Koka', 'Disney', 'Sky', 'Prime', 'Spotify'],
  } } },
  izvor: { type: 'suggest', depends_on: { attribute_slug: 'racun', options_map: {
    '*': [], 'Sašin tekući RF': ['Racun', 'Visa', 'Cash'], 'Kokin tekući ZABA': ['Racun', 'Mastercard', 'Cash'],
  } } },
  status: { type: 'suggest', depends_on: { attribute_slug: 'izvorplacanja', options_map: {
    '*': [], Cash: ['Izvrsen', 'Planiran'], Visa: ['Planiran', 'Izvrsen'], Racun: ['Izvrsen', 'Planiran'], Mastercard: ['Planiran', 'Izvrsen'],
  } } },
  iznos: { type: 'suggest', depends_on: { attribute_slug: 'smjer', options_map: { '*': [], Isplata: [] } } },
  slobodno: null,
};

// Staro ponasanje iz AppHome: izbornik samo uz ravan popis
const OLD = {
  buildFilterOptionGroups(parsed) {
    const ok = (parsed.type === 'suggest' || parsed.type === 'enum') && parsed.options.length > 0;
    return ok ? [{ label: null, options: parsed.options }] : [];
  },
};

function run(lib, label) {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    if (cond) pass++; else { fail++; console.log(`  FAIL  [${label}] ${name}${extra ? ' | ' + extra : ''}`); }
  };
  const g = slug => lib.buildFilterOptionGroups(real.parseValidationRules(RULES[slug]));
  const all = groups => groups.flatMap(x => x.options);

  const izvor = g('izvor');
  ok('Izvor dobiva izbornik', izvor.length > 0);
  ok('Izvor je ravan popis (kratak atribut)', izvor.length === 1 && izvor[0]?.label === null, JSON.stringify(izvor));
  ok('Izvor bez ponavljanja, redom vlasnika', all(izvor).join() === 'Racun,Visa,Cash,Mastercard', all(izvor).join());

  const status = g('status');
  ok('Status ravan, dvije opcije', all(status).join() === 'Izvrsen,Planiran', all(status).join());

  const podtip = g('podtip');
  ok('Podtip dobiva izbornik', podtip.length > 0);
  ok('Podtip grupiran po Tipu (dug atribut)', podtip.every(x => x.label !== null) && podtip.length === 4,
    podtip.map(x => x.label).join());
  ok('prazne grupe (* i N/A) izostavljene', !podtip.some(x => x.label === '*' || x.label === 'N/A'));
  ok('grupe abecedno (auto C5 prije Kuća)', podtip[0]?.label === 'auto C5', podtip.map(x => x.label).join());
  ok('gorivo pod oba auta', podtip.filter(x => x.options.includes('gorivo')).length === 2);
  ok('opcije u grupi abecedno', podtip.find(x => x.label === 'Kuća')?.options.join() === 'Osiguranje,Popravci, održavanje,Režije');

  const tip = g('tip');
  ok('Tip ravan i abecedan (≥7), N/A prvi', all(tip)[0] === 'N/A' && all(tip)[1] === 'auto C5' && all(tip).at(-1) === 'Zdravlje', all(tip).join());

  ok('atribut bez ijedne opcije ⇒ polje za tekst', g('iznos').length === 0);
  ok('bez pravila ⇒ polje za tekst', g('slobodno').length === 0);
  return { pass, fail };
}

const r = run(real, 'novo');
const o = run(OLD, 'staro');
console.log(`filterOptions: ${r.pass} prolaz, ${r.fail} pad | protuprovjera (staro): ${o.fail} pad`);
if (r.fail > 0) { console.log('❌ filterOptions'); process.exit(1); }
if (o.fail === 0) { console.log('❌ protuprovjera ne pada — test ne čuva ništa'); process.exit(1); }
console.log('✅ filterOptions');
