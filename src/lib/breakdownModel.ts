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
// ============================================================

import type { BreakdownWidget, Grouping, WidgetFilter } from '@/types/database';

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
  children: BreakdownNode[];
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
}

/** Ime čvora za praznu vrijednost razine. */
export const EMPTY_LABEL = '(prazno)';
export const UNCLASSIFIED_LABEL = 'nerazvrstano (N/A)';
export const UNASSIGNED_LABEL = 'nesvrstano';

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
  return out;
}

/** Greške grupiranja u odnosu na pločicu. Prazno = smije se primijeniti. */
export function validateGrouping(w: BreakdownWidget, grouping: Grouping): string[] {
  const errs: string[] = [];
  const name = w.grouping ?? '?';
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
  constructor(prefix: string) { this.prefix = prefix; }

  add(values: (string | null)[], cents: number, n: number): void {
    let parent: BreakdownNode | null = null;
    let id = this.prefix;
    for (let d = 0; d < values.length; d++) {
      const v = values[d];
      id += `/${d}:${v ?? SEP}`;
      let nd = this.byId.get(id);
      if (!nd) {
        nd = node(id, v == null || v === '' ? EMPTY_LABEL : v, 'level', {
          depth: d, values: values.slice(0, d + 1),
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
 * Model pločice iz redaka RPC-a. `grouping` je `settings.groupings[w.grouping]`
 * (undefined = nema ga ⇒ greška ako ga pločica traži).
 */
export function buildBreakdown(
  rows: BreakdownRow[],
  w: BreakdownWidget,
  grouping?: Grouping,
): BreakdownModel {
  const errors: string[] = [];
  const dims = breakdownDims(w);
  const levels = w.levels ?? [];
  if (levels.length === 0) errors.push('Pločica razreza nema `levels`.');
  if (!w.income?.slug) errors.push('Pločica razreza nema `income`.');

  const idx = new Map(dims.map((d, i) => [d, i] as const));
  const bad = rows.find(r => !Array.isArray(r.g) || r.g.length !== dims.length);
  if (bad) errors.push(`RPC je vratio ${bad.g?.length ?? 0} dimenzija, pločica ih traži ${dims.length}.`);
  const val = (r: BreakdownRow, slug: string): string | null => r.g[idx.get(slug) ?? -1] ?? null;

  // ── grupiranje: primijeni samo ispravno ──────────────────────────────
  let applyBuckets = false;
  if (w.grouping) {
    if (!grouping) errors.push(`Grupiranje „${w.grouping}" ne postoji u postavkama Aree.`);
    else {
      const gErr = validateGrouping(w, grouping);
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
  const incomeTree = new LevelTree('in');
  const flatTree = new LevelTree('out');
  const bucketTrees = new Map<string, LevelTree>();
  const unassignedTree = new LevelTree(`out/u`);
  const outside = { plusCents: 0, minusCents: 0, n: 0 };
  let naCents = 0, naN = 0, nNoDate = 0;

  if (!bad && levels.length > 0 && w.income?.slug) {
    for (const r of rows) {
      const plus = toCents(r.plus_sum), minus = toCents(r.minus_sum);
      nNoDate += Number(r.n_no_date ?? 0);
      const lv = levels.map(l => val(r, l));

      if (passes(val(r, w.income.slug), w.income)) {
        incomeTree.add(lv, plus - minus, r.n);
        continue;
      }
      if ((w.outside ?? []).some(f => passes(val(r, f.slug), f))) {
        outside.plusCents += plus; outside.minusCents += minus; outside.n += r.n;
        continue;
      }
      const v0 = lv[0];
      if (v0 == null || v0 === '' || unclassified.has(v0)) {
        naCents += minus - plus; naN += r.n;
        continue;
      }
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
  const expense = node('out', 'Izašlo', 'root');
  if (applyBuckets) {
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
    const na = node('out/na', UNCLASSIFIED_LABEL, 'unclassified');
    na.cents = naCents; na.n = naN;
    expense.children.push(na);
  }
  finish(expense);

  const income = node('in', 'Ušlo', 'root');
  income.children.push(...incomeTree.top);
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

  const out: SunburstData = { ids: [], labels: [], parents: [], values: [], notDrawn };
  const emit = (nd: BreakdownNode, parent: string) => {
    const v = drawn.get(nd.id);
    if (v == null) return;
    out.ids.push(nd.id); out.labels.push(nd.name); out.parents.push(parent); out.values.push(v);
    for (const c of nd.children) emit(c, nd.id);
  };
  emit(root, '');
  return out;
}

// ============================================================
// Drill (§12.3): filtar nosi JEDAN uvjet
// ============================================================

export type DrillTarget =
  | { slug: string; value: string; note?: string }
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
  if (nd.kind !== 'level' || nd.depth == null || !nd.values) {
    return { none: 'Ova stavka je više uvjeta, a filtar nosi jedan.' };
  }
  const v0 = nd.values[0];
  if (v0 == null || v0 === '') return { none: 'Prazna vrijednost se ne može filtrirati.' };
  const top = { slug: w.levels[0], value: v0 };
  if (nd.depth === 0) return top;

  const v = nd.values[nd.depth];
  if (v == null || v === '') {
    return { ...top, note: `prazna vrijednost — prikazujem cijeli ${v0}` };
  }
  if (opts.ambiguous.has(v)) {
    return { ...top, note: `filtar nosi jedan uvjet, a „${v}" postoji pod više vrijednosti — prikazujem cijeli ${v0}` };
  }
  return { slug: w.levels[nd.depth], value: v };
}
