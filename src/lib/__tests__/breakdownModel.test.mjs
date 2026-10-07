/**
 * breakdownModel.test.mjs — „Kamo ide novac" (S165, RAZREZ_SPEC §12.1, §14)
 *
 * ZASTO POSTOJI
 *   Pločica razreza zbraja isti novac na tri načina (bucketi, Tipovi, „Izašlo")
 *   i sva tri moraju dati ISTI broj u lipu. Dvostruko brojanje se ne vidi: kolač
 *   je samo malo veći od stvarne potrošnje, bez ijedne poruke. Zato:
 *
 *   1. Σ bucketa = Σ Tipova = Izašlo, s grupiranjem i bez njega, obje strane.
 *   2. Isti par dvaput u grupiranju ⇒ greška i model BEZ bucketa.
 *   3. Specifičnost: par > `Tip / *` > nesvrstano — neovisno o redoslijedu.
 *   4. Korekcija s retkom u grupiranju ide U bucket; bez retka na vrh.
 *   5. Negativno se ne crta (R11), ali je u `notDrawn` i u zbroju.
 *   6. Povrat umanjuje svoj Tip; Tip smije biti negativan (R8).
 *   7. `outside` nije ni prihod ni trošak, a jest u podnožju.
 *   8. Drill (§12.3): dvoznačan Podtip ⇒ Tip; os naplate ⇒ ništa.
 *   9. STVARNA SNIMKA (TEST 07.10.2026.) daje brojke iz RAZREZ §4.3 u lipu.
 *
 * /!\ Test se čita kao dokaz samo ako može pasti: PROTUPROVJERA ispod izvodi
 *     naivno grupiranje (svaki redak u SVAKI bucket koji ga pokriva) i tvrdi da
 *     ga invarijanta 1 ruši.
 */
