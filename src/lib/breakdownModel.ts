// ============================================================
// breakdownModel.ts — „Kamo ide novac": JEDINI izračun pločice razreza
// ============================================================
// Spec: docs/RAZREZ_SPEC.md §10 (config), §12.1 (model), §12.3 (drill).
// SQL:  sql/056_area_breakdown.sql — vraća zbroj po kombinaciji dimenzija;
//       sve ostalo (strana, izvan razreza, korekcija, bucketi) je ovdje.
//
// ⚠ ČISTA FUNKCIJA, I NAMJERNO JEDNA. Desktop (krug + tablica) i mobitel
//   (lista s trakama) čitaju isti model — dvije kopije računa su dva mjesta
//   koja se razilaze (CLAUDE.md „ista radnja na dvije širine").
//
// ⚠ NOVAC U LIPAMA (cijeli brojevi) kroz cijeli model, kao `splitRataAmounts`.
//   Zbroj stotinjak decimala nosi grešku binarnog zapisa, a invarijanta
//   „Σ bucketa = Σ razina = Izašlo" uspoređuje se u lipu.
//
// INVARIJANTE (čuva `__tests__/breakdownModel.test.mjs`)
//   1. Σ bucketa = Σ razina = Izašlo, s grupiranjem i bez njega.
//   2. Isti par dvaput u grupiranju ⇒ greška i model BEZ bucketa — nikad
//      dvostruko brojanje (kolač veći od stvarne potrošnje, bez poruke).
//   3. Specifičnost: par > `X / *` > „nesvrstano".
//   4. Negativno se ne crta, ali se ne gubi: lista i zbroj ga nose.
//   5. Pogled ne mijenja brojke (S183): Σ po Namjeni = Σ po bucketima = Izašlo,
//      i Ušlo isto. Pogled samo drukčije slaže iste retke.
//
// POGLEDI (S183, RAZREZ §18): `views[]` pločice — bucketi (`grouping`), os
//   atributa iznad razina (`by`, npr. Namjena, na OBJE strane) ili ravno.
//   N/A i korekcija (gotovina) u pogledu `by` stoje na vrhu, kao zasebne kriške:
//   Namjenu N/A retku nitko nije birao, a čija je gotovina ne zna se.
// ============================================================

import type { BreakdownView, BreakdownWidget, Grouping, WidgetFilter } from '@/types/database';

/** Jedan redak iz `rpc_area_breakdown`; `g` po redoslijedu `breakdownDims`. */
export interface BreakdownRow {
  g: (string | null)[];
  plus_sum: number;
  minus_sum: number;
  n: number;
  n_no_date: number;
}

export type BreakdownNodeKind =
  | 'root'
  | 'bucket'
  | 'facet'          // vrijednost osi pogleda `by` (Namjena: Koka, Saša…), S183
  | 'level'          // vrijednost razine (Tip, Podtip…)
  | 'unclassified'   // N/A i prazna razina 1 (R10) — kriška UNUTAR Izašlo
  | 'unassigned'     // par bez bucketa — „dodijeli me", nikad ne nestane
  | 'adjustment';    // korekcijski redak (gotovina, nerazvrstano)

export interface BreakdownNode {
  /** Stabilan put — ključ za listu i `ids` kruga. */
  id: string;
  name: string;
  /** Neto u LIPAMA: trošak `minus − plus`, prihod `plus − minus`. */
  cents: number;
  /** Broj redaka (za korekciju: redaka koji ulaze u `add`). */
  n: number;
  kind: BreakdownNodeKind;
  /** `level`: indeks razine (0 = Tip) i vrijednosti razina do ovog čvora. */
  depth?: number;
  values?: (string | null)[];
  /** `facet`: slug i vrijednost osi pogleda (drill = taj jedan uvjet). */
  facet?: { slug: string; value: string | null };
  /** `level` ispod `facet`: čvor opisuju DVA uvjeta, a filtar nosi jedan ⇒ bez drilla. */
  scoped?: boolean;
  /** Tip (razina 0) pod bucketom koji je u N bucketa ⇒ ↗ `tip = X` bi pokazao više (S183). */
  splitAcross?: number;
  children: BreakdownNode[];
}

