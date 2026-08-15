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
import type { AreaSettings, DashboardConfig, UUID } from '@/types/database';

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

  const widgets = config.widgets.map(w => ({
    ...w,
    group_by: swap(w.group_by) ?? w.group_by,
    plus: swap(w.plus),
    minus: swap(w.minus),
    filters: w.filters?.map(f => ({ ...f, slug: swap(f.slug) ?? f.slug })),
    split: w.split
      ? { ...w.split, filters: w.split.filters.map(f => ({ ...f, slug: swap(f.slug) ?? f.slug })) }
      : undefined,
  }));

  return { config: { ...config, widgets }, changed };
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
  if (!dash?.widgets?.length) return 0;

  const { config, changed } = renameSlugInDashboard(dash, oldSlug, newSlug);
  if (changed === 0) return 0;

  const { error: upErr } = await supabase
    .from('areas')
    .update({ settings: { ...settings, dashboard: config } })
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
    if (w.group_by) out.add(w.group_by);
    if (w.plus) out.add(w.plus);
    if (w.minus) out.add(w.minus);
    for (const f of w.filters ?? []) out.add(f.slug);
    for (const f of w.split?.filters ?? []) out.add(f.slug);
  }
  return out;
}
