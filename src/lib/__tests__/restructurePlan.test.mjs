/**
 * S178 / F1 — planer preuređivanja (`src/lib/restructure/plan.ts`, PREUREDJIVANJE_SPEC §12).
 *
 * ZASTO OVAJ TEST POSTOJI
 *   Planer je JEDINO mjesto koje zna gdje u configu stoji vrijednost opcije.
 *   Promaši li jedno mjesto, preimenovanje „uspije" a bucket / košara / sidro
 *   pokazuju u prazno — bez greške (S167, S138: „promijenili smo pravilo" je
 *   tvrdnja o jednom mjestu). Baza (058) provjerava samo brojeve, ne oblik.
 *
 * FIXTURE
 *   `areaSettings_prod_2026-10-18.json` (S175) — dashboard, groupings, export_profiles
 *   `restructure_prod_2026-10-18.json` (S178) — cijeli `areas.settings` (+ automations,
 *   list_columns), validation_rules, shortcuti, sidra i BROJEVI KOMBINACIJA tekstualnih
 *   atributa (bez iznosa, opisa i datuma). Eventi se iz njih sintetiziraju.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'node_modules', '.cache', 'restructurePlan.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: { contents: "export * from './src/lib/restructure/plan';", resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { planRestructure } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FX = join(process.cwd(), 'src', 'lib', '__tests__', 'fixtures');
const old = JSON.parse(readFileSync(join(FX, 'areaSettings_prod_2026-10-18.json'), 'utf-8')).Financije_all;
const fx = JSON.parse(readFileSync(join(FX, 'restructure_prod_2026-10-18.json'), 'utf-8'));

// Stari fixture je izvor za dashboard/groupings/export_profiles; novi dodaje ostalo.
const SETTINGS = { ...fx.settings, ...old };
ok('fixture: stari i novi config se slažu (ista snimka)',
  eq(fx.settings.dashboard, old.dashboard) && eq(fx.settings.groupings, old.groupings));

const CAT = fx.categories[0].id;
let idSeq = 0;
function makeEvents() {
  idSeq = 0;
  const evs = [];
  for (const [vals, n] of fx.combos) {
    const values = {};
    fx.combo_slugs.forEach((s, i) => { if (vals[i] != null) values[s] = vals[i]; });
    for (let i = 0; i < n; i++) evs.push({ id: `e${++idSeq}`, category_id: CAT, values: { ...values } });
  }
  return evs;
}
function snap(extra = {}) {
  return {
    areaId: fx.area_id,
    settings: JSON.parse(JSON.stringify(SETTINGS)),
    categories: fx.categories,
    attributes: JSON.parse(JSON.stringify(fx.attributes)),
    events: makeEvents(),
    presets: JSON.parse(JSON.stringify(fx.presets)),
    anchors: fx.anchors,
    ...extra,
  };
}
const step = (n, when, set, eventIds) => ({ n, category: 'Transakcija', when, set, ...(eventIds ? { eventIds } : {}) });
const count = (s, pred) => s.events.filter(e => pred(e.values)).length;
const cfg = (plan, kind, id) => plan.config.find(c => c.kind === kind && (!id || c.target_id === id));
const attrId = slug => fx.attributes.find(a => a.slug === slug).id;
const rulesAfter = (plan, slug) => cfg(plan, 'attribute_rules', attrId(slug))?.after;
// bez promjene postavki nema zapisa ⇒ vrijedi snimka
const settingsAfter = p => cfg(p, 'area_settings')?.after ?? SETTINGS;
const groupRows = p => settingsAfter(p).groupings['Vrsta troška'].rows;
const balanceW = p => cfg(p, 'area_settings').after.dashboard.widgets[0];
const breakdownW = p => cfg(p, 'area_settings').after.dashboard.widgets[1];

console.log('\n── O1: preimenuj Tip (Transfer → Prijenos) ──');
{
  const s = snap();
  const n = count(s, v => v.tip === 'Transfer');
  const p = planRestructure([step(1, { tip: 'Transfer' }, { tip: 'Prijenos' })], s);
  ok('nema grešaka', p.errors.length === 0);
  ok(`pogođeno = promijenjeno = ${n}`, p.steps[0].matched === n && p.steps[0].changed === n && n > 0);
  const tip = rulesAfter(p, 'tip');
  const iOld = fx.attributes.find(a => a.slug === 'tip').validation_rules.suggest.indexOf('Transfer');
  ok('Tip izbornik: Prijenos na mjestu Transfera', tip.suggest[iOld] === 'Prijenos' && !tip.suggest.includes('Transfer'));
  const om = rulesAfter(p, 'podtip').depends_on.options_map;
  const keys = Object.keys(om), oldKeys = Object.keys(fx.attributes.find(a => a.slug === 'podtip').validation_rules.depends_on.options_map);
  ok('Podtip options_map: ključ preimenovan NA ISTOM MJESTU', keys.indexOf('Prijenos') === oldKeys.indexOf('Transfer') && !('Transfer' in om));
  ok('Podtip lista pod ključem netaknuta', eq(om.Prijenos, ['cash - bankomat', 'izmedju racuna', 'Anja', 'Natasa', 'Nena']));
  const bw = breakdownW(p);
  ok('razrez outside: Prijenos', eq(bw.outside[0].values, ['Prijenos', 'Investicije']));
  ok('razrez korekcija add + subtract', bw.adjustments[0].add[0].values[0] === 'Prijenos' && bw.adjustments[0].subtract[1].values[0] === 'Prijenos');
  ok('due.settle.tip prati', balanceW(p).due.settle.tip === 'Prijenos');
  ok('ništa ne upisuje u sidra', !cfg(p, 'anchor'));
  ok('rpc paket postoji, ID-evi umjesto slugova',
    p.rpc && p.rpc.p_steps[0].when[0].attr === attrId('tip') && p.rpc.p_steps[0].category_id === CAT
    && p.rpc.p_steps[0].expected_matched === n && p.rpc.p_steps[0].event_ids === null);
}

console.log('\n── O1: preimenuj Tip Prihodi (income filter) ──');
{
  const p = planRestructure([step(1, { tip: 'Prihodi' }, { tip: 'Primici' })], snap());
  ok('income filtar prati', eq(breakdownW(p).income.values, ['Primici']));
}

console.log('\n── O1: preimenuj Podtip (Projekti / Sasa → Saša) ──');
{
  const s = snap();
  const n = count(s, v => v.tip === 'Projekti' && v.podtip === 'Sasa');
  const p = planRestructure([step(1, { tip: 'Projekti', podtip: 'Sasa' }, { podtip: 'Saša' })], s);
  const om = rulesAfter(p, 'podtip').depends_on.options_map;
  ok(`promijenjeno ${n}`, p.steps[0].changed === n && n > 0);
  ok('Projekti: „Saša" na mjestu „Sasa"', eq(om.Projekti, ['Saša', 'Koka']));
  ok('Prihodi lista netaknuta (ima svoj „Saša")', eq(om.Prihodi, ['Saša', 'Koka', 'Povrat Anja']));
  const ai = cfg(p, 'preset', fx.presets.find(x => x.name === 'AI_rucak').id);
  ok('shortcut AI_rucak: podtip Sasa → Saša', ai && ai.after.default_attributes[attrId('podtip')] === 'Saša');
  ok('shortcut before = snimka (baza uspoređuje jsonb =)', ai && eq(ai.before.filter_state, fx.presets.find(x => x.name === 'AI_rucak').filter_state));
  const rows = groupRows(p);
  ok('grupiranje: Projekti/Sasa → Projekti/Saša',
    rows.some(r => eq(r.values, ['Projekti', 'Saša'])) && !rows.some(r => eq(r.values, ['Projekti', 'Sasa'])));
  ok('Tip izbornik se ne dira', !cfg(p, 'attribute_rules', attrId('tip')));
}

console.log('\n── O3: premjesti (Kuća / Osiguranje → Osiguranje / Kuća) ──');
{
  const s = snap();
  const n = count(s, v => v.tip === 'Kuća' && v.podtip === 'Osiguranje');
  const p = planRestructure([step(1, { tip: 'Kuća', podtip: 'Osiguranje' }, { tip: 'Osiguranje', podtip: 'Kuća' })], s);
  const om = rulesAfter(p, 'podtip').depends_on.options_map;
  ok(`promjena 2 × ${n}`, p.steps[0].changed === 2 * n && n > 0);
  ok('Kuća više nema Osiguranje', !om['Kuća'].includes('Osiguranje') && om['Kuća'].includes('Struja'));
  ok('Osiguranje dobiva Kuća NA KRAJ', eq(om.Osiguranje, ['Zivotno', 'Kuća']));
  ok('Tip izbornik isti (Kuća i dalje ima retke)', !cfg(p, 'attribute_rules', attrId('tip')));
  const rows = groupRows(p);
  ok('grupiranje: par prati premještaj', rows.some(r => eq(r.values, ['Osiguranje', 'Kuća'])) && !rows.some(r => eq(r.values, ['Kuća', 'Osiguranje'])));
}

console.log('\n── O5: izdvoji os (Audible_Koka/_Sasa → Audible + Namjena), pa zadano ──');
{
  const s = snap();
  s.attributes.push({ id: 'attr-namjena', category_id: CAT, slug: 'namjena', name: 'Namjena', data_type: 'text',
    default_value: 'Zajedničko', validation_rules: { type: 'suggest', suggest: ['Zajedničko', 'Koka', 'Saša', 'Kućište'] } });
  const nk = count(s, v => v.podtip === 'Audible_Koka');
  const ns = count(s, v => v.podtip === 'Audible_Sasa');
  const total = s.events.length;
  const p = planRestructure([
    step(1, { tip: 'Zabava', podtip: 'Audible_Koka' }, { podtip: 'Audible', namjena: 'Koka' }),
    step(2, { tip: 'Zabava', podtip: 'Audible_Sasa' }, { podtip: 'Audible', namjena: 'Saša' }),
    step(99, { namjena: null }, { namjena: 'Zajedničko' }),
  ], s);
  ok('nema grešaka', p.errors.length === 0);
  ok(`korak 1: ${nk} redaka × 2 promjene`, p.steps[0].matched === nk && p.steps[0].changed === 2 * nk);
  ok('korak 99 vidi rezultat prethodnih (ostatak bez namjene)',
    p.steps[2].matched === total - nk - ns && p.steps[2].changed === total - nk - ns);
  const om = rulesAfter(p, 'podtip').depends_on.options_map;
  ok('Zabava: Audible na mjestu Audible_Koka, Audible_Sasa maknut',
    om.Zabava[1] === 'Audible' && !om.Zabava.includes('Audible_Koka') && !om.Zabava.includes('Audible_Sasa'));
  ok('Namjena izbornik već ima sve vrijednosti ⇒ ne dira se', !cfg(p, 'attribute_rules', 'attr-namjena'));
  const rows = groupRows(p);
  ok('grupiranje: oba retka postala jedan (isti bucket) — nije greška',
    rows.filter(r => eq(r.values, ['Zabava', 'Audible'])).length === 1);
}

// S185 (spec §20): Namjena živi kao PROD — lista pod `*` (+ ista lista pod autima, radi
// default_map). Forma za roditelja bez vlastitog ključa nudi listu pod `*`
// (`getOptionsForDependency`), pa ključ samo s ciljem SAKRIJE cijelu listu.
const NAMJENA = ['Zajedničko', 'Koka', 'Saša', 'Nena / Kućište'];
function snapNamjena() {
  const s = snap();
  s.attributes.push({ id: 'attr-namjena', category_id: CAT, slug: 'namjena', name: 'Namjena', data_type: 'text',
    default_value: null, validation_rules: { type: 'suggest', depends_on: { attribute_slug: 'tip',
      options_map: { '*': [...NAMJENA], 'auto Lacetti': [...NAMJENA], 'auto C5': [...NAMJENA] },
      default_map: { '*': 'Zajedničko', 'auto Lacetti': 'Saša', 'auto C5': 'Koka' } } } });
  let nena = 0;
  for (const e of s.events) {
    const t = e.values.tip;
    e.values.namjena = t === 'auto C5' ? 'Koka' : t === 'auto Lacetti' ? 'Saša'
      : t === 'Razno' && nena++ < 16 ? 'Nena / Kućište' : 'Zajedničko';
  }
  return s;
}
const namjenaRules = p => cfg(p, 'attribute_rules', 'attr-namjena')?.after ?? null;

console.log('\n── §20: Namjena pod `*` — promjena POSTOJEĆE vrijednosti ne stvara ključ ──');
{
  const s = snapNamjena();
  const ids = s.events.filter(e => e.values.tip === 'Zabava').slice(0, 3).map(e => e.id);
  const p = planRestructure([step(1, { tip: 'Zabava', namjena: 'Zajedničko' }, { namjena: 'Koka' }, ids)], s);
  ok('nema grešaka', p.errors.length === 0 && p.steps[0].changed === 3);
  const r = namjenaRules(p);
  ok('Zabava NE dobiva vlastiti ključ (Koka je već pod *)', !r || !('Zabava' in r.depends_on.options_map));
  ok('lista pod * netaknuta', !r || eq(r.depends_on.options_map['*'], NAMJENA));
}

console.log('\n── §20: preimenuj vrijednost liste pod `*` (Nena / Kućište → Nena) ──');
{
  const s = snapNamjena();
  const p = planRestructure([step(1, { namjena: 'Nena / Kućište' }, { namjena: 'Nena' })], s);
  const om = namjenaRules(p)?.depends_on.options_map ?? {};
  const want = ['Zajedničko', 'Koka', 'Saša', 'Nena'];
  ok('*: „Nena" na mjestu „Nena / Kućište"', eq(om['*'], want));
  ok('auto C5 i auto Lacetti isto (dijele listu, bez svojih redaka te vrijednosti)',
    eq(om['auto C5'], want) && eq(om['auto Lacetti'], want));
  ok('nijedan novi ključ (Razno ne dobiva svoj)', eq(Object.keys(om), ['*', 'auto Lacetti', 'auto C5']));
}

console.log('\n── §20: preimenuj zadanu vrijednost pod `*` (Zajedničko → Zajednicko) ──');
{
  const s = snapNamjena();
  const p = planRestructure([step(1, { namjena: 'Zajedničko' }, { namjena: 'Zajednicko' })], s);
  const dep = namjenaRules(p)?.depends_on;
  ok('default_map[*] prati', dep?.default_map['*'] === 'Zajednicko');
  ok('default_map auta netaknut', dep?.default_map['auto C5'] === 'Koka' && dep?.default_map['auto Lacetti'] === 'Saša');
  ok('lista pod * i pod autima: Zajednicko prvi', dep && ['*', 'auto C5', 'auto Lacetti']
    .every(k => dep.options_map[k][0] === 'Zajednicko' && !dep.options_map[k].includes('Zajedničko')));
  ok('nijedan novi ključ', dep && eq(Object.keys(dep.options_map), ['*', 'auto Lacetti', 'auto C5']));
}

console.log('\n── §20: nova vrijednost samo za jednog roditelja ⇒ njegov ključ = lista pod * + nova ──');
{
  const s = snapNamjena();
  const ids = s.events.filter(e => e.values.tip === 'Putovanja').slice(0, 2).map(e => e.id);
  const p = planRestructure([step(1, { tip: 'Putovanja' }, { namjena: 'Prijatelji' }, ids)], s);
  const om = namjenaRules(p)?.depends_on.options_map ?? {};
  ok('Putovanja: cijela lista + Prijatelji', eq(om.Putovanja, [...NAMJENA, 'Prijatelji']));
  ok('* bez Prijatelja (ne curi drugim Tipovima)', eq(om['*'], NAMJENA));
}

console.log('\n── §20: prazna lista pod `*` (Podtip) — ponašanje kao prije ──');
{
  const s = snap();
  const ids = s.events.filter(e => e.values.tip === 'Advokati').map(e => e.id);
  const om0 = fx.attributes.find(a => a.slug === 'podtip').validation_rules.depends_on.options_map;
  const p = planRestructure([step(1, { tip: 'Advokati' }, { tip: 'Pravnici' }, ids)], s);
  const om = rulesAfter(p, 'podtip').depends_on.options_map;
  ok('fixture: Podtip * je prazan', Array.isArray(om0['*']) && om0['*'].length === 0);
  ok('Pravnici dobiva vlastiti ključ (kao prije)', 'Pravnici' in om && !('Advokati' in om));
  ok('* ostaje prazan', eq(om['*'], []));
}

console.log('\n── Spoj u DVA bucketa = greška ──');
{
  // Medical_Sasa i PP su u fixtureu u različitim bucketima? Napravi ga sam.
  const s = snap();
  s.settings.groupings['Vrsta troška'].rows.push({ bucket: 'Test bucket', values: ['Zabava', 'Spotify'] });
  s.settings.groupings['Vrsta troška'].rows = s.settings.groupings['Vrsta troška'].rows
    .filter(r => !(r.values && r.values[0] === 'Zabava' && r.values[1] === 'Spotify' && r.bucket !== 'Test bucket'));
  const p = planRestructure([step(1, { tip: 'Zabava', podtip: 'Sky' }, { podtip: 'Spotify' })], s);
  ok('greška imenuje par i oba bucketa', p.errors.some(e => e.includes('Zabava / Spotify') && e.includes('Test bucket')));
  ok('uz grešku nema rpc paketa', p.rpc === null);
}

console.log('\n── Kartica: izvorplacanja Visa → VISA (košara, rate, automatika, status) ──');
{
  const s = snap();
  const p = planRestructure([step(1, { izvorplacanja: 'Visa' }, { izvorplacanja: 'VISA' })], s);
  const due = balanceW(p).due;
  ok('due.baskets ključ preimenovan, redoslijed isti', eq(Object.keys(due.baskets), ['VISA', 'Mastercard']));
  const au = cfg(p, 'area_settings').after.automations;
  ok('rata.date_map + remainder_map', 'VISA' in au.rata.date_map && 'VISA' in au.rata.remainder_map && !('Visa' in au.rata.date_map));
  ok('attribute_rules.date_map', au.attribute_rules[0].date_map.VISA === 'cutoff:3:5');
  const st = rulesAfter(p, 'status').depends_on;
  ok('Status (dijete): options_map i default_map ključ', 'VISA' in st.options_map && st.default_map.VISA === 'Planiran' && !('Visa' in st.default_map));
  const iz = rulesAfter(p, 'izvorplacanja').depends_on.options_map;
  ok('izvorplacanja: VISA na mjestu Vise pod RF', eq(iz['Sašin tekući RF'], ['Racun', 'VISA', 'Cash']));
  const ai = cfg(p, 'preset', fx.presets.find(x => x.name === 'AI_rucak').id);
  ok('shortcut prati', ai && ai.after.default_attributes[attrId('izvorplacanja')] === 'VISA');
}

console.log('\n── Račun: preimenuj (sidra, kolona liste, košara) ──');
{
  const s = snap();
  const p = planRestructure([step(1, { racun: 'Sašin tekući RF' }, { racun: 'RF račun' })], s);
  const nA = fx.anchors.filter(a => a.group_value === 'Sašin tekući RF').length;
  ok(`sidra: ${nA} prate`, p.config.filter(c => c.kind === 'anchor').length === nA && nA > 0);
  const cols = cfg(p, 'area_settings').after.list_columns.columns;
  ok('kolona liste: ključ kratice', cols[1].map['RF račun'] === 'RF' && !('Sašin tekući RF' in cols[1].map));
  ok('due.baskets.Visa.account', balanceW(p).due.baskets.Visa.account === 'RF račun');
  ok('izvorplacanja options_map ključ', 'RF račun' in rulesAfter(p, 'izvorplacanja').depends_on.options_map);
}

console.log('\n── Raspad (dio redaka u X, dio u Y) ⇒ upozorenje, ne pogađanje ──');
{
  const s = snap();
  const ids = s.events.filter(e => e.values.podtip === 'Audible_Sasa').map(e => e.id);
  const half = ids.slice(0, Math.floor(ids.length / 2));
  const p = planRestructure([
    step(1, { podtip: 'Audible_Sasa' }, { podtip: 'Knjige' }, half),
    step(2, { podtip: 'Audible_Sasa' }, { podtip: 'Podcast' }),
  ], s);
  const rows = groupRows(p);
  ok('grupiranje NIJE prepisano', rows.some(r => eq(r.values, ['Zabava', 'Audible_Sasa'])));
  ok('upozorenje imenuje par', p.warnings.some(w => w.includes('Zabava / Audible_Sasa')));
  const z = rulesAfter(p, 'podtip').depends_on.options_map.Zabava;
  ok('izbornik: Audible_Sasa maknut, Knjige i Podcast na kraj', !z.includes('Audible_Sasa') && eq(z.slice(-2), ['Knjige', 'Podcast']));
  ok('korak s event_id šalje popis bazi', eq(p.rpc.p_steps[0].event_ids, half));
}

console.log('\n── Vrijednost bez ijednog koraka ostaje (nikakvo čišćenje usput) ──');
{
  const p = planRestructure([step(1, { tip: 'Prihodi' }, { tip: 'Primici' })], snap());
  ok('Informatika / Odrzavanje i servis (0 redaka) ostaje',
    rulesAfter(p, 'podtip').depends_on.options_map.Informatika.includes('Odrzavanje i servis'));
}

console.log('\n── Filtri shortcuta i profila ──');
{
  const s = snap();
  s.settings.export_profiles.Kokin_format.filterState.attrFilterRaw = 'tip: =Domaćinstvo';
  s.settings.export_profiles.Kokin_format_kopija = JSON.parse(JSON.stringify(s.settings.export_profiles.Kokin_format));
  s.settings.export_profiles.Kokin_format_kopija.filterState.attrFilterRaw = 'tip: ~Doma';
  const p = planRestructure([step(1, { tip: 'Domaćinstvo' }, { tip: 'Kućanstvo' })], s);
  const zm = cfg(p, 'preset', fx.presets.find(x => x.name === 'Zaba MC isplate').id);
  ok('shortcut filtar (isExact) prati', zm && zm.after.filter_state.attrFilter.value === 'Kućanstvo');
  const ep = cfg(p, 'area_settings').after.export_profiles;
  ok('profil „=": prepisan', ep.Kokin_format.filterState.attrFilterRaw === 'tip: =Kućanstvo');
  ok('profil „~": netaknut + upozorenje', ep.Kokin_format_kopija.filterState.attrFilterRaw === 'tip: ~Doma'
    && p.warnings.some(w => w.includes('Kokin_format_kopija')));
}

console.log('\n── Blokirajuće greške ──');
{
  const s = snap();
  const p = planRestructure([
    step(1, { tip: 'Zabava' }, { nepostoji: 'x' }),
    step(2, { tip: 'Zabava' }, { isplata: '5' }),
    step(3, {}, { tip: 'Zabava' }),
    step(4, { tip: 'Zabava' }, { tip: 'Zabava ' }),
    { n: 5, category: 'Nema', when: { tip: 'x' }, set: { tip: 'y' } },
    step(6, {}, { tip: 'X' }, ['nije-u-kategoriji']),
  ], s);
  const has = (n, txt) => p.errors.some(e => e.startsWith(`step ${n}:`) && e.includes(txt));
  ok('nepoznat atribut', has(1, 'nepostoji'));
  ok('netekstualni atribut', has(2, 'number'));
  ok('bez uvjeta', has(3, 'no condition'));
  ok('prateći razmak (S167)', has(4, 'leading/trailing space'));
  ok('nepoznata kategorija', has(5, 'does not exist'));
  ok('event_id izvan kategorije', has(6, 'nije-u-kategoriji'));
  ok('rpc null', p.rpc === null);
}

console.log('\n── Predviđeno stanje (S179: ponovno mjerenje uspoređuje bazu s njim) ──');
{
  // Niz koji NIJE idempotentan: 1 postavi zadano svima, 2 ga na dva retka obriše.
  // „Isti koraci opet ne mijenjaju ništa" bi ovdje lagao; predviđanje ne smije.
  const s = snap();
  const kuca = s.events.filter(e => e.values.tip === 'Kuća').slice(0, 2).map(e => e.id);
  const zab = s.events.find(e => e.values.tip === 'Zabava');
  const p = planRestructure([
    step(1, { tip: 'Zabava' }, { tip: 'Zabava X' }),
    step(2, { tip: 'Kuća' }, { tip: null }, kuca),
  ], s);
  ok('predicted.slugs = atributi iz „postavi"', eq(p.predicted.slugs, ['tip']));
  ok('preimenovan redak: nova vrijednost', p.predicted.values[zab.id].tip === 'Zabava X');
  ok('obrisan redak: nema ključa', kuca.length === 2 && kuca.every(id => !('tip' in p.predicted.values[id])));
  ok('nedirnut redak: stara vrijednost', Object.entries(p.predicted.values)
    .filter(([id]) => !kuca.includes(id)).every(([id, v]) => {
      const was = s.events.find(e => e.id === id).values.tip;
      return was === 'Zabava' ? v.tip === 'Zabava X' : (v.tip ?? null) === (was ?? null);
    }));
  ok('svi eventi kategorije su u predviđanju', Object.keys(p.predicted.values).length === s.events.length);
}

console.log('\n── Snimka se ne mijenja ──');
{
  const s = snap();
  const before = JSON.stringify(s);
  planRestructure([step(1, { tip: 'Transfer' }, { tip: 'Prijenos' }), step(2, { izvorplacanja: 'Visa' }, { izvorplacanja: 'VISA' })], s);
  ok('ulaz netaknut', JSON.stringify(s) === before);
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) { console.log('❌ restructurePlan'); process.exit(1); }