/** Fond (S183): vrijednost osi pogleda koju se prati kao blagajnu. */
export interface BreakdownFund {
  name: string;
  inCents: number;
  /** Svi retci troška s tom vrijednošću — i N/A (fond ne smije prešutjeti trošak). */
  outCents: number;
  leftCents: number;
  /** Od `outCents` dio koji je N/A (nije u `expenseNode`, nego u kriški N/A). */
  naCents: number;
  /** Čvorovi osi te vrijednosti (Tip → Podtip ispod) — „kamo je otišlo" / „odakle je ušlo". */
  expenseNode: BreakdownNode | null;
  incomeNode: BreakdownNode | null;
}

export interface BreakdownModel {
  dims: string[];
  totals: { inCents: number; outCents: number; diffCents: number };
  income: BreakdownNode;
  expense: BreakdownNode;
  /** Izvan razreza (Transfer): bruto, kako se ispisuje u podnožju. */
  outside: { plusCents: number; minusCents: number; n: number };
  /** Retci bez datuma u osi atributa (RPC `n_no_date`). */
  nNoDate: number;
  /** Greške configa. Kad ih ima, pločica ih ispiše crveno. */
  errors: string[];
  /** Je li grupiranje primijenjeno (false i kad ga ima, a neispravno je). */
  bucketsApplied: boolean;
  /** Pogled po kojem je model složen. */
  view: BreakdownView;
  /** Fondovi pogleda (`view.funds`); prazno kad ih nema. */
  funds: BreakdownFund[];
}

/** Ime čvora za praznu vrijednost razine. */
export const EMPTY_LABEL = '(prazno)';
export const UNCLASSIFIED_LABEL = 'nerazvrstano (N/A)';
export const UNASSIGNED_LABEL = 'nesvrstano';
/** Podredak N/A kriške: retci bez ikakve vrijednosti razine 1 (filtar ih ne zna naći). */
export const NO_LEVEL1_LABEL = '(prazno)';

const SEP = '\u0000';

export const toCents = (x: number): number => Math.round(Number(x) * 100);

/**
 * Dimenzije za RPC = razine ∪ svi slugovi uvjeta, po redoslijedu prve pojave.
 * Jedan poziv pokrije prihod, izvan razreza i korekcije — nema drugog upita.
 */
export function breakdownDims(w: BreakdownWidget): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => { if (s && !out.includes(s)) out.push(s); };
  w.levels.forEach(add);
  add(w.income?.slug);
  (w.outside ?? []).forEach(f => add(f.slug));
  for (const a of w.adjustments ?? []) [...a.add, ...a.subtract].forEach(f => add(f.slug));
  // Svi pogledi u ISTOM pozivu: prekidač pogleda je samo novi model, ne novi upit.
  for (const v of w.views ?? []) add(v.by);
  return out;
}

/** Pogledi pločice. Bez `views` jedan, iz starog ključa `grouping` (config prije S183). */
export function resolveViews(w: BreakdownWidget): BreakdownView[] {
  if (w.views?.length) return w.views;
  return [w.grouping ? { label: 'Bucketi', grouping: w.grouping } : { label: 'Tip' }];
}

/** Greške grupiranja u odnosu na pločicu. Prazno = smije se primijeniti. */
export function validateGrouping(w: BreakdownWidget, grouping: Grouping, groupingName?: string): string[] {
  const errs: string[] = [];
  const name = groupingName ?? w.grouping ?? '?';
  if (w.levels.length < 2) {
    errs.push(`Grupiranje „${name}" traži dvije razine, pločica ima ${w.levels.length}.`);
  }
  if (!Array.isArray(grouping.levels) || grouping.levels[0] !== w.levels[0] || grouping.levels[1] !== w.levels[1]) {
    errs.push(`Grupiranje „${name}" je po razinama [${(grouping.levels ?? []).join(', ')}], `
      + `a pločica po [${w.levels.slice(0, 2).join(', ')}].`);
  }
  const seen = new Map<string, string>();
  const adjLabels = new Set((w.adjustments ?? []).map(a => a.label));
  for (const r of grouping.rows ?? []) {
    if ('adjustment' in r) {
      const k = `adj${SEP}${r.adjustment}`;
      if (seen.has(k)) errs.push(`Korekcija „${r.adjustment}" je u dva bucketa (${seen.get(k)}, ${r.bucket}).`);
      else seen.set(k, r.bucket);
      if (!adjLabels.has(r.adjustment)) errs.push(`Korekcija „${r.adjustment}" iz grupiranja ne postoji na pločici.`);
      continue;
    }
    const [a, b] = r.values;
    const k = `${a}${SEP}${b}`;
    const shown = b === '*' ? `${a} / *` : `${a} / ${b}`;
    if (seen.has(k)) errs.push(`Par „${shown}" je dvaput u grupiranju (${seen.get(k)}, ${r.bucket}) — zbrojio bi se dvaput.`);
    else seen.set(k, r.bucket);
  }
  return errs;
}

