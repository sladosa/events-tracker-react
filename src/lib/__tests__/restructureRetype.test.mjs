/**
 * S185 / F2 A1 — promjena tipa atributa (`src/lib/restructure/retype.ts`, PREUREDJIVANJE_SPEC §24).
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Pretvorba živi na dva mjesta (planer za pregled, `_restructure_convert` u `060` za
 *   izvođenje). Ako se raziđu, pregled obeća jedan broj a baza upiše drugi — ili baza
 *   odbije operaciju koju je pregled pustio. `CONVERT_EXAMPLES` je zajednički popis:
 *   ovdje ga provjerava TS, na TEST-u ga provjerava SQL proba (S185: 15/15 isto).
 *   Planer uz to mora BLOKIRATI sve što ne zna prevesti — tekst u brojčanom atributu
 *   app ne prikazuje (gubitak bez poruke, §24.1).
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'restructureRetype.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/restructure/retype';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { convertValue, CONVERT_EXAMPLES, planRetype } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n── Zajednički primjeri pretvorbe (isti popis prolazi i SQL proba) ──');
for (const [t, c, want] of CONVERT_EXAMPLES) {
  ok(`${c.kind} ${JSON.stringify(t)} → ${want}`, convertValue(t, c) === want);
}

const MOOD = { ':-(': 1, ':-/': 2, ':-|': 3, ':-)': 4, ':-D': 5 };
const CAT = 'cat-act', CAT2 = 'cat-out';
function snap(extra = {}) {
  return {
    areaId: 'area-1',
    settings: {},
    categories: [{ id: CAT, name: 'Activity' }, { id: CAT2, name: 'Outdoor' }],
    attributes: [
      { id: 'a-mood', category_id: CAT, slug: 'mood', name: 'mood', data_type: 'text', default_value: null,
        validation_rules: { type: 'suggest', suggest: [':-(', ':-/', ':-)', ':-D'], hidden_in_add: true } },
      { id: 'a-pace', category_id: CAT2, slug: 'pace', name: 'pace', data_type: 'text', default_value: null, validation_rules: {} },
      { id: 'a-hr', category_id: CAT, slug: 'hr-avg', name: 'hr_avg', data_type: 'number', default_value: null, validation_rules: {} },
    ],
    values: [],
    presets: [],
    anchors: [],
    ...extra,
  };
}
const v = (id, text, num = null, d = '2024-01-01') => ({ id, event_id: `e-${id}`, event_date: d, value_text: text, value_number: num });

console.log('\n── pace: tekst MM:SS → broj ──');
{
  const s = snap({ values: [v('1', '6:06'), v('2', '10:00'), v('3', null)] });
  const p = planRetype({ category: 'Outdoor', slug: 'pace', to: 'number', conv: { kind: 'mm:ss' } }, s);
  ok('nema grešaka', p.errors.length === 0);
  ok('2 retka (prazan se ne broji)', p.rows === 2 && p.rpc.p_expected === 2);
  ok('predviđanje', p.predicted['1'] === 6.1 && p.predicted['2'] === 10);
  ok('definicija text → number', eq(p.config[0], { kind: 'attribute_definition', target_id: 'a-pace',
    before: { data_type: 'text', default_value: null }, after: { data_type: 'number', default_value: null } }));
  ok('prazna pravila se ne pišu', !p.config.some(c => c.kind === 'attribute_rules'));
}

console.log('\n── Nepretvorivo blokira ──');
{
  const s = snap({ values: [v('1', '6:06', null, '2024-02-01'), v('2', '6.06', null, '2024-01-15'), v('3', '--')] });
  const p = planRetype({ category: 'Outdoor', slug: 'pace', to: 'number', conv: { kind: 'mm:ss' } }, s);
  ok('greška s brojem i najranijim primjerom', p.errors.some(e => e.includes('2 redaka') && e.includes('2024-01-01')));
  ok('popis nepretvorivih', p.unconvertible.count === 2);
  ok('nema rpc paketa', p.rpc === null);
}

console.log('\n── mood: smajlić → broj (mapa), izbornik, kolona liste, shortcut ──');
{
  const settings = { list_columns: { columns: [{ role: 'date' },
    { role: 'attr', slugs: ['mood'], label: 'Mood', map: { ':-)': 'dobro', ':-(': 'loše', ':)': 'x' } }] } };
  const presets = [
    { id: 'p1', name: 'Trening', area_id: 'area-1', category_id: CAT, default_attributes: { 'a-mood': ':-)', 'a-hr': 120 }, filter_state: null },
    { id: 'p2', name: 'Filtar', area_id: 'area-1', category_id: CAT, default_attributes: null,
      filter_state: { attrFilter: { attrDefId: 'a-mood', value: ':-)', isExact: true } } },
  ];
  const s = snap({ settings, presets, values: [v('1', ':-)'), v('2', ':-|'), v('3', ':-D')] });
  const before = JSON.stringify(s);
  const p = planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, s);
  ok('nema grešaka', p.errors.length === 0);
  ok(':-| (nije u izborniku) se svejedno pretvara', p.predicted['2'] === 3);
  const r = p.config.find(c => c.kind === 'attribute_rules');
  ok('izbornik pada, hidden_in_add ostaje', r && eq(r.after, { hidden_in_add: true }));
  const lc = p.config.find(c => c.kind === 'area_settings').after.list_columns.columns[1].map;
  ok('mapa kolone: ključevi u brojeve', lc['4'] === 'dobro' && lc['1'] === 'loše' && !(':-)' in lc));
  ok('nepretvoriv ključ mape ostaje + upozorenje', lc[':)'] === 'x' && p.warnings.some(w => w.includes('„:)"')));
  const p1 = p.config.find(c => c.kind === 'preset' && c.target_id === 'p1');
  ok('shortcut: :-) → 4, ostali atributi netaknuti', p1 && p1.after.default_attributes['a-mood'] === 4 && p1.after.default_attributes['a-hr'] === 120);
  ok('filtar po mood: upozorenje, bez pisanja', p.warnings.some(w => w.includes('Filtar')) && !p.config.some(c => c.target_id === 'p2'));
  ok('snimka netaknuta', JSON.stringify(s) === before);
}

console.log('\n── Shortcut s nepretvorivom vrijednošću blokira ──');
{
  const presets = [{ id: 'p1', name: 'Loš', area_id: 'area-1', category_id: CAT, default_attributes: { 'a-mood': ':(' }, filter_state: null }];
  const p = planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, snap({ presets }));
  ok('greška imenuje shortcut', p.errors.some(e => e.includes('Loš')) && p.rpc === null);
}

console.log('\n── Uloge koje A1 ne zna prevesti ⇒ blokada ──');
{
  const dep = snap();
  dep.attributes.push({ id: 'a-x', category_id: CAT, slug: 'x', name: 'x', data_type: 'text', default_value: null,
    validation_rules: { type: 'suggest', depends_on: { attribute_slug: 'mood', options_map: { '*': ['a'] } } } });
  ok('roditelj depends_on', planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, dep)
    .errors.some(e => e.includes('ovisi o mood')));
  const own = snap();
  own.attributes[0].validation_rules = { type: 'suggest', depends_on: { attribute_slug: 'tip', options_map: {} } };
  ok('dijete depends_on', planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, own)
    .errors.some(e => e.includes('ima depends_on')));
  const dash = snap({ settings: { dashboard: { widgets: [{ type: 'balance_by_group', group_by: 'mood' }] } } });
  ok('pločica', planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, dash)
    .errors.some(e => e.includes('dashboard')));
  const anc = snap({ anchors: [{ id: 'b1', group_slug: 'mood', group_value: ':-)' }] });
  ok('sidro', planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, anc)
    .errors.some(e => e.includes('sidra')));
  ok('text → number bez pretvorbe', planRetype({ category: 'Outdoor', slug: 'pace', to: 'number' }, snap())
    .errors.some(e => e.includes('traži pretvorbu')));
  ok('isti tip', planRetype({ category: 'Activity', slug: 'hr-avg', to: 'number', conv: { kind: 'broj' } }, snap())
    .errors.some(e => e.includes('već number')));
  ok('kriva kategorija', planRetype({ category: 'Activity', slug: 'pace', to: 'number', conv: { kind: 'mm:ss' } }, snap())
    .errors.some(e => e.includes('nije na kategoriji')));
}

console.log('\n── number → text i zadana vrijednost ──');
{
  const s = snap({ values: [v('1', null, 6.1), v('2', null, 120)] });
  s.attributes[2].default_value = '120';
  const p = planRetype({ category: 'Activity', slug: 'hr-avg', to: 'text' }, s);
  ok('6.1 → „6.1", 120 → „120"', p.predicted['1'] === '6.1' && p.predicted['2'] === '120');
  ok('zadana ostaje „120"', p.config[0].after.default_value === '120');
  const t = snap();
  t.attributes[0].default_value = ':-)';
  const q = planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, t);
  ok('zadana :-) → „4"', q.config[0].after.default_value === '4');
  t.attributes[0].default_value = 'super';
  ok('nepretvoriva zadana blokira', planRetype({ category: 'Activity', slug: 'mood', to: 'number', conv: { kind: 'mapa', map: MOOD } }, t)
    .errors.some(e => e.includes('zadana')));
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) { console.log('❌ restructureRetype'); process.exit(1); }
