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

/** Every attribute slug the columns read. Feeds one bounded query, and the
 *  pre-delete warning that `depends_on` references already get. */
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