function passes(v: string | null, f: WidgetFilter): boolean {
  // Ista semantika kao `p_filters` u 035: `in` = vrijednost postoji i u popisu;
  // `not_in` = nema je u popisu, prazno prolazi.
  return f.op === 'not_in' ? (v == null || !f.values.includes(v)) : (v != null && f.values.includes(v));
}

function node(id: string, name: string, kind: BreakdownNodeKind, extra: Partial<BreakdownNode> = {}): BreakdownNode {
  return { id, name, cents: 0, n: 0, kind, children: [], ...extra };
}

/** Lista po razinama: Tip → Podtip (→ …). Vraća korijenske čvorove razine 0. */
class LevelTree {
  private byId = new Map<string, BreakdownNode>();
  readonly top: BreakdownNode[] = [];
  private prefix: string;
  private scoped: boolean;
  private skip: number;
  /** `scoped`: stablo živi ispod čvora osi pogleda (v. `BreakdownNode.scoped`).
   *  `skip`: koliko gornjih razina se NE prikazuje (stalne su — v. `incomeSkip`); `depth` i
   *  `values` ostaju apsolutni, pa drill i dalje zna koju razinu čvor nosi. */
  constructor(prefix: string, scoped = false, skip = 0) { this.prefix = prefix; this.scoped = scoped; this.skip = skip; }

  add(values: (string | null)[], cents: number, n: number): void {
    let parent: BreakdownNode | null = null;
    let id = this.prefix;
    for (let d = this.skip; d < values.length; d++) {
      const v = values[d];
      id += `/${d}:${v ?? SEP}`;
      let nd = this.byId.get(id);
      if (!nd) {
        nd = node(id, v == null || v === '' ? EMPTY_LABEL : v, 'level', {
          depth: d, values: values.slice(0, d + 1), ...(this.scoped ? { scoped: true } : {}),
        });
        this.byId.set(id, nd);
        (parent ? parent.children : this.top).push(nd);
      }
      parent = nd;
    }
    if (parent) { parent.cents += cents; parent.n += n; }
  }
}

const SPECIAL_LAST: BreakdownNodeKind[] = ['unassigned', 'unclassified'];

/** Zbroji odozdo i složi: po iznosu silazno, posebne kriške zadnje. */
function finish(nd: BreakdownNode): void {
  if (nd.children.length === 0) return;
  nd.children.forEach(finish);
  nd.cents = nd.children.reduce((s, c) => s + c.cents, 0);
  nd.n = nd.children.reduce((s, c) => s + c.n, 0);
  nd.children.sort((a, b) => {
    const sa = SPECIAL_LAST.indexOf(a.kind), sb = SPECIAL_LAST.indexOf(b.kind);
    if (sa !== sb) return sa - sb;
    return b.cents - a.cents || a.name.localeCompare(b.name, 'hr');
  });
}

/**
 * Model pločice iz redaka RPC-a. `view` je jedan od `resolveViews(w)` (zadano
 * prvi); `grouping` je `settings.groupings[view.grouping]` (undefined = nema ga
 * ⇒ greška ako ga pogled traži).
 */
