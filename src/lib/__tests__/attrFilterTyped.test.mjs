/**
 * S160 — „Filter by" za datum i da/ne (Backlog „Potpuni attrFilter").
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Datum se usporeduje na razini DANA, a baza drzi trenutak. Granica pomaknuta
 *   za jedan dan izgleda kao ispravan filtar s jednim retkom manje — ista vrsta
 *   kvara kao `p_from` (S144) i UTC dan (S152). Uvjet koji se ne da procitati
 *   NE SMIJE filtrirati (F4 pravilo): lista bez filtra je vidljiva, krivi filtar nije.
 *
 * ⚠ Zona je Zagreb namjerno: granice su UTC, i test mora pasti ako ih netko
 *   „popravi" u lokalne (u UTC-u bi oba racuna bila ista).
 */
process.env.TZ = 'Europe/Zagreb';

import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'attrFilterTyped.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export { dateFilterBounds, booleanFilterValue, describeTypedFilter, kindForDataType } from './src/lib/attrFilterNumeric';",
      "export { isAttrFilterActive, attrFilterJoinClause, applyEventFilters } from './src/lib/eventQueryBuilder';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_TEMPLATE_USER_ID: '00000000-0000-0000-0000-000000000000', VITE_APP_ENV: 'test',
    }),
  },
});
const m = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };
const J = (x) => JSON.stringify(x);

const S = '2026-10-11T00:00:00.000Z', N = '2026-10-12T00:00:00.000Z';
ok('= je cijeli dan', J(m.dateFilterBounds('eq', '2026-10-11')) === J([{ op: 'gte', iso: S }, { op: 'lt', iso: N }]),
   J(m.dateFilterBounds('eq', '2026-10-11')));
ok('> = od sljedeceg dana', J(m.dateFilterBounds('gt', '2026-10-11')) === J([{ op: 'gte', iso: N }]));
ok('>= = od tog dana', J(m.dateFilterBounds('gte', '2026-10-11')) === J([{ op: 'gte', iso: S }]));
ok('< = prije tog dana', J(m.dateFilterBounds('lt', '2026-10-11')) === J([{ op: 'lt', iso: S }]));
ok('<= = do kraja tog dana', J(m.dateFilterBounds('lte', '2026-10-11')) === J([{ op: 'lt', iso: N }]));
ok('granice su UTC i u Zagrebu', m.dateFilterBounds('gte', '2026-07-01')[0].iso === '2026-07-01T00:00:00.000Z');
ok('kraj mjeseca prelazi u sljedeci', m.dateFilterBounds('lte', '2026-12-31')[0].iso === '2027-01-01T00:00:00.000Z');
ok('nepostojeci dan (31.02.) nije uvjet', m.dateFilterBounds('eq', '2026-02-31') === null);
ok('napola upisan datum nije uvjet', m.dateFilterBounds('eq', '2026-10') === null);

ok('da/ne: true', m.booleanFilterValue({ kind: 'boolean', value: 'true' }) === true);
ok('da/ne: false', m.booleanFilterValue({ kind: 'boolean', value: 'false' }) === false);
ok('da/ne: smece nije uvjet', m.booleanFilterValue({ kind: 'boolean', value: 'DA' }) === null);

const date = (value, op = 'gte') => ({ attrDefId: 'a1', value, isExact: false, op, kind: 'datetime' });
const bool = (value) => ({ attrDefId: 'a1', value, isExact: false, op: 'eq', kind: 'boolean' });
ok('aktivan: ispravan datum', m.isAttrFilterActive(date('2026-10-11')));
ok('NIJE aktivan: los datum (lista bez filtra, ne nagadjanje)', !m.isAttrFilterActive(date('2026-02-31')));
ok('aktivan: da/ne', m.isAttrFilterActive(bool('false')));
ok('NIJE aktivan: da/ne bez vrijednosti', !m.isAttrFilterActive(bool('x')));
ok('JOIN cita value_datetime', m.attrFilterJoinClause(date('2026-10-11')).includes('value_datetime'));
ok('JOIN cita value_boolean', m.attrFilterJoinClause(bool('true')).includes('value_boolean'));
ok('broj bez kind i dalje value_number (S159 nepromijenjen)',
   m.attrFilterJoinClause({ attrDefId: 'a1', value: '10', isExact: false, op: 'gt' }).includes('value_number'));
ok('tekst bez op i dalje value_text',
   m.attrFilterJoinClause({ attrDefId: 'a1', value: 'x', isExact: false }).includes('value_text'));

// WHERE: snimi pozive nad laznim upitom
const calls = [];
const q = new Proxy({}, { get: (_, k) => (...args) => { calls.push([k, ...args]); return q; } });
m.applyEventFilters(q, { attrFilter: date('2026-10-11', 'eq') });
ok('WHERE datum =: dvije granice nad value_datetime',
   J(calls.slice(1)) === J([['gte', 'event_attributes.value_datetime', S], ['lt', 'event_attributes.value_datetime', N]]), J(calls));
calls.length = 0;
m.applyEventFilters(q, { attrFilter: bool('false') });
ok('WHERE da/ne: eq false nad value_boolean', J(calls.slice(1)) === J([['eq', 'event_attributes.value_boolean', false]]), J(calls));

ok('opis datuma za traku', m.describeTypedFilter(date('2026-10-11')) === '≥ 11.10.2026.', m.describeTypedFilter(date('2026-10-11')));
ok('opis da/ne', m.describeTypedFilter(bool('true')) === '= Yes');
ok('vrsta po tipu atributa', m.kindForDataType('datetime') === 'datetime' && m.kindForDataType('boolean') === 'boolean'
   && m.kindForDataType('number') === 'number' && m.kindForDataType('text') === null);

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
