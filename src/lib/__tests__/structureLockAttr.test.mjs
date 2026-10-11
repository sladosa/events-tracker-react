/**
 * S155 C3b — `LockAttr` na Structure uvozu.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Uvoz Automations sheeta ZAMJENJUJE sva `set_attribute` pravila Aree. File
 *   izvezen prije S155 nema kolonu `LockAttr`, pa bi bez ovoga svaki takav uvoz
 *   tiho obrisao zig — i Edit bi opet pomicao bankin datum naplate. Isti razred
 *   kao `HiddenInAdd` (S139/S149): nema kolone ≠ prazna celija.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'structureLock.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export { resolveLockSlug, resolveRemainderMap } from './src/lib/structureImport';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, external: ['exceljs'], alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000',
      VITE_APP_ENV: 'test',
    }),
  },
});
const { resolveLockSlug, resolveRemainderMap } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

const DB = [
  { action: 'set_attribute', target_slug: 'datum_naplate', map_slug: 'izvorplacanja',
    date_map: { Racun: 'same' }, lock_slug: 'izvod_opis' },
  { action: 'set_attribute', target_slug: 'drugi', map_slug: 'izvorplacanja', date_map: { Racun: 'same' } },
];

console.log('');
console.log('Kolona LockAttr koje NEMA ne brise zig:');
ok('bez kolone, pravilo u bazi ima zig => ostaje',
   resolveLockSlug(false, '', DB, 'datum_naplate', 'izvorplacanja') === 'izvod_opis');
ok('bez kolone, pravilo u bazi nema zig => prazno',
   resolveLockSlug(false, '', DB, 'drugi', 'izvorplacanja') === '');
ok('bez kolone, novo pravilo (drugi par) => prazno',
   resolveLockSlug(false, '', DB, 'datum_naplate', 'racun') === '');
ok('bez kolone, Area bez pravila => prazno', resolveLockSlug(false, '', undefined, 'datum_naplate', 'izvorplacanja') === '');

console.log('');
console.log('Kolona postoji — vrijedi file:');
ok('prazna celija => zig obrisan (namjerno)', resolveLockSlug(true, '', DB, 'datum_naplate', 'izvorplacanja') === '');
ok('upisan zig => taj', resolveLockSlug(true, ' izvod_opis ', DB, 'drugi', 'izvorplacanja') === 'izvod_opis');

console.log('');
console.log('T22 (S168) — kolona Remainder na rata retku, isto nacelo:');
const RM = { Mastercard: 'last', Visa: 'first' };
const j = x => JSON.stringify(x);
ok('bez kolone => pravilo iz baze ostaje', j(resolveRemainderMap(false, '', RM)) === j(RM));
ok('bez kolone, baza bez pravila => nista', resolveRemainderMap(false, '', undefined) === undefined);
ok('kolona, prazna celija => nista (svi first)', resolveRemainderMap(true, '', RM) === undefined);
ok('kolona, upisano => procitano', j(resolveRemainderMap(true, ' Mastercard = LAST | Visa=first ', undefined)) === j(RM));
ok('kolona, nepoznata oznaka => null (redak se preskace)', resolveRemainderMap(true, 'Mastercard=zadnja', RM) === null);
ok('kolona, bez znaka = => null', resolveRemainderMap(true, 'Mastercard', RM) === null);
ok('vraca KOPIJU (ne mijenja bazu)', resolveRemainderMap(false, '', RM) !== RM);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
