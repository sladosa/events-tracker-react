/**
 * S159 — F4 filtar za brojeve (`Iznos > 1000`) + B3 kontekst Aree za Help.
 *
 * ZASTO OVAJ TEST POSTOJI
 *   F4 dijeli JEDAN `attrFilter` s tekstualnim filtrom, a taj filtar citaju
 *   lista, izvoz, brojac izvoza i shortcutovi -- svi kroz `applyEventFilters`.
 *   Tvrdnje ovdje mjere upit koji STVARNO ode (snimljeni lanac poziva), ne
 *   pomocne funkcije: krivi stupac (`value_text` umjesto `value_number`) bi
 *   dao praznu listu bez greske, i izgledao kao „nema takvih redaka".
 *
 * ⚠ Nepročitan broj NIJE filtar: lista tada ne smije filtrirati po nagadjanju
 *   (join i WHERE moraju se sloziti -- inace `!inner` join bez uvjeta).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'attrFilterNumeric.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export * from './src/lib/attrFilterNumeric';",
      "export { applyEventFilters, attrFilterJoinClause, isAttrFilterActive, ATTR_FILTER_ANY } from './src/lib/eventQueryBuilder';",
      "export { describeAreaForHelp } from './src/lib/helpContext';",
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
const m = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

/** Records every filter call made on it, in order. */
function recorder() {
  const calls = [];
  const q = new Proxy({}, {
    get: (_t, prop) => (...args) => { calls.push([prop, ...args]); return q; },
  });
  return { q, calls };
}
const run = (attrFilter) => {
  const { q, calls } = recorder();
  m.applyEventFilters(q, { attrFilter });
  return calls;
};
const J = (x) => JSON.stringify(x);

console.log('Operatori:');
ok('>= se cita kao gte, ne kao > + =', m.opFromAscii('>=') === 'gte');
ok('nepoznat operator => null', m.opFromAscii('=>') === null);
ok('svaki op ima ASCII oblik koji se vraca u isti op',
   m.NUMERIC_OPS.every(o => m.opFromAscii(m.opAscii(o.op)) === o.op));
ok('matchesNumeric gt/gte/lt/lte/eq',
   m.matchesNumeric(5, 'gt', 4) && !m.matchesNumeric(4, 'gt', 4) && m.matchesNumeric(4, 'gte', 4)
   && m.matchesNumeric(3, 'lt', 4) && m.matchesNumeric(4, 'lte', 4) && m.matchesNumeric(4, 'eq', 4));

console.log('');
console.log('Vrijednost:');
ok('hr zapis 1.234,56', m.numericFilterValue({ value: '1.234,56', op: 'gt' }) === 1234.56);
ok('tipkovnica 1234.56', m.numericFilterValue({ value: '1234.56', op: 'gt' }) === 1234.56);
ok('U+2212 minus', m.numericFilterValue({ value: '−50', op: 'lt' }) === -50);
ok('bez op => nije broj', m.numericFilterValue({ value: '1000' }) === null);
ok('smece => null', m.numericFilterValue({ value: '12a', op: 'gt' }) === null);

console.log('');
console.log('Je li filtar aktivan:');
const NUM = { attrDefId: 'def-iznos', value: '1000', isExact: false, op: 'gt' };
ok('broj s op => aktivan', m.isAttrFilterActive(NUM));
ok('neprocitan broj => NIJE aktivan', !m.isAttrFilterActive({ ...NUM, value: '12a' }));
ok('op na "In any attribute" => NIJE aktivan', !m.isAttrFilterActive({ ...NUM, attrDefId: m.ATTR_FILTER_ANY }));
ok('tekst bez op => aktivan kao i prije', m.isAttrFilterActive({ attrDefId: 'd', value: 'x', isExact: false }));

console.log('');
console.log('Upit koji stvarno ode:');
let c = run(NUM);
ok('gt na value_number s brojem 1000',
   J(c) === J([['eq', 'event_attributes.attribute_definition_id', 'def-iznos'],
               ['gt', 'event_attributes.value_number', 1000]]), J(c));
c = run({ ...NUM, op: 'lte', value: '1.234,56' });
ok('lte s hr zapisom => 1234.56', J(c.at(-1)) === J(['lte', 'event_attributes.value_number', 1234.56]), J(c));
c = run({ ...NUM, op: 'eq', value: '0' });
ok('= 0 je uvjet, ne prazno (nula je odgovor)', J(c.at(-1)) === J(['eq', 'event_attributes.value_number', 0]), J(c));
c = run({ ...NUM, value: '12a' });
ok('neprocitan broj => nikakav uvjet', c.length === 0, J(c));
c = run({ attrDefId: 'd', value: 'ZABA', isExact: true });
ok('tekst exact i dalje na value_text', J(c.at(-1)) === J(['eq', 'event_attributes.value_text', 'ZABA']), J(c));
ok('join za broj nosi value_number', m.attrFilterJoinClause(NUM).includes('value_number'));
ok('join za neprocitan broj je prazan', m.attrFilterJoinClause({ ...NUM, value: 'x' }) === '');
ok('join za tekst nosi value_text', m.attrFilterJoinClause({ attrDefId: 'd', value: 'x', isExact: false }).includes('value_text'));

console.log('');
console.log('B3 — Help zna Areu:');
const area = (settings) => ({ id: 'a', name: 'Fitness', settings });
let h = m.describeAreaForHelp(null, null);
ok('bez Aree => bez imena i bez cinjenica', h.areaName === null && h.areaFacts.length === 0);
h = m.describeAreaForHelp(area(null), null);
ok('Area bez configa => ime + „NO Overview tab"',
   h.areaName === 'Fitness' && h.areaFacts.some(f => f.includes('NO Overview')), J(h));
h = m.describeAreaForHelp(area({ dashboard: { widgets: [{}] }, automations: { attribute_rules: [{}, {}] } }), null);
ok('dashboard => ima Overview, nema „NO"',
   h.areaFacts.some(f => f.startsWith('has an Overview tab')) && !h.areaFacts.some(f => f.includes('NO Overview')), J(h));
ok('broji automation pravila', h.areaFacts.some(f => f.includes('2 set_attribute')), J(h));
h = m.describeAreaForHelp(area(null), { ownerDisplayName: 'Koka', permission: 'write', ownerId: 'x', ownerEmail: 'k@x' });
ok('dijeljena write Area => kaze da struktura nije njegova',
   h.areaFacts.some(f => f.includes('Koka') && f.includes('may not change structure')), J(h));

console.log('');
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
