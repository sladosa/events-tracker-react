/**
 * dayDrillReturn.test.mjs — povratak na Overview vraća razdoblje od prije
 * „isti dan u Activities ↗" (S172, Sašin nalaz)
 *
 * /!\ Bez povratka saldo pokazuje stanje NA TAJ DAN, a ne danas — broj koji se
 *     ne slaže s bankom, bez ikakve poruke.
 * /!\ Razdoblje koje je čovjek u Activities promijenio sam NE smije se pregaziti.
 * /!\ Snimka se troši jednom — inače bi vratila razdoblje nekom kasnijem povratku.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'dayDrillReturn.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/dayDrillReturn';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@': join(process.cwd(), 'src') },
});
const m = await import(pathToFileURL(out).href + '?t=' + Date.now());

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`}`);
};

const before = {
  area: 'A', day: '2026-10-02',
  dateFrom: '2026-01-01', dateTo: '2026-12-31', periodLabel: 'This Year', periodKey: 'this-year',
};
const onDay = { areaId: 'A', dateFrom: '2026-10-02', dateTo: '2026-10-02', periodKey: 'custom' };

m.rememberPeriodBeforeDay(before);
eq('filtar još na danu ⇒ vrati This Year', m.takePeriodToRestore(onDay), before);
eq('troši se jednom: drugi povratak ništa', m.takePeriodToRestore(onDay), null);

m.rememberPeriodBeforeDay(before);
eq('čovjek u Activities izabrao This Month ⇒ ostaje njegov',
  m.takePeriodToRestore({ areaId: 'A', dateFrom: '2026-10-01', dateTo: '2026-10-31', periodKey: 'this-month' }), null);
eq('… i snimka je potrošena', m.takePeriodToRestore(onDay), null);

m.rememberPeriodBeforeDay(before);
eq('Custom, ali drugi dan ⇒ ne vraća',
  m.takePeriodToRestore({ ...onDay, dateFrom: '2026-10-01', dateTo: '2026-10-02' }), null);

m.rememberPeriodBeforeDay(before);
eq('druga Area ⇒ ne vraća', m.takePeriodToRestore({ ...onDay, areaId: 'B' }), null);

eq('bez ↗ ⇒ ništa', m.takePeriodToRestore(onDay), null);

console.log(failed ? `\n❌ ${failed} pao` : '\n✅ sve prolazi');
process.exit(failed ? 1 : 0);
