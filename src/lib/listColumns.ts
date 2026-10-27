// ============================================================
// listColumns.ts — which columns the Activities list shows, per Area
// ============================================================
// Spec: CLAUDE.md Backlog, "Kolone Activities liste po Arei".
//
// WHAT THIS FILE IS FOR
//   Three things the config alone cannot do:
//     1. the DEFAULT — an Area with no config must render exactly today's list,
//        so the default is expressed here as a real column list, not as an
//        `if (!config)` branch scattered through the table
//     2. per-role defaults (header text, alignment, where it goes on mobile),
//        so a config can stay as short as `{ role: 'date' }`
//     3. slug fixup on rename — the same S105d hazard the dashboard has, with
//        the same cure: rewrite references in the SAME write as the rename
//
// WHY `actions` IS NOT OPTIONAL
//   A config that forgets it produces a list with no ⋮ menu — no edit, no view,
//   no delete — and nothing anywhere says why. It is appended if missing.
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import type {
  AreaSettings, ListColumn, ListColumnRole, ListColumnsConfig, UUID,
} from '@/types/database';

/** Today's list, written out. Used whenever an Area has no config of its own. */
export const DEFAULT_COLUMNS: ListColumn[] = [
  { role: 'date' },
  { role: 'time' },
  { role: 'category' },
  { role: 'events' },
  { role: 'user' },
  { role: 'comment' },
  { role: 'balance' },
  { role: 'actions' },
];

interface RoleDefaults {
  label: string;
  align: 'left' | 'right' | 'center';
  mobile: 'line1' | 'line2' | 'hide';
  width?: string;
  /** Tailwind classes that hide the column on smaller desktops, as today. */
  desktopHide?: string;
}

const ROLE_DEFAULTS: Record<ListColumnRole, RoleDefaults> = {
  date:     { label: 'Date',     align: 'left',   mobile: 'line1', width: 'w-28' },
  time:     { label: 'Time',     align: 'left',   mobile: 'line1', width: 'w-14' },
  category: { label: 'Category', align: 'left',   mobile: 'line2' },
  events:   { label: 'Events',   align: 'center', mobile: 'hide',  width: 'w-16' },
  user:     { label: 'User',     align: 'left',   mobile: 'line1', width: 'w-32', desktopHide: 'hidden lg:table-cell' },
  pair:     { label: 'Amount',   align: 'right',  mobile: 'line1', width: 'w-32' },
  attr:     { label: '',         align: 'left',   mobile: 'line2' },
  comment:  { label: 'Comment',  align: 'left',   mobile: 'line2', desktopHide: 'hidden lg:table-cell' },
  balance:  { label: 'Stanje',   align: 'right',  mobile: 'hide',  width: 'w-28' },
  actions:  { label: 'Actions',  align: 'right',  mobile: 'line1', width: 'w-12' },
};

/** A column with every default filled in — what the table actually renders. */
export interface ResolvedColumn extends ListColumn {
  label: string;
  align: 'left' | 'right' | 'center';
  mobile: 'line1' | 'line2' | 'hide';
  width?: string;
  desktopHide?: string;
  /** Stable key for React, unique within one resolved list. */
  key: string;
}

export function resolveColumns(config: ListColumnsConfig | null | undefined): ResolvedColumn[] {
  const configured = Boolean(config?.columns?.length);
  const raw = configured ? config!.columns : DEFAULT_COLUMNS;

  // A configured Area that forgot `actions` would lose edit/view/delete with no
  // message anywhere — cheaper to append than to explain later.
  // `actions` is pinned to the end whatever the config says: the cell is
  // sticky-right, and a sticky cell in the middle of a scrolling table covers
  // its neighbours instead of staying put.
  const withActions = raw.some(c => c.role === 'actions') ? raw : [...raw, { role: 'actions' as const }];
  const cols = [
    ...withActions.filter(c => c.role !== 'actions'),
    ...withActions.filter(c => c.role === 'actions').slice(0, 1),
  ];

  const seen = new Map<string, number>();
  return cols.map(c => {
    const d = ROLE_DEFAULTS[c.role] ?? ROLE_DEFAULTS.attr;
    const n = (seen.get(c.role) ?? 0) + 1;
    seen.set(c.role, n);
    return {
      ...c,
      label: c.label ?? (c.role === 'attr' ? (c.slugs ?? []).join(c.sep ?? '/') : d.label),
      align: c.align ?? d.align,
      mobile: c.mobile ?? d.mobile,
      width: c.width ?? d.width,
      // `desktopHide` reproduces today's list, where Comment and User drop out
      // below `lg`. An Area that configured its columns asked for all of them,
      // so nothing is hidden behind its back — narrowing is `mobile`'s job.
      desktopHide: configured ? undefined : d.desktopHide,
      key: `${c.role}:${n}`,
    };
  });
}

/**
 * Tekst `attr` kolone za jedan redak — JEDNA kopija pravila (S171): dijele je
 * lista (`AttrCell`) i pločica Košare. `map` skraćuje vrijednost (`Kokin tekući
 * ZABA` → `ZABA`; nepoznata ostaje cijela), ista vrijednost dvaput se ne ponavlja
 * (`N/A/N/A` je jeo pola uske linije), `sep` spaja. Prazno = `''`.
 */
