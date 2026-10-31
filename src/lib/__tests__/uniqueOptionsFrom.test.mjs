/**
 * uniqueOptionsFrom.test.mjs — pravila `unique` i `options_from` (S190, katalog vježbi)
 *
 * ZASTO POSTOJI
 *   Oba pravila žive UNUTAR `validation_rules`, koji panel i Structure uvoz grade iznova
 *   (`buildRules`). Pravilo koje graditelj ne nosi, prvo spremanje tiho obriše (razred
 *   `max`, S152; `hidden_in_add`, S139). Slug kataloga je trajni ključ treninga, pa duplikat
 *   ili izgubljeno pravilo ne smije proći bez poruke.
 *
 * STO CUVA
 *   - ćelije `Unique` / `OptionsFrom`: pisač i čitač su par; loša ćelija je greška;
 *   - `buildRules` nosi oba pravila, `sameRules` ih vidi kao razliku;
 *   - uvoz: bez kolone ⇒ baza; prazna ćelija ⇒ nema pravila; loša ćelija ⇒ baza + upozorenje;
 *   - prijedlog sluga iz imena; sličnost bez kvačica; vlastiti zapis nije sam sebi sličan.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'uniqueOptionsFrom.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export * from './src/lib/uniqueValue';",
      "export * from './src/lib/optionsFrom';",
      "export { buildRules, sameRules } from './src/lib/validationRules';",
      "export { resolveCellRule } from './src/lib/structureImport';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
  external: ['exceljs'],
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
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`); }
};
const J = JSON.stringify;

console.log('\n── Unique: ćelija ──');
{
  for (const u of [{ from: null }, { from: 'name' }]) {
    const back = m.parseUniqueCell(m.serializeUnique(u));
    ok(`roundtrip ${J(u)}`, back.ok && J(back.value) === J(u), J(back));
  }
  ok('prazno = nema', J(m.parseUniqueCell('')) === J({ ok: true, value: null }));
  ok('FALSE = nema', m.parseUniqueCell('false').ok && m.parseUniqueCell('false').value === null);
  ok('true (mala slova)', J(m.parseUniqueCell('true').value) === J({ from: null }));
  ok('"from name" bez dvotočke', J(m.parseUniqueCell('from name').value) === J({ from: 'name' }));
  ok('smeće je greška', m.parseUniqueCell('da').ok === false);
  ok('čitanje iz pravila: true', J(m.readUnique({ unique: true })) === J({ from: null }));
  ok('čitanje iz pravila: {from}', J(m.readUnique({ unique: { from: 'name' } })) === J({ from: 'name' }));
  ok('čitanje iz JSON stringa', J(m.readUnique('{"unique":true}')) === J({ from: null }));
  ok('bez pravila = null', m.readUnique({ type: 'suggest' }) === null);
}

console.log('\n── OptionsFrom: ćelija ──');
{
  const full = { area: 'Katalog vježbi', category: 'Vježba', attribute: 'slug', label: 'name', group: 'group', group2: 'secondary' };
  ok('pisač', m.serializeOptionsFrom(full) === 'Katalog vježbi > Vježba : slug | label: name | group: group | group2: secondary',
    m.serializeOptionsFrom(full));
  const back = m.parseOptionsFromCell(m.serializeOptionsFrom(full));
  ok('roundtrip puni', back.ok && J(back.value) === J(full), J(back));
  const min = m.parseOptionsFromCell('Katalog vježbi > Vježba : slug');
  ok('samo obavezni dio', min.ok && min.value.attribute === 'slug' && min.value.label === null, J(min));
  const nested = m.parseOptionsFromCell('A > B > C : x');
  ok('ugniježđena kategorija', nested.ok && nested.value.area === 'A' && nested.value.category === 'B > C', J(nested));
  ok('bez atributa je greška', m.parseOptionsFromCell('Katalog vježbi > Vježba').ok === false);
  ok('bez kategorije je greška', m.parseOptionsFromCell('Katalog : slug').ok === false);
  ok('nepoznat ključ je greška', m.parseOptionsFromCell('A > B : x | boja: crvena').ok === false);
  ok('raw roundtrip', J(m.readOptionsFrom({ options_from: m.optionsFromToRaw(full) })) === J(full));
}

console.log('\n── buildRules / sameRules nose pravila ──');
{
  const unique = { from: 'name' };
  const of = { area: 'K', category: 'V', attribute: 'slug', label: 'name', group: null, group2: null };
  const r = m.buildRules({ unique, optionsFrom: of });
  ok('unique u pravilu', J(r.unique) === J({ from: 'name' }), J(r));
  ok('options_from u pravilu', J(r.options_from) === J({ area: 'K', category: 'V', attribute: 'slug', label: 'name' }), J(r));
  const withOpts = m.buildRules({ options: ['a', 'b'], unique: { from: null } });
  ok('uz suggest', withOpts.type === 'suggest' && withOpts.unique === true, J(withOpts));
  ok('sameRules: pravilo bez unique ≠ s unique', !m.sameRules({}, { unique: true }));
  ok('sameRules: isto = isto', m.sameRules(r, JSON.parse(J(r))));
}

console.log('\n── Uvoz: kolona koje nema ne dira pravilo ──');
{
  const existing = { unique: { from: 'name' } };
  const noCol = m.resolveCellRule(false, '', existing, m.readUnique, m.parseUniqueCell, 'Unique');
  ok('bez kolone ⇒ baza', J(noCol.value) === J({ from: 'name' }) && !noCol.warning, J(noCol));
  const empty = m.resolveCellRule(true, '', existing, m.readUnique, m.parseUniqueCell, 'Unique');
  ok('prazna ćelija ⇒ nema pravila', empty.value === null, J(empty));
  const bad = m.resolveCellRule(true, 'možda', existing, m.readUnique, m.parseUniqueCell, 'Unique');
  ok('loša ćelija ⇒ baza + upozorenje', J(bad.value) === J({ from: 'name' }) && /Unique/.test(bad.warning ?? ''), J(bad));
}

console.log('\n── Prijedlog i sličnost ──');
{
  ok('prijedlog: prve dvije riječi', m.proposeKey('Hand lateral raises') === 'hand_lateral', m.proposeKey('Hand lateral raises'));
  ok('prijedlog: bez kvačica i zagrada', m.proposeKey('Čučanj (vlastita težina)') === 'cucanj', m.proposeKey('Čučanj (vlastita težina)'));
  ok('prijedlog: najviše 16 znakova', m.proposeKey('Povlačenje mašinom').length <= 16);
  ok('prijedlog: prazno', m.proposeKey('') === '');
  ok('ključ: velika slova i razmaci', m.uniqueKey(' Pull_M ') === 'pull_m');
  const recs = [
    { eventId: 'e1', key: 'lat_raises', texts: ['Lateralno podizanje ruku', 'Upper-push'] },
    { eventId: 'e2', key: 'pull_m', texts: ['Povlačenje na mašini (lat pulldown)'] },
    { eventId: 'e3', key: 'squat', texts: ['Čučanj (vlastita težina)'] },
  ];
  const sim = m.similarRecords(['Hand lateral raises'], 'hand_lateral', recs, null).map(r => r.key);
  ok('„Hand lateral raises" nađe lat_raises', sim.includes('lat_raises'), J(sim));
  ok('…i ne nađe squat', !sim.includes('squat'), J(sim));
  ok('bez kvačica: „cucanj" nađe squat', m.similarRecords(['cucanj'], '', recs, null).some(r => r.key === 'squat'));
  ok('vlastiti zapis nije sličan sam sebi', m.similarRecords(['Lateralno'], 'lat_raises', recs, 'e1').every(r => r.eventId !== 'e1'));
  ok('točan duplikat se ne nabraja kao sličan', m.similarRecords([], 'pull_m', recs, null).every(r => r.key !== 'pull_m'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
