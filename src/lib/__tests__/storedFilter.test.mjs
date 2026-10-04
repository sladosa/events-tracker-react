/**
 * S160 — zapamceni filtar vrijedi samo za korisnika koji ga je snimio.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   `dbScopedKey` (S140) veze kljuc uz bazu, ne uz korisnika. Prijava drugog racuna
 *   u istom pregledniku obnovila je tudji `areaId` ⇒ zuta traka i prazan Structure
 *   (Sasin nalaz 03.10.). Najopasniji je zapis BEZ `userId`: prihvati li se, prvo
 *   spremanje utisne trenutnog korisnika i tudji filtar postane „moj".
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'storedFilter.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { parseStoredFilter } from './src/lib/storedFilter';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { parseStoredFilter } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const SASA = 'u-sasa', KOKA = 'u-koka';
const chain = [{ id: 'c1', name: 'Transakcija' }];
const rec = (o) => JSON.stringify({ areaId: 'a1', selectionChain: chain, selectedShortcutId: 's1', ...o });

const mine = parseStoredFilter(rec({ userId: KOKA }), KOKA);
ok('vlastiti zapis se obnavlja', mine?.areaId === 'a1' && mine?.selectionChain.length === 1 && mine?.selectedShortcutId === 's1');
ok('TUDJI zapis se odbacuje (nalaz 03.10.)', parseStoredFilter(rec({ userId: SASA }), KOKA) === null);
ok('zapis BEZ userId (prije S160) se odbacuje', parseStoredFilter(rec({}), KOKA) === null);
ok('nepoznat korisnik ne obnavlja nista', parseStoredFilter(rec({ userId: KOKA }), null) === null);
ok('nema zapisa => null', parseStoredFilter(null, KOKA) === null);
ok('pokvaren JSON => null, ne pad', parseStoredFilter('{not json', KOKA) === null);
ok('`null` u JSON-u => null', parseStoredFilter('null', KOKA) === null);
const noChain = parseStoredFilter(JSON.stringify({ userId: KOKA, areaId: 'a1' }), KOKA);
ok('samo Area (bez lanca) => prazan lanac', noChain?.areaId === 'a1' && Array.isArray(noChain?.selectionChain) && noChain.selectionChain.length === 0);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
