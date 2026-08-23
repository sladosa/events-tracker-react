// ============================================================
// overviewApi.ts — read model for the Overview tab
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md §2.2, §2.4, §2.17
// SQL:  sql/035_area_group_agg.sql, sql/036_balance_anchors.sql
//
// ⚠ EVERY number on the Overview tab comes from Postgres, never from rows
//   pulled into the browser. That is not an optimisation, it is a correctness
//   condition: PostgREST truncates at max-rows = 1000 WITHOUT an error, so a
//   client-side sum over event_attributes would be silently wrong — and
//   Financije is already past 21k attribute rows.
//
// These are the first `.rpc()` calls in the app. Errors are surfaced, never
// swallowed: an unknown slug makes the RPC raise (see 035 §2), and that message
// is exactly what tells you a rename broke the dashboard config.
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import type { UUID, WidgetFilter } from '@/types/database';

// --------------------------------------------
// rpc_area_group_agg
// --------------------------------------------

export interface GroupAggRow {
  group_value: string | null;
  plus_sum: number;
  minus_sum: number;
  n: number;
}

export interface GroupAggParams {
  areaId: UUID;
  groupSlug?: string | null;
  plusSlug?: string | null;
  minusSlug?: string | null;
  filters?: WidgetFilter[];
  /** Exclusive lower bound on event_date. */
  from?: string | null;
  /** Inclusive upper bound on event_date. */
  asOf?: string | null;
}

export async function fetchGroupAgg(p: GroupAggParams): Promise<GroupAggRow[]> {
  const { data, error } = await supabase.rpc('rpc_area_group_agg', {
    p_area_id: p.areaId,
    p_group_slug: p.groupSlug ?? null,
    p_plus_slug: p.plusSlug ?? null,
    p_minus_slug: p.minusSlug ?? null,
    p_filters: p.filters ?? [],
    p_from: p.from ?? null,
    p_as_of: p.asOf ?? null,
  });
  if (error) throw error;
  return (data ?? []).map(toGroupAggRow);
}

// numeric comes back as a string from PostgREST when it does not fit a JS
// number cleanly; coerce once here so no caller has to remember.
function toGroupAggRow(r: Record<string, unknown>): GroupAggRow {
  return {
    group_value: (r.group_value as string | null) ?? null,
    plus_sum: Number(r.plus_sum ?? 0),
    minus_sum: Number(r.minus_sum ?? 0),
    n: Number(r.n ?? 0),
  };
}

// --------------------------------------------
// rpc_area_balance_anchored
// --------------------------------------------
// balance = anchor + Σ(movement STRICTLY after the confirmation date), §2.17.
// `anchored: false` means there is no confirmation yet and the sum runs over the
// whole history — the UI MUST say so rather than present it as a bank figure.

export interface AnchoredBalanceRow {
  group_value: string | null;
  anchored: boolean;
  anchor_amount: number | null;
  anchor_on: string | null;
  plus_sum: number;
  minus_sum: number;
  n: number;
  balance: number;
  /**
   * Newest `event_date` among the rows that actually entered this balance
   * (sql/038). NOT "last row in the Area": something sitting in "+ planirano"
   * has not moved the balance, so it must not make the number look fresher
   * than it is. `null` = anchored and nothing since.
   */
  last_on: string | null;
}

export async function fetchAnchoredBalance(p: {
  areaId: UUID;
  groupSlug: string;
  plusSlug?: string | null;
  minusSlug?: string | null;
  filters?: WidgetFilter[];
  asOf?: string | null;
}): Promise<AnchoredBalanceRow[]> {
  const { data, error } = await supabase.rpc('rpc_area_balance_anchored', {
    p_area_id: p.areaId,
    p_group_slug: p.groupSlug,
    p_plus_slug: p.plusSlug ?? null,
    p_minus_slug: p.minusSlug ?? null,
    p_filters: p.filters ?? [],
    p_as_of: p.asOf ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    group_value: (r.group_value as string | null) ?? null,
    anchored: Boolean(r.anchored),
    anchor_amount: r.anchor_amount == null ? null : Number(r.anchor_amount),
    anchor_on: (r.anchor_on as string | null) ?? null,
    plus_sum: Number(r.plus_sum ?? 0),
    minus_sum: Number(r.minus_sum ?? 0),
    n: Number(r.n ?? 0),
    balance: Number(r.balance ?? 0),
    last_on: (r.last_on as string | null) ?? null,
  }));
}

// --------------------------------------------
// balance_anchors — append-only history (§2.17)
// --------------------------------------------

export interface BalanceAnchor {
  id: UUID;
  area_id: UUID;
  group_slug: string;
  group_value: string;
  amount: number;
  confirmed_on: string;
  note: string | null;
  created_by: UUID;
  created_at: string;
}

export async function listAnchors(areaId: UUID, groupSlug: string): Promise<BalanceAnchor[]> {
  const { data, error } = await supabase
    .from('balance_anchors')
    .select('id, area_id, group_slug, group_value, amount, confirmed_on, note, created_by, created_at')
    .eq('area_id', areaId)
    .eq('group_slug', groupSlug)
    .order('confirmed_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) as BalanceAnchor[];
}

/**
 * Record what the bank app showed. A correction is a NEW row, never an update —
 * the history is the point (§2.17): it answers "since when do we disagree" and
 * it seeds the `Provjera stanja` Excel column (§2.11). There is deliberately no
 * UPDATE policy on the table to back this up.
 */
export async function saveAnchor(a: {
  areaId: UUID;
  groupSlug: string;
  groupValue: string;
  amount: number;
  confirmedOn: string;
  note?: string | null;
}): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Not signed in');

  // ⚠ A confirmation dated in the future would, by the strictly-after rule
  //   (§2.17), cut EVERY row up to that date out of the balance — and the tile
  //   would still show a confident number. The tile blocks this too; the guard
  //   sits here as well because it must hold for every caller, not just the
  //   one that happens to have the check today.
  if (a.confirmedOn > new Date().toISOString().slice(0, 10)) {
    throw new Error('Datum potvrde ne može biti u budućnosti.');
  }

  const { error } = await supabase.from('balance_anchors').insert({
    area_id: a.areaId,
    group_slug: a.groupSlug,
    group_value: a.groupValue,
    amount: a.amount,
    confirmed_on: a.confirmedOn,
    note: a.note ?? null,
    created_by: userId,
  });
  if (error) throw error;
}

/**
 * Remove one confirmation. Exists for typos only — RLS allows it for the row's
 * author or the Area owner. RLS-blocked deletes "succeed" with 0 rows, so the
 * result is checked (the CLAUDE.md rule that keeps biting).
 */
export async function deleteAnchor(id: UUID): Promise<void> {
  const { data, error } = await supabase.from('balance_anchors').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Anchor not deleted — no permission, or it was already gone.');
  }
}
