/**
 * navAndLine2.test.mjs — S171 (Saša, nakon T-S171-4)
 *
 * 1. `replaceSessionInNav`: popis za Prev/Next putuje View → Edit → View; Save
 *    koji promijeni datum mijenja `session_start` — redak se u popisu ZAMIJENI,
 *    inače View ugasi i Prev i Next (`currentIndex = -1`).
 * 2. `attrColumnText` / `line2Text`: košara piše kupnju kao drugi redak uske
 *    liste (Tip/Podtip · opis) — JEDNA kopija pravila s listom.
 *
 * /!\ PROTUPROVJERA: isti trenutak u dva zapisa (`+00:00` iz baze, `.000Z` iz
 *     `toISOString`) mora se prepoznati — stringovna usporedba bi ga promašila.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = join(process.cwd(), 'node_modules', '.cache');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'navAndLine2.bundle.mjs');
await build({
  stdin: {
    contents: "export * from './src/lib/navActivities'; export { attrColumnText, line2Text, resolveColumns } from './src/lib/listColumns';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@': join(process.cwd(), 'src') },
  external: ['react', 'react-dom'],
  // listColumns vuče supabaseClient — lažna adresa, nijedan poziv ne ide van
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'x' }) },
});
const m = await import(pathToFileURL(out).href + '?t=' + Date.now());

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`}`);
};

// ── replaceSessionInNav ──────────────────────────────────────────────────────
const g = (ss, cat = 'c1', user = 'u1') => ({
  sessionKey: `${user}_${cat}_${ss}`, category_id: cat, user_id: user, session_start: ss,
  events: [{ id: `e-${ss}`, session_start: ss }],
});
const list = [g('2026-09-29T10:00:00+00:00'), g('2026-10-02T10:00:00+00:00'), g('2026-10-02T10:00:00+00:00', 'c2')];
const r = m.replaceSessionInNav(list, '2026-10-02T10:00:00.000Z', '2026-10-05T08:00:00.000Z', 'c1');
eq('isti trenutak u drugom zapisu ⇒ zamijenjen', r[1].session_start, '2026-10-05T08:00:00.000Z');
eq('ključ izračunat iznova', r[1].sessionKey, 'u1_c1_2026-10-05T08:00:00.000Z');
eq('i u eventu', r[1].events[0].session_start, '2026-10-05T08:00:00.000Z');
eq('druga kategorija istog trena netaknuta', r[2].session_start, '2026-10-02T10:00:00+00:00');
eq('ostali netaknuti (isti objekt)', r[0] === list[0], true);
eq('ništa ne odgovara ⇒ isti sadržaj', JSON.stringify(m.replaceSessionInNav(list, '2020-01-01T00:00:00Z', 'x', 'c1')), JSON.stringify(list));
eq('navFromState: popis', m.navFromState({ navActivities: list })?.length, 3);
eq('navFromState: nema ⇒ null', m.navFromState({ collapseFilter: true }), null);
eq('navFromState: null state', m.navFromState(null), null);

// ── attrColumnText / line2Text ───────────────────────────────────────────────
const cols = m.resolveColumns({ columns: [
  { role: 'date', mobile: 'line1' },
  { role: 'attr', slugs: ['racun'], map: { 'Kokin tekući ZABA': 'ZABA' }, mobile: 'line1' },
  { role: 'attr', slugs: ['tip', 'podtip'], sep: '/', mobile: 'line2' },
  { role: 'comment', mobile: 'line2' },
] });
const line2 = cols.filter(c => c.mobile === 'line2');
const t = (o) => new Map(Object.entries(o));
eq('Tip/Podtip · opis', m.line2Text(line2, t({ tip: 'Putovanja', podtip: 'Smještaj' }), 'Kutjevo booking 2/2'),
  'Putovanja/Smještaj · Kutjevo booking 2/2');
eq('bez opisa ⇒ samo Tip/Podtip', m.line2Text(line2, t({ tip: 'Prijevoz', podtip: 'Taksi, Zet, Parking' }), null),
  'Prijevoz/Taksi, Zet, Parking');
eq('N/A/N/A ⇒ jednom', m.line2Text(line2, t({ tip: 'N/A', podtip: 'N/A' }), ''), 'N/A');
eq('vrijednosti još nema ⇒ opis', m.line2Text(line2, undefined, 'Konzum'), 'Konzum');
eq('ništa ⇒ prazno', m.line2Text(line2, undefined, '  '), '');
eq('map skraćuje (line1 kolona)', m.attrColumnText(cols[1], t({ racun: 'Kokin tekući ZABA' })), 'ZABA');
eq('nepoznata vrijednost cijela', m.attrColumnText(cols[1], t({ racun: 'Novi račun' })), 'Novi račun');
eq('bez configa: zadane kolone ne pucaju', typeof m.line2Text(m.resolveColumns(null).filter(c => c.mobile === 'line2'), undefined, 'x'), 'string');

console.log(failed ? `\n❌ ${failed} pao` : '\n✅ sve prolazi');
process.exit(failed ? 1 : 0);
