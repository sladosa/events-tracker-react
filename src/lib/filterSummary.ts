// ============================================================
// filterSummary.ts — što filtar pokazuje kad je sklopljen, i koliko ga
// se uopće nudi na uskom ekranu (S171, Saša; Backlog B9)
// ============================================================
// ⚠ Sklopljen filtar koji ne kaže NIŠTA nitko ne sklapa: razdoblje pločice
//   razreza i uvjet s drilla tada su nevidljivi, a lista izgleda filtrirana
//   bez objašnjenja. Zato sklopljen red uvijek nosi sažetak.
// ⚠ Uvjet „uski ekran + tab" živi SAMO ovdje (`filterMode`) — ista radnja na
//   dvije širine na dva mjesta se razilazi (S125, S129).
// ============================================================

import { describeTypedFilter, type AttrFilterKind, type NumericOp } from './attrFilterNumeric';

export type FilterTab = 'activities' | 'overview' | 'structure';

/**
 * `period-only` — Overview na uskom ekranu: od filtra vrijedi samo razdoblje
 * (pločice su vezane uz Areu, kategorija na njih ne djeluje, a Area se ondje
 * ne mijenja — Saša, S171). `full` — sve ostalo.
 */
export type FilterMode = 'period-only' | 'full';

export function filterMode(narrow: boolean, tab: FilterTab): FilterMode {
  return narrow && tab === 'overview' ? 'period-only' : 'full';
}

/**
 * Selektor se ne smije sakriti dok Area nije odabrana — inače je nema gdje
 * odabrati. Za vrijeme obnove filtra (`restoring`) Area je kratko `null` i to
 * NIJE „nema Aree" (razred BUG-S145-OVERVIEWTAB).
 */
export function mustStayOpen(p: { areaId: string | null; restoring: boolean }): boolean {
  return !p.areaId && !p.restoring;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` → dijelovi, bez `Date` (zona ne smije pomaknuti dan, S152). */
function ymd(s: string | null | undefined): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * `01.01.–14.10.2026` (ista godina: jednom, na kraju) ·
 * `01.12.2025.–14.10.2026` (različite) · prazan string ako raspona nema.
 */
export function formatRangeShort(from: string | null | undefined, to: string | null | undefined): string {
  const a = ymd(from);
  const b = ymd(to);
  if (!a && !b) return '';
  if (a && !b) return `od ${pad(a[2])}.${pad(a[1])}.${a[0]}.`;
  if (!a && b) return `do ${pad(b[2])}.${pad(b[1])}.${b[0]}.`;
  const [ay, am, ad] = a!;
  const [by, bm, bd] = b!;
  if (ay === by) {
    if (am === bm && ad === bd) return `${pad(ad)}.${pad(am)}.${ay}.`;
    return `${pad(ad)}.${pad(am)}.–${pad(bd)}.${pad(bm)}.${by}.`;
  }
  return `${pad(ad)}.${pad(am)}.${ay}.–${pad(bd)}.${pad(bm)}.${by}.`;
}

export interface SummaryAttr {
  /** Ime atributa; `null` = „bilo koji atribut" (ATTR_FILTER_ANY). */
  name: string | null;
  value: string;
  isExact: boolean;
  op?: NumericOp | null;
  kind?: AttrFilterKind | null;
}

/**
 * `Podtip = Popravci` · `Iznos > 1000` · `Rate? = Yes` · `Opis ~ "gorivo"`.
 * Tipizirani uvjet ide kroz `describeTypedFilter` — isti tekst kao Excel export.
 */
export function describeAttrFilter(a: SummaryAttr): string {
  const name = a.name ?? 'Any attribute';
  if (a.kind || a.op) return `${name} ${describeTypedFilter(a)}`;
  return a.isExact ? `${name} = ${a.value}` : `${name} ~ "${a.value}"`;
}

/**
 * Dijelovi sažetka, redom: razdoblje, pa uvjet. Na Overviewu (`period-only`)
 * uvjet se ne nudi i ne prikazuje — na pločice ne djeluje.
 */
export function filterSummaryParts(p: {
  mode: FilterMode;
  periodLabel: string;
  dateFrom: string | null;
  dateTo: string | null;
  commentSearch?: string;
  attr?: SummaryAttr | null;
}): string[] {
  const range = formatRangeShort(p.dateFrom, p.dateTo);
  const period = p.periodLabel && range ? `${p.periodLabel} · ${range}` : (p.periodLabel || range);
  const parts = period ? [period] : [];
  if (p.mode === 'full') {
    if (p.attr && p.attr.value) parts.push(describeAttrFilter(p.attr));
    else if (p.commentSearch) parts.push(`Comment ~ "${p.commentSearch}"`);
  }
  return parts;
}
