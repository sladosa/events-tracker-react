/**
 * filterSummary.test.mjs — sklopljen filtar kaže što je aktivno; Overview
 * uskog ekrana nudi samo razdoblje (S171, Saša; Backlog B9)
 *
 * ZASTO POSTOJI
 *   Zaglavlje je pisalo samo „Filter", pa ga Koka na iPhoneu nije sklapala —
 *   sklopljen bi sakrio razdoblje pločice razreza i uvjet s drilla.
 *
 * /!\ Datum se NE parsira kroz `Date` (zona pomakne dan, S152) — test zato
 *     sam postavi zonu iza UTC-a, gdje bi `new Date('2026-01-01')` dao 31.12.
 * /!\ Na Overviewu (`period-only`) uvjet se NE prikazuje: na pločice ne djeluje.
 */
process.env.TZ = 'America/New_York';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'filterSummary.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/filterSummary';",
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

// ── filterMode: uvjet „uski + tab" na jednom mjestu ──────────────────────────
eq('uski Overview ⇒ samo razdoblje', m.filterMode(true, 'overview'), 'period-only');
eq('uski Activities ⇒ puni', m.filterMode(true, 'activities'), 'full');
eq('široki Overview ⇒ puni', m.filterMode(false, 'overview'), 'full');
eq('uski Structure ⇒ puni', m.filterMode(true, 'structure'), 'full');

// ── mustStayOpen: bez Aree selektor se ne skriva, ali obnova nije „bez Aree" ─
eq('nema Aree ⇒ ostaje otvoren', m.mustStayOpen({ areaId: null, restoring: false }), true);
eq('obnova u tijeku ⇒ smije biti sklopljen', m.mustStayOpen({ areaId: null, restoring: true }), false);
eq('Area postoji ⇒ smije', m.mustStayOpen({ areaId: 'a', restoring: false }), false);

// ── formatRangeShort ─────────────────────────────────────────────────────────
eq('ista godina: godina jednom', m.formatRangeShort('2026-01-01', '2026-10-14'), '01.01.–14.10.2026.');
eq('različite godine', m.formatRangeShort('2025-12-01', '2026-01-31'), '01.12.2025.–31.01.2026.');
eq('jedan dan', m.formatRangeShort('2026-10-14', '2026-10-14'), '14.10.2026.');
eq('prazno', m.formatRangeShort(null, null), '');
eq('samo do', m.formatRangeShort(null, '2026-10-14'), 'do 14.10.2026.');

// ── describeAttrFilter ───────────────────────────────────────────────────────
eq('izbornik = točno', m.describeAttrFilter({ name: 'Podtip', value: 'Popravci', isExact: true }), 'Podtip = Popravci');
eq('tekst ~', m.describeAttrFilter({ name: 'Opis', value: 'gorivo', isExact: false }), 'Opis ~ "gorivo"');
eq('bilo koji atribut', m.describeAttrFilter({ name: null, value: 'x', isExact: false }), 'Any attribute ~ "x"');
eq('broj', m.describeAttrFilter({ name: 'Iznos', value: '1000', isExact: false, op: 'gt' }), 'Iznos > 1000');
eq('datum', m.describeAttrFilter({ name: 'Datum naplate', value: '2026-11-11', isExact: false, op: 'eq', kind: 'datetime' }), 'Datum naplate = 11.11.2026.');
eq('da/ne', m.describeAttrFilter({ name: 'Rate?', value: 'true', isExact: false, op: 'eq', kind: 'boolean' }), 'Rate? = Yes');

// ── filterSummaryParts ───────────────────────────────────────────────────────
const base = { periodLabel: 'This Year', dateFrom: '2026-01-01', dateTo: '2026-12-31' };
const drill = { name: 'Racun', value: 'Kokin tekući ZABA', isExact: true };
eq('Activities: razdoblje + uvjet s drilla',
  m.filterSummaryParts({ ...base, mode: 'full', attr: drill }),
  ['This Year · 01.01.–31.12.2026.', 'Racun = Kokin tekući ZABA']);
eq('Overview: samo razdoblje, uvjet se ne pokazuje',
  m.filterSummaryParts({ ...base, mode: 'period-only', attr: drill }),
  ['This Year · 01.01.–31.12.2026.']);
eq('komentar kad nema atributnog uvjeta',
  m.filterSummaryParts({ ...base, mode: 'full', commentSearch: '~' }),
  ['This Year · 01.01.–31.12.2026.', 'Comment ~ "~"']);
eq('prazna vrijednost uvjeta se ne pokazuje',
  m.filterSummaryParts({ ...base, mode: 'full', attr: { ...drill, value: '' } }),
  ['This Year · 01.01.–31.12.2026.']);

console.log(failed ? `\n❌ ${failed} pao` : '\n✅ sve prolazi');
process.exit(failed ? 1 : 0);