export function buildBreakdown(
  rows: BreakdownRow[],
  w: BreakdownWidget,
  grouping?: Grouping,
  view: BreakdownView = resolveViews(w)[0],
): BreakdownModel {
  const errors: string[] = [];
  const dims = breakdownDims(w);
  const levels = w.levels ?? [];
  if (levels.length === 0) errors.push('Pločica razreza nema `levels`.');
  if (!w.income?.slug) errors.push('Pločica razreza nema `income`.');
  if (view.grouping && view.by) {
    errors.push(`Pogled „${view.label}" ima i \`grouping\` i \`by\` — prikazujem po \`by\`.`);
  }
  const by = view.by ?? null;
  const groupingName = by ? undefined : view.grouping;

  const idx = new Map(dims.map((d, i) => [d, i] as const));
  const bad = rows.find(r => !Array.isArray(r.g) || r.g.length !== dims.length);
  if (bad) errors.push(`RPC je vratio ${bad.g?.length ?? 0} dimenzija, pločica ih traži ${dims.length}.`);
  const val = (r: BreakdownRow, slug: string): string | null => r.g[idx.get(slug) ?? -1] ?? null;

  // ── grupiranje: primijeni samo ispravno ──────────────────────────────
  let applyBuckets = false;
  if (groupingName) {
    if (!grouping) errors.push(`Grupiranje „${groupingName}" ne postoji u postavkama Aree.`);
    else {
      const gErr = validateGrouping(w, grouping, groupingName);
      errors.push(...gErr);
      applyBuckets = gErr.length === 0;
    }
  }
  const pairBucket = new Map<string, string>();
  const starBucket = new Map<string, string>();
  const adjBucket = new Map<string, string>();
  const bucketOrder: string[] = [];
  if (applyBuckets && grouping) {
    for (const r of grouping.rows) {
      if (!bucketOrder.includes(r.bucket)) bucketOrder.push(r.bucket);
      if ('adjustment' in r) adjBucket.set(r.adjustment, r.bucket);
      else if (r.values[1] === '*') starBucket.set(r.values[0], r.bucket);
      else pairBucket.set(`${r.values[0]}${SEP}${r.values[1]}`, r.bucket);
    }
  }
  /** Specifičnost, ne redoslijed: par > `X / *` > nesvrstano. */
  const bucketOf = (v0: string | null, v1: string | null): string | null =>
    pairBucket.get(`${v0}${SEP}${v1}`) ?? (v0 != null ? starBucket.get(v0) : undefined) ?? null;

  const unclassified = new Set(w.unclassified ?? []);
  // Strana prihoda (S183, Saša): razina na kojoj je `income` uvjet s JEDNOM vrijednošću je na
  // svakom retku prihoda ista (Financije: Tip = Prihodi) ⇒ ne prikazuje se, ide se ravno na Podtip.
  const incomeSkip = levels.length > 1 && w.income?.slug === levels[0]
    && (w.income.op ?? 'in') === 'in' && w.income.values?.length === 1 ? 1 : 0;
  const incomeTree = new LevelTree('in', false, incomeSkip);
  const flatTree = new LevelTree('out');
  const bucketTrees = new Map<string, LevelTree>();
  const unassignedTree = new LevelTree(`out/u`);
  const outside = { plusCents: 0, minusCents: 0, n: 0 };
  let naCents = 0, naN = 0, nNoDate = 0;
  const naBy = new Map<string | null, { cents: number; n: number }>();   // null = prazna razina 1
  // Pogled `by`: po jedno stablo razina za svaku vrijednost osi, na obje strane.
  const facetIn = new Map<string | null, LevelTree>();
  const facetOut = new Map<string | null, LevelTree>();
  const facetTree = (m: Map<string | null, LevelTree>, side: 'in' | 'out', v: string | null) => {
    let t = m.get(v);
    if (!t) { t = new LevelTree(`${side}/f:${v ?? SEP}`, true, side === 'in' ? incomeSkip : 0); m.set(v, t); }
    return t;
  };
  const fundNames = by ? (view.funds ?? []) : [];
  const fundSums = new Map<string, { in: number; out: number; na: number }>(fundNames.map(f => [f, { in: 0, out: 0, na: 0 }]));

  if (!bad && levels.length > 0 && w.income?.slug) {
    for (const r of rows) {
      const plus = toCents(r.plus_sum), minus = toCents(r.minus_sum);
      nNoDate += Number(r.n_no_date ?? 0);
      const lv = levels.map(l => val(r, l));
      const fv = by ? (val(r, by) || null) : null;
      const fund = fv != null ? fundSums.get(fv) : undefined;

      if (passes(val(r, w.income.slug), w.income)) {
        if (fund) fund.in += plus - minus;
        (by ? facetTree(facetIn, 'in', fv) : incomeTree).add(lv, plus - minus, r.n);
        continue;
      }
      if ((w.outside ?? []).some(f => passes(val(r, f.slug), f))) {
        outside.plusCents += plus; outside.minusCents += minus; outside.n += r.n;
        continue;
      }
      if (fund) fund.out += minus - plus;
      const v0 = lv[0];
      if (v0 == null || v0 === '' || unclassified.has(v0)) {
        naCents += minus - plus; naN += r.n;
        if (fund) fund.na += minus - plus;
        const nk = v0 == null || v0 === '' ? null : v0;
        const s = naBy.get(nk) ?? { cents: 0, n: 0 };
        s.cents += minus - plus; s.n += r.n; naBy.set(nk, s);
        continue;
      }
      if (by) { facetTree(facetOut, 'out', fv).add(lv, minus - plus, r.n); continue; }
      if (!applyBuckets) { flatTree.add(lv, minus - plus, r.n); continue; }
      const b = bucketOf(v0, lv[1] ?? null);
      if (b == null) { unassignedTree.add(lv, minus - plus, r.n); continue; }
      let t = bucketTrees.get(b);
      if (!t) { t = new LevelTree(`out/b:${b}`); bucketTrees.set(b, t); }
      t.add(lv, minus - plus, r.n);
    }
  }

  // ── korekcije: neovisno o strani — gotovina broji i Transfer retke ──
  const adjNodes: Array<{ label: string; nd: BreakdownNode }> = [];
  if (!bad) {
    for (const a of w.adjustments ?? []) {
      let cents = 0, n = 0;
      for (const r of rows) {
        const net = toCents(r.minus_sum) - toCents(r.plus_sum);
        if (a.add.every(f => passes(val(r, f.slug), f))) { cents += net; n += r.n; }
        if (a.subtract.every(f => passes(val(r, f.slug), f))) cents -= net;
      }
      const nd = node(`out/a:${a.label}`, a.label, 'adjustment');
      nd.cents = cents; nd.n = n;
      adjNodes.push({ label: a.label, nd });
    }
  }

  // ── slaganje strane troška ────────────────────────────────────────────
  const facetNodes = (m: Map<string | null, LevelTree>, side: 'in' | 'out'): BreakdownNode[] =>
    [...m].map(([v, t]) => {
      const fn = node(`${side}/f:${v ?? SEP}`, v ?? EMPTY_LABEL, 'facet', { facet: { slug: by!, value: v } });
      fn.children.push(...t.top);
      return fn;
    });
  const expense = node('out', 'Izašlo', 'root');
  if (by) {
    expense.children.push(...facetNodes(facetOut, 'out'));
    // Korekcija na vrhu: čija je gotovina, ne zna se (S183, odluka 5A).
    for (const x of adjNodes) expense.children.push(x.nd);
  } else if (applyBuckets) {
    for (const b of bucketOrder) {
      const t = bucketTrees.get(b);
      const adj = adjNodes.filter(x => adjBucket.get(x.label) === b);
      if (!t && adj.length === 0) continue;   // bucket bez ijednog retka u razdoblju
      const bn = node(`out/b:${b}`, b, 'bucket');
      if (t) bn.children.push(...t.top);
      for (const x of adj) bn.children.push(x.nd);
      expense.children.push(bn);
    }
    if (unassignedTree.top.length) {
      const un = node('out/u', UNASSIGNED_LABEL, 'unassigned');
      un.children.push(...unassignedTree.top);
      expense.children.push(un);
    }
    for (const x of adjNodes) if (!adjBucket.has(x.label)) expense.children.push(x.nd);
  } else {
    expense.children.push(...flatTree.top);
    for (const x of adjNodes) expense.children.push(x.nd);
  }
  if (naN > 0 || naCents !== 0) {
    // N/A po vrijednosti (S183, Saša): `N/A` se da filtrirati, prazan Tip ne (filtar
    // zna samo „= X"). Jedna vrsta ⇒ kriška sama nosi vrijednost (i ↗); dvije ⇒ podretci,
    // da ↗ na `N/A` ne obeća retke bez Tipa (This Year 25.10.: 0,80 € je baš takav redak).
    const na = node('out/na', UNCLASSIFIED_LABEL, 'unclassified');
    na.cents = naCents; na.n = naN;
    const kinds = [...naBy];
    if (kinds.length === 1) na.values = [kinds[0][0]];
    else {
      for (const [v, s] of kinds) {
        const ch = node(`out/na/${v ?? SEP}`, v ?? NO_LEVEL1_LABEL, 'unclassified', { values: [v] });
        ch.cents = s.cents; ch.n = s.n;
        na.children.push(ch);
      }
    }
    expense.children.push(na);
  }
  finish(expense);

  // Tip pod bucketom (S183): ↗ `tip = X` smije samo kad je CIJELI Tip u tom bucketu —
  // inače obeća iznos bucketa, a pokaže Tip iz svih bucketa (razred S166).
  if (applyBuckets) {
    const spans = new Map<string, number>();
    const tops = expense.children.filter(b => b.kind === 'bucket' || b.kind === 'unassigned')
      .flatMap(b => b.children.filter(c => c.kind === 'level' && c.depth === 0));
    for (const c of tops) { const k = c.values?.[0] ?? ''; spans.set(k, (spans.get(k) ?? 0) + 1); }
    for (const c of tops) {
      const s = spans.get(c.values?.[0] ?? '') ?? 1;
      if (s > 1) c.splitAcross = s;
    }
  }

  const income = node('in', 'Ušlo', 'root');
  income.children.push(...(by ? facetNodes(facetIn, 'in') : incomeTree.top));
  finish(income);

  return {
    dims,
    totals: { inCents: income.cents, outCents: expense.cents, diffCents: income.cents - expense.cents },
    income,
    expense,
    outside,
    nNoDate,
    errors,
    bucketsApplied: applyBuckets,
    view,
    funds: fundNames.map(name => {
      const s = fundSums.get(name)!;
      const find = (root: BreakdownNode) =>
        root.children.find(c => c.kind === 'facet' && c.facet?.value === name) ?? null;
      return {
        name, inCents: s.in, outCents: s.out, leftCents: s.in - s.out, naCents: s.na,
        expenseNode: find(expense), incomeNode: find(income),
      };
    }),
  };
}

