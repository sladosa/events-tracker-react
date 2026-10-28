/**
 * visibleWhen.test.mjs — „polje vidljivo samo uz vrijednost X atributa Y" (S187, korak 2)
 *
 * ZASTO POSTOJI
 *   Model treninga (`TRENING_MIGRACIJA.md` „Dogovor 28.10."): leaf `Gym`, `vrsta`
 *   odlučuje koja su polja na ekranu. Pravilo zovu forma, provjera obaveznih,
 *   spremanje u Addu, Structure uvoz/izvoz, panel, planer preuređivanja i A1 —
 *   svaka kopija uvjeta je prilika da se raziđu.
 *
 * STO CUVA
 *   - ćelija `slug = a | b`: pisač i čitač su par; `:-|` preživi (zamka S186);
 *   - Y na istom eventu ili pretku, NIKAD na djetetu; najbliži pobjeđuje; Y kojeg
 *     nema ⇒ polje se PRIKAZUJE; usporedba bez velikih/malih slova, boolean TRUE/FALSE;
 *   - promjena Y isprazni ono što skrije, kaskadno; prazno ne prijavljuje;
 *   - `buildRules`/`sameRules`/rename sluga nose pravilo;
 *   - uvoz: bez kolone ⇒ baza; prazna ćelija ⇒ nema pravila; loša ćelija ili Y kojeg
 *     nema ⇒ baza + upozorenje; različiti retci ⇒ prvi + upozorenje; ime ⇒ slug;
 *   - planer: čisto preimenovanje opcije Y prepiše vrijednosti pravila;
 *   - A1: atribut Y s pravilom drugoga se ne da pretvoriti; pretvorba ne briše pravilo.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'visibleWhen.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: [
      "export * from './src/lib/visibleWhen';",
      "export { buildRules, sameRules, renameVisibleWhenSlug } from './src/lib/validationRules';",
      "export { resolveVisibleWhen, groupAttributes, buildValidationRules } from './src/lib/structureImport';",
      "export { planRestructure } from './src/lib/restructure/plan';",
      "export { planRetype } from './src/lib/restructure/retype';",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
  // structureImport vuče exceljs i supabase klijent; za ove čiste funkcije ne trebaju
  // (isti obrazac kao `structureHiddenInAdd.test.mjs`).
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

console.log('\n── Ćelija Excela ──');
{
  const vw = { attributeSlug: 'vrsta', values: ['Cardio', 'Outdoor'] };
  ok('pisač', m.serializeVisibleWhen(vw) === 'vrsta = Cardio | Outdoor');
  const back = m.parseVisibleWhenCell(m.serializeVisibleWhen(vw));
  ok('roundtrip', back.ok && J(back.value) === J(vw), J(back));
  const mood = { attributeSlug: 'mood', values: [':-|', ':-)'] };
  const mb = m.parseVisibleWhenCell(m.serializeVisibleWhen(mood));
  ok('`:-|` preživi (dijeli se samo na " | ")', mb.ok && J(mb.value) === J(mood), J(mb));
  ok('prazno = nema pravila', J(m.parseVisibleWhenCell('')) === J({ ok: true, value: null }));
  ok('`_` = nema pravila', J(m.parseVisibleWhenCell('_')) === J({ ok: true, value: null }));
  ok('bez "=" je greška', m.parseVisibleWhenCell('vrsta Snaga').ok === false);
  ok('bez vrijednosti je greška', m.parseVisibleWhenCell('vrsta = ').ok === false);
  ok('jedna vrijednost', J(m.parseVisibleWhenCell(' vrsta =Snaga ').value) === J({ attributeSlug: 'vrsta', values: ['Snaga'] }));
}

console.log('\n── Čitanje pravila iz baze ──');
{
  ok('ispravno', J(m.readVisibleWhen({ visible_when: { attribute_slug: 'vrsta', values: ['Snaga'] } }))
    === J({ attributeSlug: 'vrsta', values: ['Snaga'] }));
  ok('iz JSON stringa', m.readVisibleWhen('{"visible_when":{"attribute_slug":"v","values":["a"]}}') !== null);
  ok('prazne vrijednosti = nema', m.readVisibleWhen({ visible_when: { attribute_slug: 'v', values: [] } }) === null);
  ok('bez sluga = nema', m.readVisibleWhen({ visible_when: { values: ['a'] } }) === null);
  ok('bez ključa = nema', m.readVisibleWhen({ type: 'suggest' }) === null);
}

// Lanac: Activity1 (korijen) → Gym (leaf). `rutina` na roditelju, `vrsta` na leafu.
const def = (id, slug, rules = {}) => ({ id, slug, validation_rules: rules });
const vwr = (slug, ...values) => ({ visible_when: { attribute_slug: slug, values } });
const ACT = [def('rutina', 'rutina'), def('mjesto', 'mjesto'), def('trajanje_p', 'trajanje')];
const GYM = [
  def('vrsta', 'vrsta'),
  def('serije', 'serije', vwr('vrsta', 'Snaga')),
  def('sprava', 'sprava', vwr('vrsta', 'Z2', 'HIIT')),
  def('kg', 'kg', vwr('serije_flag', 'TRUE')),
  def('serije_flag', 'serije_flag', vwr('vrsta', 'Snaga')),
  def('core_vj', 'core_vj', vwr('rutina', 'Core')),          // Y na RODITELJU
  def('trajanje', 'trajanje'),                                // isti slug kao na roditelju
  def('bilj', 'bilj', vwr('trajanje', '60')),                 // ⇒ najbliži = leaf
  def('nema_y', 'nema_y', vwr('ne_postoji', 'x')),
];
const chain = [{ categoryId: 'gym', defs: GYM }, { categoryId: 'act', defs: ACT }];
const vals = obj => id => obj[id];

console.log('\n── Procjena ──');
{
  const g = id => GYM.find(d => d.id === id);
  ok('Y na istoj razini', m.controllingDef(g('serije'), chain)?.id === 'vrsta');
  ok('Y na pretku', m.controllingDef(g('core_vj'), chain)?.id === 'rutina');
  ok('najbliži pobjeđuje (isti slug na leafu i roditelju)', m.controllingDef(g('bilj'), chain)?.id === 'trajanje');
  const childRule = def('na_roditelju', 'na_roditelju', vwr('vrsta', 'Snaga'));
  const chain2 = [{ categoryId: 'gym', defs: GYM }, { categoryId: 'act', defs: [...ACT, childRule] }];
  ok('NIKAD dijete: roditeljevo polje ne vidi leaf `vrsta`', m.controllingDef(childRule, chain2) === null);
  ok('… i zato je prikazano', m.isHiddenByRule(childRule, chain2, vals({ vrsta: 'Cardio' })) === false);
  ok('Y kojeg nema ⇒ prikazano', m.isHiddenByRule(g('nema_y'), chain, vals({})) === false);
  ok('Y prazan ⇒ skriveno', m.isHiddenByRule(g('serije'), chain, vals({})) === true);
  ok('Y druga vrijednost ⇒ skriveno', m.isHiddenByRule(g('serije'), chain, vals({ vrsta: 'Cardio' })) === true);
  ok('velika/mala slova', m.isHiddenByRule(g('serije'), chain, vals({ vrsta: 'snaga' })) === false);
  ok('popis: druga vrijednost', m.isHiddenByRule(g('sprava'), chain, vals({ vrsta: 'HIIT' })) === false);
  ok('boolean true = TRUE', m.isHiddenByRule(g('kg'), chain, vals({ serije_flag: true })) === false);
  ok('boolean false ≠ TRUE', m.isHiddenByRule(g('kg'), chain, vals({ serije_flag: false })) === true);
  ok('broj 60 = "60"', m.isHiddenByRule(g('bilj'), chain, vals({ trajanje: 60 })) === false);
  ok('bez pravila nikad skriveno', m.isHiddenByRule(g('vrsta'), chain, vals({})) === false);
  const hid = m.ruleHiddenIds(chain, vals({ vrsta: 'Snaga', rutina: 'Upper', trajanje: 60 }));
  ok('ruleHiddenIds uz Snaga/Upper', J([...hid].sort()) === J(['core_vj', 'kg', 'sprava']), J([...hid]));
}

console.log('\n── Promjena Y prazni ono što skrije ──');
{
  const state = { vrsta: 'Snaga', serije: '55x12', serije_flag: true, kg: 55, sprava: null };
  const cleared = m.fieldsToClear('vrsta', 'Z2', chain, vals(state));
  ok('Snaga → Z2: serije, zastavica i (kaskadno) kg', J(cleared.sort()) === J(['kg', 'serije', 'serije_flag']), J(cleared));
  ok('prazno polje se ne prijavljuje (sprava je prazna i postaje vidljiva)', !cleared.includes('sprava'));
  ok('Snaga → snaga: ništa', m.fieldsToClear('vrsta', 'snaga', chain, vals(state)).length === 0);
  ok('promjena atributa o kojem nitko ne ovisi: ništa', m.fieldsToClear('mjesto', 'x', chain, vals(state)).length === 0);
  // E2E S187 nalaz: `sprava` s defaultom, skrivena dok vrsta nije izabrana — Snaga je
  // NE smije obrisati, inače Z2 poslije pokaže prazno polje umjesto defaulta.
  const fresh = { vrsta: null, sprava: 'orb' };
  ok('skriveno od prije (default) se NE prazni', !m.fieldsToClear('vrsta', 'Snaga', chain, vals(fresh)).includes('sprava'));
  ok('wasShown: Edit iznimka (vidljivo izvan pravila) se prazni',
    m.fieldsToClear('vrsta', 'HIIT', chain, vals({ vrsta: 'Z2', serije: '99x1' }), d => d.id === 'serije').includes('serije'));
}

console.log('\n── Pravila (validationRules.ts) ──');
{
  const vw = { attributeSlug: 'vrsta', values: ['Snaga'] };
  const r = m.buildRules({ options: ['a'], hiddenInAdd: true, visibleWhen: vw });
  ok('buildRules piše visible_when', J(r.visible_when) === J({ attribute_slug: 'vrsta', values: ['Snaga'] }), J(r));
  ok('bez pravila nema ključa', !('visible_when' in m.buildRules({ options: ['a'] })));
  ok('sameRules: prazan popis = bez pravila', m.sameRules({ visible_when: { attribute_slug: 'v', values: [] } }, {}));
  ok('sameRules: izgubljeno pravilo JEST promjena', !m.sameRules(r, m.buildRules({ options: ['a'], hiddenInAdd: true })));
  const rn = m.renameVisibleWhenSlug(r, 'vrsta', 'vrsta_dijela');
  ok('rename sluga Y', rn?.visible_when.attribute_slug === 'vrsta_dijela' && J(rn.suggest) === J(['a']) && rn.hidden_in_add === true);
  ok('rename drugog sluga: null', m.renameVisibleWhenSlug(r, 'nesto', 'x') === null);
}

console.log('\n── Structure uvoz ──');
{
  const group = { visibleWhen: '', visibleWhenConflict: false, attrName: 'serije', categoryPath: 'Fitness > Activity1 > Gym' };
  const existing = { type: 'suggest', suggest: ['a'], visible_when: { attribute_slug: 'vrsta', values: ['Snaga'] } };
  const ctrl = w => (w.toLowerCase() === 'vrsta' || w === 'Vrsta dijela' ? 'vrsta' : null);
  ok('nema kolone ⇒ pravilo iz baze', J(m.resolveVisibleWhen(false, group, existing, ctrl).value) === J({ attributeSlug: 'vrsta', values: ['Snaga'] }));
  ok('prazna ćelija ⇒ nema pravila', m.resolveVisibleWhen(true, group, existing, ctrl).value === null);
  const bad = m.resolveVisibleWhen(true, { ...group, visibleWhen: 'vrsta Snaga' }, existing, ctrl);
  ok('loša ćelija ⇒ baza + upozorenje', bad.value?.values[0] === 'Snaga' && /left as it was/.test(bad.warning ?? ''), J(bad));
  const noY = m.resolveVisibleWhen(true, { ...group, visibleWhen: 'tip = x' }, null, ctrl);
  ok('Y kojeg nema ⇒ ništa + upozorenje', noY.value === null && /no attribute "tip"/.test(noY.warning ?? ''), J(noY));
  const byName = m.resolveVisibleWhen(true, { ...group, visibleWhen: 'Vrsta dijela = Snaga | Istezanje' }, null, ctrl);
  ok('ime atributa ⇒ slug', J(byName.value) === J({ attributeSlug: 'vrsta', values: ['Snaga', 'Istezanje'] }), J(byName));
  const conf = m.resolveVisibleWhen(true, { ...group, visibleWhen: 'vrsta = Snaga', visibleWhenConflict: true }, null, ctrl);
  ok('različiti retci ⇒ prvi + upozorenje', conf.value?.values[0] === 'Snaga' && /differ/.test(conf.warning ?? ''));

  const row = (when, vw) => ({ rowNum: 1, type: 'Attribute', categoryPath: 'A > Gym', sort: 1, attrName: 'serije',
    slug: 'serije', attrType: 'text', isRequired: false, hiddenInAdd: false, visibleWhen: vw, valType: 'suggest',
    defaultVal: '', valMax: '', unit: '', textOptions: 'x', dependsOn: 'p', whenValue: when, description: '',
    commentTpl: '', disableSavePlus: '', addTimer: '', addDate: '', defaultPeriod: '' });
  const [g1] = m.groupAttributes([row('*', ''), row('a', 'vrsta = Snaga'), row('b', 'vrsta = Snaga')]);
  ok('prva NEPRAZNA ćelija (prazan prvi redak ne briše)', g1.visibleWhen === 'vrsta = Snaga' && !g1.visibleWhenConflict);
  const [g2] = m.groupAttributes([row('a', 'vrsta = Snaga'), row('b', 'vrsta = Cardio')]);
  ok('različite ćelije ⇒ sukob', g2.visibleWhenConflict === true);
  const rules = m.buildValidationRules(g1, false, { attributeSlug: 'vrsta', values: ['Snaga'] });
  ok('buildValidationRules nosi pravilo uz depends_on', !!rules.depends_on && rules.visible_when?.attribute_slug === 'vrsta');
}

console.log('\n── Planer preuređivanja ──');
{
  const snap = () => ({
    areaId: 'a', settings: {},
    categories: [{ id: 'act', name: 'Activity1', parent_category_id: null }, { id: 'gym', name: 'Gym', parent_category_id: 'act' }],
    attributes: [
      { id: 'vrsta', category_id: 'gym', slug: 'vrsta', name: 'vrsta', data_type: 'text', default_value: null,
        validation_rules: { type: 'suggest', suggest: ['Snaga', 'Z2'] } },
      { id: 'serije', category_id: 'gym', slug: 'serije', name: 'serije', data_type: 'text', default_value: null,
        validation_rules: { visible_when: { attribute_slug: 'vrsta', values: ['Snaga', 'Z2'] } } },
    ],
    events: [
      { id: 'e1', category_id: 'gym', values: { vrsta: 'Snaga', serije: '55x12' } },
      { id: 'e2', category_id: 'gym', values: { vrsta: 'Snaga' } },
      { id: 'e3', category_id: 'gym', values: { vrsta: 'Z2' } },
    ],
    presets: [], anchors: [],
  });
  const p = m.planRestructure([{ n: 1, category: 'Gym', when: { vrsta: 'Snaga' }, set: { vrsta: 'Strength' } }], snap());
  const after = p.config.find(c => c.kind === 'attribute_rules' && c.target_id === 'serije')?.after;
  ok('čisto preimenovanje Snaga → Strength prepiše pravilo', J(after?.visible_when) === J({ attribute_slug: 'vrsta', values: ['Strength', 'Z2'] }), J(after));
  const split = m.planRestructure([{ n: 1, category: 'Gym', when: { vrsta: 'Snaga' }, set: { vrsta: 'Strength' }, eventIds: ['e1'] }], snap());
  const after2 = split.config.find(c => c.kind === 'attribute_rules' && c.target_id === 'serije')?.after;
  ok('raspad (dio Snaga ostaje) ne pogađa', !after2 || J(after2.visible_when.values) === J(['Snaga', 'Z2']), J(after2));
}

console.log('\n── A1 (pretvorba tipa) ──');
{
  const snap = (rules) => ({
    areaId: 'a', settings: {},
    categories: [{ id: 'gym', name: 'Gym' }],
    attributes: [
      { id: 'vrsta', category_id: 'gym', slug: 'vrsta', name: 'vrsta', data_type: 'text', default_value: null, validation_rules: {} },
      { id: 'serije', category_id: 'gym', slug: 'serije', name: 'serije', data_type: 'text', default_value: null, validation_rules: rules },
    ],
    values: [], presets: [], anchors: [],
  });
  const block = m.planRetype({ category: 'Gym', slug: 'vrsta', to: 'number', conv: { kind: 'broj' } },
    snap({ visible_when: { attribute_slug: 'vrsta', values: ['1'] } }));
  ok('Y s pravilom drugoga se ne pretvara', block.errors.some(e => /VisibleWhen/.test(e)), J(block.errors));
  const keep = m.planRetype({ category: 'Gym', slug: 'serije', to: 'number', conv: { kind: 'broj' } },
    snap({ type: 'suggest', suggest: ['1'], visible_when: { attribute_slug: 'vrsta', values: ['Snaga'] } }));
  const ar = keep.config.find(c => c.kind === 'attribute_rules');
  ok('pretvorba ne briše pravilo vidljivosti', keep.errors.length === 0 && ar?.after.visible_when?.attribute_slug === 'vrsta', J(keep.errors) + ' ' + J(ar));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
