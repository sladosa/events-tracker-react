/**
 * listColumnMap.test.mjs — ćelija `Map` u sheetu `ListColumns` preživi Structure roundtrip (S186)
 *
 * ZASTO POSTOJI
 *   Izvoz je parove pisao s ` | `, uvoz dijelio na golom `|`. Ključ s `|` (smajlić `:-|`,
 *   DIARY raspoloženje 794 dana) se raspolovio, pa je nakon svakog Structure uvoza kolona
 *   za te retke pokazivala sirovu vrijednost. Uhvatio E2E S186_attr_restructure.
 *
 * /!\ Stare, rukom pisane ćelije bez razmaka (`a = b|c = d`) moraju i dalje raditi.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'listColumnMap.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export { serializeColumnMap, parseColumnMap } from './src/lib/listColumns';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000', VITE_APP_ENV: 'test',
    }),
  },
});
const { serializeColumnMap, parseColumnMap } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        dobio ${g}\n        htio  ${w}`); }
};

const FACES = { ':-(': '☹', ':-/': '🙁', ':-|': '😐', ':-)': '🙂', ':-D': '😀' };
const ACCOUNTS = { 'Kokin tekući ZABA': 'ZABA', 'Sašin tekući RF': 'RF' };

eq('smajlići s :-| — roundtrip', parseColumnMap(serializeColumnMap(FACES)), FACES);
eq('kratice računa — roundtrip', parseColumnMap(serializeColumnMap(ACCOUNTS)), ACCOUNTS);
eq('stara ćelija bez razmaka', parseColumnMap('Kokin tekući ZABA = ZABA|Sašin tekući RF = RF'), ACCOUNTS);
eq('stara ćelija, razmak samo s jedne strane', parseColumnMap('a = x |b = y'), { a: 'x', b: 'y' });
eq('vrijednost smije imati =', parseColumnMap('x = a=b'), { x: 'a=b' });
eq('prazna ćelija', parseColumnMap(''), {});
eq('par bez = se preskače', parseColumnMap('a = x | smeće | b = y'), { a: 'x', b: 'y' });
eq('prazan map ⇒ prazna ćelija', serializeColumnMap(undefined), '');

console.log(`\n${pass} prolaz, ${fail} pad`);
if (fail) process.exit(1);