// ============================================================
// Krug (R11): crta SAMO pozitivno; sve izostavljeno ide u `notDrawn`
// ============================================================

export interface SunburstData {
  ids: string[];
  labels: string[];
  parents: string[];
  /** U lipama; roditelj = zbroj NACRTANE djece (branchvalues 'total'). */
  values: number[];
  /** U lipama, poravnato s `ids`: NETO stavke (isto što lista pokazuje). Razlikuje se
   *  od `values` kad je ispod stavke nešto u minusu — tooltip tada mora reći oboje,
   *  inače krug i lista pokazuju dva broja za isto ime (Saša, S166). */
  nets: number[];
  notDrawn: Array<{ path: string; cents: number }>;
}

export function toSunburst(root: BreakdownNode): SunburstData {
  const drawn = new Map<string, number>();
  const notDrawn: SunburstData['notDrawn'] = [];

  const measure = (nd: BreakdownNode, path: string[]): number => {
    const p = nd.kind === 'root' ? path : [...path, nd.name];
    if (nd.children.length === 0) {
      if (nd.cents > 0) { drawn.set(nd.id, nd.cents); return nd.cents; }
      if (nd.cents < 0) notDrawn.push({ path: p.join(' › '), cents: nd.cents });
      return 0;
    }
    const sum = nd.children.reduce((s, c) => s + measure(c, p), 0);
    if (sum > 0) drawn.set(nd.id, sum);
    return sum;
  };
  measure(root, []);

  const out: SunburstData = { ids: [], labels: [], parents: [], values: [], nets: [], notDrawn };
  const emit = (nd: BreakdownNode, parent: string) => {
    const v = drawn.get(nd.id);
    if (v == null) return;
    out.ids.push(nd.id); out.labels.push(nd.name); out.parents.push(parent); out.values.push(v);
    out.nets.push(nd.cents);
    for (const c of nd.children) emit(c, nd.id);
  };
  emit(root, '');
  return out;
}