export function attrColumnText(
  col: Pick<ListColumn, 'slugs' | 'map' | 'sep'>,
  text: Map<string, string> | undefined,
): string {
  return (col.slugs ?? [])
    .map(sl => text?.get(sl))
    .filter((v): v is string => !!v)
    .map(v => col.map?.[v] ?? v)
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(col.sep ?? '/');
}

/**
 * Drugi redak uske liste kao tekst (S171, pločica Košare: „Tip/Podtip · opis",
 * isto kao lista na mobitelu): `attr` i `comment` kolone s `mobile: 'line2'`,
 * redom iz configa, spojene s ` · `. Prazni dijelovi se izostavljaju.
 */
export function line2Text(
  columns: ResolvedColumn[],
  text: Map<string, string> | undefined,
  comment: string | null,
): string {
  return columns
    .filter(c => c.mobile === 'line2' && (c.role === 'attr' || c.role === 'comment'))
    .map(c => (c.role === 'comment' ? (comment ?? '').trim() : attrColumnText(c, text)))
    .filter(Boolean)
    .join(' · ');
}

/**
 * Isto, ali ODVOJENO (S171, Saša na T-S171-6: u jednom retku opis ne stane — Tip/Podtip
 * ga pojede): `attrs` = `attr` kolone drugog retka spojene s ` · `, `comment` = opis
 * (prazan ako ga config ne prikazuje). Košara ih crta kao dva retka.
 */
export function line2Parts(
  columns: ResolvedColumn[],
  text: Map<string, string> | undefined,
  comment: string | null,
): { attrs: string; comment: string } {
  const cols = columns.filter(c => c.mobile === 'line2');
  return {
    attrs: cols.filter(c => c.role === 'attr').map(c => attrColumnText(c, text)).filter(Boolean).join(' · '),
    comment: cols.some(c => c.role === 'comment') ? (comment ?? '').trim() : '',
  };
}

/** Every attribute slug the columns read. Feeds one bounded query, and the
 *  pre-delete warning that `depends_on` references already get. */
// ─────────────────────────────────────────────
// Ćelija `Map` u sheetu `ListColumns` (S186)
// ─────────────────────────────────────────────
// ⚠ Pisač i čitač stoje ZAJEDNO jer su se razišli: izvoz je pisao parove odvojene
//   s ` | `, a uvoz dijelio na golom `|` — pa je ključ koji sadrži `|` (smajlić
//   `:-|`, DIARY 794 dana) svaki Structure roundtrip tiho raspolovio, i kolona je
//   za taj redak pokazivala sirovu vrijednost. Uhvatio ga E2E S186 (prvi koji vrti
//   mapu smajlića kroz export → uvoz).

/** `{ 'Kokin tekući ZABA': 'ZABA' }` → `Kokin tekući ZABA = ZABA | …` */
export function serializeColumnMap(map: Record<string, string> | undefined): string {
  if (!map) return '';
  return Object.entries(map).map(([k, v]) => `${k} = ${v}`).join(' | ');
}

/**
 * Obrnuto od `serializeColumnMap`. Dijeli na ` | ` (razmak s obje strane), kao pisač;
 * par se dijeli na PRVOM `=`. Stara, rukom pisana ćelija bez razmaka (`a = b|c = d`)
 * daje dio s dva `=` — tada (i samo tada) se dijeli na golom `|`, kao prije.
 */
export function parseColumnMap(cell: string): Record<string, string> {
  const strict = cell.split(/\s+\|\s+/);
  const parts = strict.some(p => (p.match(/=/g) ?? []).length > 1) ? cell.split('|') : strict;
  const map: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k && v) map[k] = v;
  }
  return map;
}

export function listColumnSlugRefs(config: ListColumnsConfig | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const c of config?.columns ?? []) {
    if (c.plus) out.add(c.plus);
    if (c.minus) out.add(c.minus);
    for (const s of c.slugs ?? []) out.add(s);
  }
  return out;
}

/** Rewrite every occurrence of `oldSlug`. Pure — mirrors renameSlugInDashboard. */
export function renameSlugInListColumns(
  config: ListColumnsConfig,
  oldSlug: string,
  newSlug: string,
): { config: ListColumnsConfig; changed: number } {
  let changed = 0;
  const swap = (s: string | undefined) => {
    if (s === oldSlug) { changed++; return newSlug; }
    return s;
  };

  const columns = config.columns.map(c => ({
    ...c,
    plus: swap(c.plus),
    minus: swap(c.minus),
    slugs: c.slugs?.map(s => swap(s) ?? s),
  }));

  return { config: { ...config, columns }, changed };
}

/**
 * Apply a slug rename to one Area's stored column config.
 * Read-modify-write on the WHOLE settings object — a partial write would drop
 * `automations` and take the rata modal with it (same note as dashboardConfig).
 */
export async function fixupListColumnsSlug(
  areaId: UUID,
  oldSlug: string,
  newSlug: string,
): Promise<number> {
  if (!oldSlug || oldSlug === newSlug) return 0;

  const { data, error } = await supabase
    .from('areas').select('settings').eq('id', areaId).single();
  if (error) throw error;

  const settings = (data?.settings ?? null) as AreaSettings | null;
  const lc = settings?.list_columns;
  if (!lc?.columns?.length) return 0;

  const { config, changed } = renameSlugInListColumns(lc, oldSlug, newSlug);
  if (changed === 0) return 0;

  const { error: upErr } = await supabase
    .from('areas').update({ settings: { ...settings, list_columns: config } }).eq('id', areaId);
  if (upErr) throw upErr;

  return changed;
}
