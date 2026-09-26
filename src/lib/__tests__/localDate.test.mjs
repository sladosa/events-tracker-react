/**
 * S152 — lokalni dan umjesto UTC dana.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   `toISOString().split('T')[0]` je UTC dan; u Zagrebu je za lokalnu ponoc to
 *   DAN PRIJE. Izmjereno 26.09.2026.: „This Month" = `2026-08-31 → 2026-09-29`
 *   (izostavljen 30.09.), „This Year" = `2025-12-31 → 2026-12-30`.
 *
 * ⚠ Zona se postavlja OVDJE, prije ijednog `Date`-a: u UTC-u (CI) su oba
 *   racuna ista, pa bi test prolazio i nad pokvarenim kodom.
 */
process.env.TZ = 'Europe/Zagreb';

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'localDate.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export { localYmd } from './src/lib/localDate';",
      "export { getDatePresets } from './src/hooks/useDateBounds';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000',
      VITE_APP_ENV: 'test',
    }),
  },
});
const { localYmd, getDatePresets } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

ok('zona je doista postavljena (inace test ne mjeri nista)',
   new Date(2026, 8, 1).getTimezoneOffset() === -120, `${new Date(2026, 8, 1).getTimezoneOffset()}`);

console.log('');
console.log('localYmd:');
ok('lokalna ponoc 01.09. => 2026-09-01', localYmd(new Date(2026, 8, 1)) === '2026-09-01');
ok('00:30 lokalno => taj dan, ne prethodni', localYmd(new Date(2026, 8, 26, 0, 30)) === '2026-09-26');
ok('zimsko vrijeme, 31.12. ponoc', localYmd(new Date(2026, 11, 31)) === '2026-12-31');

console.log('');
console.log('Predlosci filtra:');
const p = Object.fromEntries(getDatePresets().map(x => [x.key, x.getRange()]));
const now = new Date();
const y = now.getFullYear(), m = now.getMonth();
const lastDom = new Date(y, m + 1, 0).getDate();
const mm = String(m + 1).padStart(2, '0');
ok('This Month pocinje 1. u mjesecu', p['this-month'].from === `${y}-${mm}-01`, p['this-month'].from);
ok('This Month zavrsava ZADNJIM danom', p['this-month'].to === `${y}-${mm}-${lastDom}`, p['this-month'].to);
ok('This Year = 01.01. – 31.12.', p['this-year'].from === `${y}-01-01` && p['this-year'].to === `${y}-12-31`,
   `${p['this-year'].from} → ${p['this-year'].to}`);
ok('Today = lokalni danas', p['today'].from === localYmd(now));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