// ============================================================
// Drill (§12.3): filtar nosi JEDAN uvjet
// ============================================================

export type DrillTarget =
  | { slug: string; value: string }
  | { none: string };

/**
 * Vrijednosti razine 2 koje žive pod više vrijednosti razine 1 (`gorivo` pod
 * oba auta, `Koka` pod Projekti i Prihodi). Iz `options_map` ovisnog atributa
 * I iz redaka — redak s vrijednošću mimo popisa (povijest, uvoz) isto vrijedi.
 */
export function ambiguousValues(
  optionsMap: Record<string, string[]> | null | undefined,
  rows: BreakdownRow[] = [],
  i0 = 0,
  i1 = 1,
): Set<string> {
  const parents = new Map<string, Set<string>>();
  const note = (p: string, v: string) => {
    if (!parents.has(v)) parents.set(v, new Set());
    parents.get(v)!.add(p);
  };
  for (const [p, vs] of Object.entries(optionsMap ?? {})) {
    if (p === '*') continue;
    for (const v of vs ?? []) note(p, v);
  }
  for (const r of rows) {
    const p = r.g[i0], v = r.g[i1];
    if (p != null && v != null) note(p, v);
  }
  return new Set([...parents].filter(([, ps]) => ps.size > 1).map(([v]) => v));
}