import { build } from 'esbuild';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.cwd(), 'node_modules', '.cache', 'breakdownModel.bundle.mjs');
mkdirSync(join(process.cwd(), 'node_modules', '.cache'), { recursive: true });
await build({
  stdin: {
    contents: "export * from './src/lib/breakdownModel';",
    resolveDir: process.cwd(), loader: 'ts', sourcefile: 'entry.ts',
  },
  bundle: true, format: 'esm', platform: 'node',
  outfile: out, alias: { '@': './src' }, logLevel: 'error',
});
const { buildBreakdown, toSunburst, drillFor, ambiguousValues, breakdownDims, validateGrouping }
  = await import(pathToFileURL(out).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' | ' + extra : ''}`); } };

// ── pomoćno ─────────────────────────────────────────────────────────────────
const W = {
  type: 'breakdown', title: 'T', levels: ['tip', 'podtip'], plus: 'uplata', minus: 'isplata',
  income: { slug: 'tip', op: 'in', values: ['Prihodi'] },
  outside: [{ slug: 'tip', op: 'in', values: ['Transfer'] }],
  unclassified: ['N/A'],
  adjustments: [{ label: 'gotovina',
    add: [{ slug: 'tip', op: 'in', values: ['Transfer'] }, { slug: 'podtip', op: 'in', values: ['cash'] }],
    subtract: [{ slug: 'izvor', op: 'in', values: ['Cash'] }, { slug: 'tip', op: 'not_in', values: ['Transfer'] }] }],
  grouping: 'G',
};
// dims = tip, podtip, izvor
const R = (tip, podtip, izvor, plus, minus, n = 1) =>
  ({ g: [tip, podtip, izvor], plus_sum: plus, minus_sum: minus, n, n_no_date: 0 });
const ROWS = [
  R('Prihodi', 'Koka', 'Racun', 1000, 0),
  R('Prihodi', 'Saša', 'Racun', 500.5, 0),
  R('Kuća', 'Struja', 'Racun', 0, 80.1),
  R('Kuća', 'Plin', 'Racun', 0, 40.2),
  R('Kuća', 'Povrat Zoran', 'Racun', 70, 0),           // povrat: samo uplata
  R('Porezi', 'porez', 'Racun', 300, 100),              // R11: povrat > plaćeno
  R('Zabava', 'Kino', 'Cash', 0, 12.3),                 // gotovinski trošak (evidentiran)
  R('Projekti', 'Koka', 'Racun', 0, 5),                 // `Koka` dvoznačan (i Prihodi)
  R('Transfer', 'cash', 'Racun', 0, 200),               // podizanje
  R('Transfer', 'izmedju', 'Racun', 150, 900),
  R('N/A', null, 'Mastercard', 0, 33.33),
  R(null, null, 'Racun', 0, 1.11),                      // prazan Tip = nerazvrstano (R10)
  R('', null, 'Racun', 0, 2.22),
];
const G = { levels: ['tip', 'podtip'], rows: [
  { bucket: 'Mjesečni', values: ['Kuća', '*'] },
  { bucket: 'Investicije', values: ['Kuća', 'Plin'] },  // par pobjeđuje `Kuća / *`
  { bucket: 'Nužno', values: ['Porezi', '*'] },
  { bucket: 'Mjesečni', adjustment: 'gotovina' },
] };
const cents = (x) => Math.round(x * 100);
const sumChildren = (nd) => nd.children.reduce((s, c) => s + c.cents, 0);
const find = (nd, pred) => {
  if (pred(nd)) return nd;
  for (const c of nd.children) { const f = find(c, pred); if (f) return f; }
  return null;
};
/** Σ listova po (Tip, Podtip) bez obzira na bucket — „Σ Tipova". */
function leavesByPair(nd, acc = new Map()) {
  if (nd.children.length === 0) {
    const k = nd.kind === 'level' ? nd.values.join('|') : `${nd.kind}:${nd.name}`;
    acc.set(k, (acc.get(k) ?? 0) + nd.cents);
  }
  for (const c of nd.children) leavesByPair(c, acc);
  return acc;
}
/** Invarijanta 1 — i za protuprovjeru. */
function invariant1(m, flat) {
  const b = sumChildren(m.expense), t = sumChildren(flat.expense);
  const leaves = [...leavesByPair(m.expense).values()].reduce((s, v) => s + v, 0);
  return b === m.totals.outCents && t === flat.totals.outCents && b === t && leaves === b
    && sumChildren(m.income) === m.totals.inCents;
}

// ── 0. dimenzije ────────────────────────────────────────────────────────────
console.log('\ndimenzije:');
ok('levels ∪ uvjeti, bez ponavljanja, redoslijed prve pojave',
   JSON.stringify(breakdownDims(W)) === JSON.stringify(['tip', 'podtip', 'izvor']), JSON.stringify(breakdownDims(W)));

// ── 1. invarijanta zbroja ───────────────────────────────────────────────────
console.log('\n1. Σ bucketa = Σ Tipova = Izašlo:');
const m = buildBreakdown(ROWS, W, G);
const flat = buildBreakdown(ROWS, { ...W, grouping: undefined });
ok('bez grešaka', m.errors.length === 0 && m.bucketsApplied, JSON.stringify(m.errors));
ok('invarijanta vrijedi (s grupiranjem i bez)', invariant1(m, flat));
// Ručno: trošak = 80,10 + 40,20 − 70 + (100 − 300) + 12,30 + 5 + N/A (33,33 + 1,11 + 2,22)
//        + gotovina (200 − 12,30) = 50,30 − 200 + 12,30 + 5 + 36,66 + 187,70 = 91,96
ok('Izašlo = 91,96 u lipu', m.totals.outCents === 9196, String(m.totals.outCents));
ok('Ušlo = 1.500,50', m.totals.inCents === 150050, String(m.totals.inCents));
ok('razlika = ušlo − izašlo', m.totals.diffCents === 150050 - 9196);
ok('prihod po Podtipu (Prihodi → Koka, Saša)',
   m.income.children.length === 1 && m.income.children[0].children.map(c => c.name).join() === 'Koka,Saša');

// PROTUPROVJERA: naivno grupiranje stavlja Kuća/Plin u OBA bucketa (par i `*`).
{
  const naive = structuredClone(m);
  const plin = find(naive.expense, nd => nd.kind === 'level' && nd.values?.join('|') === 'Kuća|Plin');
  const mj = naive.expense.children.find(c => c.name === 'Mjesečni');
  const kuca = mj.children.find(c => c.name === 'Kuća');
  kuca.children.push({ ...plin, id: plin.id + '#dup' });
  kuca.cents += plin.cents; mj.cents += plin.cents; naive.expense.cents += plin.cents;
  naive.totals.outCents += plin.cents;
  ok('PROTUPROVJERA: dvostruko brojanje para ruši invarijantu', !invariant1(naive, flat));
}

// ── 2. duplikat para ────────────────────────────────────────────────────────
console.log('\n2. isti par dvaput:');
{
  const dup = { ...G, rows: [...G.rows, { bucket: 'Drugi', values: ['Kuća', 'Plin'] }] };
  const d = buildBreakdown(ROWS, W, dup);
  ok('errors neprazan, imenuje par', d.errors.some(e => e.includes('Kuća / Plin')), JSON.stringify(d.errors));
  ok('model BEZ bucketa', !d.bucketsApplied && !d.expense.children.some(c => c.kind === 'bucket'));
  ok('zbroj i dalje točan (ne dvaput)', d.totals.outCents === m.totals.outCents);
  const dupStar = { ...G, rows: [...G.rows, { bucket: 'Drugi', values: ['Kuća', '*'] }] };
  ok('i `Tip / *` dvaput je greška', buildBreakdown(ROWS, W, dupStar).errors.length > 0);
  const dupAdj = { ...G, rows: [...G.rows, { bucket: 'Drugi', adjustment: 'gotovina' }] };
  ok('i korekcija u dva bucketa je greška', buildBreakdown(ROWS, W, dupAdj).errors.length > 0);
  const ghost = { ...G, rows: [...G.rows.filter(r => !r.adjustment), { bucket: 'X', adjustment: 'nema me' }] };
  ok('korekcija koje nema na pločici je greška', validateGrouping(W, ghost).length > 0);
  const lv = { ...G, levels: ['tip', 'racun'] };
  ok('grupiranje po drugim razinama je greška', buildBreakdown(ROWS, W, lv).errors.length > 0);
  const missing = buildBreakdown(ROWS, W, undefined);
  ok('grupiranje kojeg nema ⇒ greška, model bez bucketa',
     missing.errors.length > 0 && !missing.bucketsApplied && missing.totals.outCents === m.totals.outCents);
}

// ── 3. specifičnost ─────────────────────────────────────────────────────────
console.log('\n3. par > Tip / * > nesvrstano:');
{
  const inBucket = (model, bucket, pair) => {
    const b = model.expense.children.find(c => c.name === bucket);
    return !!b && !!find(b, nd => nd.kind === 'level' && nd.values?.join('|') === pair);
  };
  ok('Kuća/Plin u paru (Investicije), ne u `Kuća / *`', inBucket(m, 'Investicije', 'Kuća|Plin') && !inBucket(m, 'Mjesečni', 'Kuća|Plin'));
  ok('Kuća/Struja u `Kuća / *` (Mjesečni)', inBucket(m, 'Mjesečni', 'Kuća|Struja'));
  const un = m.expense.children.find(c => c.kind === 'unassigned');
  ok('Zabava i Projekti u „nesvrstano"', !!un && inBucket(m, un.name, 'Zabava|Kino') && inBucket(m, un.name, 'Projekti|Koka'));
  const rev = { ...G, rows: [...G.rows].reverse() };
  const m2 = buildBreakdown(ROWS, W, rev);
  ok('redoslijed redaka grupiranja ne mijenja ishod', inBucket(m2, 'Investicije', 'Kuća|Plin') && m2.totals.outCents === m.totals.outCents);
  ok('nesvrstano je zadnje prije N/A',
     m.expense.children.at(-1).kind === 'unclassified' && m.expense.children.at(-2).kind === 'unassigned');
}

// ── 4. korekcija ────────────────────────────────────────────────────────────
console.log('\n4. korekcija:');
{
  const mj = m.expense.children.find(c => c.name === 'Mjesečni');
  const adj = mj.children.find(c => c.kind === 'adjustment');
  ok('s retkom u grupiranju: u bucketu', !!adj && adj.cents === 20000 - 1230, String(adj?.cents));
  ok('nije i na vrhu', !m.expense.children.some(c => c.kind === 'adjustment'));
  const noRow = { ...G, rows: G.rows.filter(r => !r.adjustment) };
  const m3 = buildBreakdown(ROWS, W, noRow);
  ok('bez retka: na vrhu', m3.expense.children.some(c => c.kind === 'adjustment' && c.cents === 18770));
  ok('bez grupiranja: na vrhu', flat.expense.children.some(c => c.kind === 'adjustment'));
  ok('broji Transfer retke koje razrez drži vani (podizanje)', adj.n === 1);
}

// ── 5. negativno se ne crta ─────────────────────────────────────────────────
console.log('\n5. krug (R11):');
{
  const s = toSunburst(m.expense);
  const porezLeaf = find(m.expense, nd => nd.values?.join('|') === 'Porezi|porez');
  ok('negativan list nije nacrtan', !s.ids.includes(porezLeaf.id));
  ok('jest u notDrawn, s putem i iznosom',
     s.notDrawn.some(x => x.path === 'Nužno › Porezi › porez' && x.cents === -20000), JSON.stringify(s.notDrawn));
  ok('povrat (samo uplata) je u notDrawn', s.notDrawn.some(x => x.path.endsWith('Povrat Zoran') && x.cents === -7000));
  ok('jest u zbroju (Izašlo ga oduzima)', m.totals.outCents === 9196);
  const byId = new Map(s.ids.map((id, i) => [id, i]));
  const okTotals = s.ids.every((id, i) => {
    const kids = s.ids.map((_, j) => j).filter(j => s.parents[j] === id);
    return kids.length === 0 || kids.reduce((a, j) => a + s.values[j], 0) === s.values[i];
  });
  ok('roditelj = zbroj nacrtane djece (branchvalues total)', okTotals);
  ok('sve vrijednosti > 0', s.values.every(v => v > 0));
  ok('Nužno nije nacrtan (nema ničega pozitivnog)', !byId.has('out/b:Nužno'));
}

// ── 6. povrat i negativan Tip ──────────────────────────────────────────────
console.log('\n6. povrat:');
{
  const kuca = flat.expense.children.find(c => c.name === 'Kuća');
  ok('Kuća = 80,10 + 40,20 − 70,00', kuca.cents === 5030, String(kuca.cents));
  const por = flat.expense.children.find(c => c.name === 'Porezi');
  ok('Porezi smije biti negativan (−200,00)', por.cents === -20000, String(por.cents));
  ok('negativan Tip ide na kraj (po iznosu), prije posebnih',
     flat.expense.children.filter(c => c.kind === 'level').at(-1).name === 'Porezi');
}

// ── 7. izvan razreza ────────────────────────────────────────────────────────
console.log('\n7. izvan razreza:');
{
  ok('podnožje: Transfer bruto 150,00 / 1.100,00', m.outside.plusCents === 15000 && m.outside.minusCents === 110000);
  ok('Transfer nije ni u trošku ni u prihodu',
     !find(m.expense, nd => nd.kind === 'level' && nd.values?.[0] === 'Transfer')
     && !find(m.income, nd => nd.kind === 'level' && nd.values?.[0] === 'Transfer'));
  const na = m.expense.children.find(c => c.kind === 'unclassified');
  ok('N/A, prazan i null Tip su JEDNA kriška unutar Izašlo (R10)', na.cents === 3333 + 111 + 222 && na.n === 3);
}

// ── 8. drill ────────────────────────────────────────────────────────────────
console.log('\n8. drill (§12.3):');
{
  const amb = ambiguousValues({ Prihodi: ['Koka', 'Saša'], Projekti: ['Koka', 'Sasa'], '*': [] }, ROWS);
  ok('dvoznačnost iz options_map', amb.has('Koka') && !amb.has('Saša'));
  const amb2 = ambiguousValues({}, [R('A', 'x', 'Racun', 0, 1), R('B', 'x', 'Racun', 0, 1)]);
  ok('dvoznačnost i iz redaka (vrijednost mimo popisa)', amb2.has('x'));
  const opt = { axisIsEventDate: true, ambiguous: amb };
  const tip = find(flat.expense, nd => nd.kind === 'level' && nd.depth === 0 && nd.name === 'Kuća');
  ok('Tip ⇒ tip = Kuća', JSON.stringify(drillFor(tip, W, opt)) === JSON.stringify({ slug: 'tip', value: 'Kuća' }));
  const str = find(flat.expense, nd => nd.values?.join('|') === 'Kuća|Struja');
  ok('jedinstven Podtip ⇒ podtip = Struja', JSON.stringify(drillFor(str, W, opt)) === JSON.stringify({ slug: 'podtip', value: 'Struja' }));
  const pk = find(flat.expense, nd => nd.values?.join('|') === 'Projekti|Koka');
  const d = drillFor(pk, W, opt);
  ok('dvoznačan Podtip ⇒ cijeli Tip + objašnjenje', d.slug === 'tip' && d.value === 'Projekti' && !!d.note, JSON.stringify(d));
  const bucket = m.expense.children.find(c => c.kind === 'bucket');
  ok('bucket ⇒ nema drilla', 'none' in drillFor(bucket, W, opt));
  ok('N/A ⇒ nema drilla', 'none' in drillFor(m.expense.children.at(-1), W, opt));
  ok('os naplate ⇒ nema drilla ni za Tip', 'none' in drillFor(tip, W, { ...opt, axisIsEventDate: false }));
}

// ── 8b. greške configa ──────────────────────────────────────────────────────
console.log('\ngreške configa:');
{
  const bad = buildBreakdown([{ g: ['Kuća', 'Struja'], plus_sum: 0, minus_sum: 1, n: 1, n_no_date: 0 }], W, G);
  ok('RPC s krivim brojem dimenzija ⇒ greška, ne tiha nula', bad.errors.length > 0 && bad.totals.outCents === 0);
  const nd = buildBreakdown([{ ...R('Kuća', 'Struja', 'Racun', 0, 0), n: 0, n_no_date: 4 }], W, G);
  ok('n_no_date se zbraja', nd.nNoDate === 4);
}

// ── 9. stvarna snimka ⇒ RAZREZ §4.3 ─────────────────────────────────────────
console.log('\n9. stvarna snimka (TEST 07.10.2026., 10/2025–09/2026) = RAZREZ §4.3:');
{
  const fx = JSON.parse(readFileSync(join(here, 'fixtures', 'breakdown_financije_12mj.json'), 'utf8'));
  const SPEC = {   // po kupnji, po naplati
    'Mjesečni troškovi': [20994.89, 19939.85], 'Kvaliteta života': [4164.57, 4106.59],
    'Putovanja i pokloni': [2909.94, 2281.44], 'Povremeno nužno': [2911.14, 2825.88],
    'Kuća investicije': [614.44, 716.33], 'Kućište · Nenin novac': [499.39, 499.39],
    'Koka razno': [4311.71, 4242.03], 'Saša razno': [1611.03, 1638.85],
    'nerazvrstano (N/A)': [2110.80, 3054.84],
  };
  [['kupnja', 0], ['naplata', 1]].forEach(([ax, i]) => {
    const mm = buildBreakdown(fx[ax], fx.widget, fx.grouping);
    const ff = buildBreakdown(fx[ax], { ...fx.widget, grouping: undefined });
    ok(`${ax}: bez grešaka, ništa nesvrstano`, mm.errors.length === 0 && !mm.expense.children.some(c => c.kind === 'unassigned'));
    ok(`${ax}: Ušlo 46.972,48`, mm.totals.inCents === 4697248, String(mm.totals.inCents));
    ok(`${ax}: Izašlo ${[40127.91, 39305.20][i]}`, mm.totals.outCents === cents([40127.91, 39305.20][i]), String(mm.totals.outCents));
    ok(`${ax}: invarijanta 1`, invariant1(mm, ff));
    const wrong = Object.entries(SPEC).filter(([b, v]) =>
      (mm.expense.children.find(c => c.name === b)?.cents ?? NaN) !== cents(v[i]));
    ok(`${ax}: svih 9 kriški = spec u lipu`, wrong.length === 0, wrong.map(([b]) => b).join(', '));
    const mj = mm.expense.children.find(c => c.name === 'Mjesečni troškovi');
    const got = mj?.children.find(c => c.kind === 'adjustment');
    ok(`${ax}: gotovina 3.830,90 unutar Mjesečnih`, got?.cents === 383090, String(got?.cents));
    ok(`${ax}: Transfer 61.420,64 / 81.561,51`, mm.outside.plusCents === 6142064 && mm.outside.minusCents === 8156151);
  });
}

console.log(`\n${pass} prošlo, ${fail} palo`);
if (fail) process.exit(1);
