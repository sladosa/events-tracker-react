// ============================================================
// dashboardConfig.ts — keeping Overview config pointed at real slugs
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md §2.15 ("Ime Aree i slugovi — dvije krhkosti").
//
// WHY THIS FILE EXISTS
//   `areas.settings.dashboard` references attributes BY SLUG, and a slug is not
//   immutable. S105d is the precedent: normalising a slug silently broke every
//   `depends_on` that pointed at the old one, and the dropdowns went grey with
//   no error anywhere. The dashboard is the same shape of reference, so it gets
//   the same treatment — the fixup runs in the SAME save as the rename.
//
//   Without it the failure is worse than grey dropdowns: `rpc_area_group_agg`
//   raises on an unknown slug (by design, sql/035 §2), so the balance tile stops
//   showing a number at all.
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import type {
  AreaSettings, DashboardConfig, DashboardWidget, Grouping, UUID, WidgetFilter,
} from '@/types/database';

/** Rewrite every occurrence of `oldSlug` in a dashboard config. Pure. */
export function renameSlugInDashboard(
  config: DashboardConfig,
  oldSlug: string,
  newSlug: string,
): { config: DashboardConfig; changed: number } {
  let changed = 0;
  const swap = (s: string | undefined) => {
    if (s === oldSlug) { changed++; return newSlug; }
    return s;
  };
  const swapFilter = (f: WidgetFilter): WidgetFilter => ({ ...f, slug: swap(f.slug) ?? f.slug });

  const widgets = config.widgets.map((w): DashboardWidget => {
    if (w.type === 'breakdown') {
      // RAZREZ §12: svaki slug pločice razreza — razine, iznosi, uvjeti, os
      // datuma. Ime grupiranja NIJE slug (ključ u `settings.groupings`).
      return {
        ...w,
        levels: w.levels.map(l => swap(l) ?? l),
        plus: swap(w.plus) ?? w.plus,
        minus: swap(w.minus) ?? w.minus,
        income: swapFilter(w.income),
        outside: w.outside?.map(swapFilter),
        date_axes: w.date_axes?.map(a => ({ ...a, slug: a.slug == null ? null : swap(a.slug) ?? a.slug })),
        adjustments: w.adjustments?.map(a => ({
          ...a, add: a.add.map(swapFilter), subtract: a.subtract.map(swapFilter),
        })),
      };
    }
    return {
      ...w,
      group_by: swap(w.group_by) ?? w.group_by,
      plus: swap(w.plus),
      minus: swap(w.minus),
      filters: w.filters?.map(swapFilter),
      split: w.split
        ? {
            ...w.split,
            filters: w.split.filters.map(swapFilter),
            due_slug: swap(w.split.due_slug),
          }
        : undefined,
      due: w.due
        ? {
            ...w.due,
            basket_by: swap(w.due.basket_by) ?? w.due.basket_by,
            due_slug: swap(w.due.due_slug) ?? w.due.due_slug,
            status_slug: swap(w.due.status_slug) ?? w.due.status_slug,
            // Ključevi `settle` su slugovi atributa skupnog retka (S162).
            ...(w.due.settle
              ? { settle: Object.fromEntries(Object.entries(w.due.settle).map(([k, v]) => [swap(k) ?? k, v])) }
              : {}),
          }
        : undefined,
    };
  });

  return { config: { ...config, widgets }, changed };
}

/**
 * Rename u `settings.groupings[*].levels` (RAZREZ §10.2). Pure.
 * ⚠ `rows[].values` su VRIJEDNOSTI atributa (`Kuća`, `Struja`), ne slugovi —
 *   rename OPCIJE ih lomi tiho, i to hvata `set_breakdown.py` (§16), ne ovo.
 */
export function renameSlugInGroupings(
  groupings: Record<string, Grouping>,
  oldSlug: string,
  newSlug: string,
): { groupings: Record<string, Grouping>; changed: number } {
  let changed = 0;
  const out: Record<string, Grouping> = {};
  for (const [name, g] of Object.entries(groupings)) {
    const levels = g.levels.map(l => {
      if (l === oldSlug) { changed++; return newSlug; }
      return l;
    }) as [string, string];
    out[name] = { ...g, levels };
  }
  return { groupings: out, changed };
}

/**
 * Apply a slug rename to one Area's stored dashboard config.
 * Returns how many references were rewritten (0 = nothing referenced it).
 *
 * Read-modify-write on the whole `settings` object, matching how
 * structureImport.ts and StructureNodeEditPanel already treat it — a partial
 * write would drop `automations` and take the rata modal with it.
 */
export async function fixupDashboardSlug(
  areaId: UUID,
  oldSlug: string,
  newSlug: string,
): Promise<number> {
  if (!oldSlug || oldSlug === newSlug) return 0;

  const { data, error } = await supabase
    .from('areas')
    .select('settings')
    .eq('id', areaId)
    .single();
  if (error) throw error;

  const settings = (data?.settings ?? null) as AreaSettings | null;
  const dash = settings?.dashboard;
  const groupings = settings?.groupings;
  if (!dash?.widgets?.length && !groupings) return 0;

  const d = dash?.widgets?.length ? renameSlugInDashboard(dash, oldSlug, newSlug) : null;
  const g = groupings ? renameSlugInGroupings(groupings, oldSlug, newSlug) : null;
  const changed = (d?.changed ?? 0) + (g?.changed ?? 0);
  if (changed === 0) return 0;

  // Isti write: pločica i grupiranje koje čita moraju se pomaknuti zajedno,
  // inače model javi „grupiranje ne odgovara razinama pločice".
  const { error: upErr } = await supabase
    .from('areas')
    .update({
      settings: {
        ...settings,
        ...(d ? { dashboard: d.config } : {}),
        ...(g ? { groupings: g.groupings } : {}),
      },
    })
    .eq('id', areaId);
  if (upErr) throw upErr;

  return changed;
}

/**
 * Every attribute slug a dashboard config depends on. Used to warn before a
 * delete, the same way depends_on references are checked today.
 */
export function dashboardSlugRefs(config: DashboardConfig | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const w of config?.widgets ?? []) {
    if (w.type === 'breakdown') {
      for (const l of w.levels) out.add(l);
      out.add(w.plus); out.add(w.minus); out.add(w.income.slug);
      for (const f of w.outside ?? []) out.add(f.slug);
      for (const a of w.date_axes ?? []) if (a.slug) out.add(a.slug);
      for (const a of w.adjustments ?? []) for (const f of [...a.add, ...a.subtract]) out.add(f.slug);
      continue;
    }
    if (w.group_by) out.add(w.group_by);
    if (w.plus) out.add(w.plus);
    if (w.minus) out.add(w.minus);
    for (const f of w.filters ?? []) out.add(f.slug);
    for (const f of w.split?.filters ?? []) out.add(f.slug);
    if (w.split?.due_slug) out.add(w.split.due_slug);
    if (w.due) {
      out.add(w.due.basket_by); out.add(w.due.due_slug); out.add(w.due.status_slug);
      for (const k of Object.keys(w.due.settle ?? {})) out.add(k);
    }
  }
  return out;
}