export function drillFor(
  nd: BreakdownNode,
  w: BreakdownWidget,
  opts: { axisIsEventDate: boolean; ambiguous: Set<string> },
): DrillTarget {
  if (!opts.axisIsEventDate) {
    return { none: 'Filtar ne zna raspon datuma naplate — drill radi samo „po kupnji".' };
  }
  if (nd.kind === 'facet' && nd.facet) {
    if (nd.facet.value == null) return { none: 'Prazna vrijednost se ne može filtrirati.' };
    return { slug: nd.facet.slug, value: nd.facet.value };
  }
  if (nd.kind === 'unclassified') {
    // N/A (S183): ↗ samo kad čvor nosi JEDNU vrijednost razine 1 koja se da tražiti.
    if (nd.values?.length !== 1) return { none: 'Kriška ima više vrsta — ↗ je uz svaku vrstu ispod.' };
    const v = nd.values[0];
    if (v == null || v === '') {
      return { none: `${nd.n} ${nd.n === 1 ? 'redak' : 'redaka'} bez vrijednosti „${w.levels[0]}" — filtar zna tražiti samo vrijednost, ne prazno.` };
    }
    return { slug: w.levels[0], value: v };
  }
  if (nd.splitAcross && nd.depth === 0) {
    return { none: `${nd.values?.[0]} je u ${nd.splitAcross} bucketa — ↗ bi pokazao cijeli Tip, ne samo ovaj dio; ↗ uz Podtip pokazuje točno.` };
  }
  if (nd.scoped) {
    // `tip = auto C5` ispod `Koka` bi pokazao i Zajedničke retke tog Tipa — strelica
    // koja obećava jedno a daje drugo (razred S166). Čvor iznad nosi jedini uvjet.
    return { none: 'Ova stavka je dva uvjeta (os pogleda i razina), a filtar nosi jedan — ↗ uz os pogleda prikazuje sve njene retke.' };
  }
  if (nd.kind !== 'level' || nd.depth == null || !nd.values) {
    return { none: 'Ova stavka je više uvjeta, a filtar nosi jedan.' };
  }
  const v0 = nd.values[0];
  if (v0 == null || v0 === '') return { none: 'Prazna vrijednost se ne može filtrirati.' };
  const top = { slug: w.levels[0], value: v0 };
  if (nd.depth === 0) return top;

  // Dvoznačan ili prazan Podtip NEMA drill (S166, Saša). Prije je vodio na cijeli
  // Tip uz toast — dakle kopija strelice redak iznad koja obećava „gorivo" a daje
  // gorivo + registraciju, a toast se previdi. Strelica koje nema ne laže.
  const v = nd.values[nd.depth];
  if (v == null || v === '') {
    return { none: `Prazna vrijednost se ne može filtrirati — ↗ uz ${v0} prikazuje cijeli ${v0}.` };
  }
  if (opts.ambiguous.has(v)) {
    return { none: `„${v}" postoji pod više vrijednosti, a filtar nosi jedan uvjet — ↗ uz ${v0} prikazuje cijeli ${v0}.` };
  }
  return { slug: w.levels[nd.depth], value: v };
}
