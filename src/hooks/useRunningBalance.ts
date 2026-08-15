// ============================================================
// useRunningBalance.ts — the `Stanje` column beside each row
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md §2.12, and §2.17 for the anchor cut-off.
//
// WHY A COLUMN AND NOT JUST THE TILE
//   One number says "something is wrong". A balance beside every row says
//   "it went wrong AT THIS ROW". For finding the error that is the difference
//   between useless and useful — and the Δ chip guarantees there will be
//   something to find (13 residual months, 69 flagged rows).
//
// HOW IT IS CHEAP
//   Nothing extra is loaded from history. The total already comes from the RPC,
//   the list is already newest-first, so each row's balance is derived by
//   walking DOWN the rows already on screen:
//       saldo(0) = total ;  saldo(i) = saldo(i-1) − signed(i-1)
//   Works with "Load more" for free, because more rows only extend downwards.
//
// FOUR CONDITIONS, ALL NECESSARY — the column hides rather than lies
//   1. the list is filtered to ONE group value (mixed accounts ⇒ a running sum
//      is meaningless), and that filter is on the widget's own group attribute
//   2. newest-first order — the walk starts from the total, so it can only
//      descend. Oldest-first would need everything newer than the page.
//   3. the row must satisfy the widget's own filters. The list shows every row
//      of the account, including card purchases that do NOT move the balance
//      (§2.10). Subtracting those would drift the column away from the tile
//      within a screen.
//   4. rows on or before the anchor date get nothing: below the anchor the
//      running balance is undefined, because the sum does not reach back past
//      the confirmation (§2.17).
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchAnchoredBalance } from '@/lib/overviewApi';
import type { ActivityGroup } from '@/hooks/useActivities';
import type { BalanceByGroupWidget, DashboardConfig, UUID } from '@/types/database';

export interface RunningBalance {
  /** Render the column at all. */
  enabled: boolean;
  /** sessionKey → balance after that row, or null when it is not defined. */
  byKey: Map<string, number | null>;
  unit?: string;
  /** Group value the column is anchored to, for the header tooltip. */
  groupValue: string;
  /** ISO date of the confirmation the walk starts from, when there is one. */
  anchorOn: string | null;
}

const EMPTY: RunningBalance = {
  enabled: false,
  byKey: new Map(),
  groupValue: '',
  anchorOn: null,
};

interface Params {
  areaId: UUID | null;
  config: DashboardConfig | null;
  activities: ActivityGroup[];
  attrFilter: { attrDefId: string; value: string; isExact: boolean } | null;
  sortOrder: 'asc' | 'desc';
  dateTo: string | null;
}

export function useRunningBalance(p: Params): RunningBalance {
  const [result, setResult] = useState<RunningBalance>(EMPTY);

  // The widget this column mirrors: the first balance tile that has both amounts.
  const widget = useMemo<BalanceByGroupWidget | null>(() => {
    const w = p.config?.widgets?.find(
      x => x.type === 'balance_by_group' && (x.plus || x.minus),
    );
    return w ?? null;
  }, [p.config]);

  // Condition 2 up front — it needs no query.
  const orderOk = p.sortOrder === 'desc';
  const keySignature = p.activities.map(g => g.sessionKey).join('|');

  useEffect(() => {
    let cancelled = false;

    if (!p.areaId || !widget || !orderOk || !p.attrFilter?.isExact || p.activities.length === 0) {
      setResult(EMPTY);
      return;
    }

    (async () => {
      // ---- resolve slugs ↔ definition ids for this Area (one query) ----
      const { data: defs, error: defErr } = await supabase
        .from('attribute_definitions')
        .select('id, slug, data_type, categories!inner(area_id)')
        .eq('categories.area_id', p.areaId);
      if (defErr || !defs) { if (!cancelled) setResult(EMPTY); return; }

      const idBySlug = new Map<string, string[]>();
      const slugById = new Map<string, string>();
      for (const d of defs as { id: string; slug: string }[]) {
        idBySlug.set(d.slug, [...(idBySlug.get(d.slug) ?? []), d.id]);
        slugById.set(d.id, d.slug);
      }

      // Condition 1: the active filter must be ON the widget's group attribute.
      // Filtering by, say, Tip also produces one value — but not one account.
      const groupIds = idBySlug.get(widget.group_by) ?? [];
      if (!groupIds.includes(p.attrFilter!.attrDefId)) {
        if (!cancelled) setResult(EMPTY);
        return;
      }
      const groupValue = p.attrFilter!.value;

      // ---- the total this walk starts from ----
      // asOf = the list's upper date bound, so "newest visible row" and "newest
      // row in the total" are the same row. Without it a past date range would
      // start the column from today's balance.
      let anchorOn: string | null = null;
      let total = 0;
      try {
        const rows = await fetchAnchoredBalance({
          areaId: p.areaId!,
          groupSlug: widget.group_by,
          plusSlug: widget.plus ?? null,
          minusSlug: widget.minus ?? null,
          filters: widget.filters ?? [],
          asOf: p.dateTo,
        });
        const row = rows.find(r => r.group_value === groupValue);
        if (!row) { if (!cancelled) setResult(EMPTY); return; }
        total = row.balance;
        anchorOn = row.anchored ? row.anchor_on : null;
      } catch {
        if (!cancelled) setResult(EMPTY);
        return;
      }

      // ---- amounts + filter attributes for the rows on screen ----
      const wanted = new Set<string>();
      for (const s of [widget.plus, widget.minus]) if (s) wanted.add(s);
      for (const f of widget.filters ?? []) wanted.add(f.slug);
      const wantedIds = [...wanted].flatMap(s => idBySlug.get(s) ?? []);

      const eventIds = p.activities.flatMap(g => g.events.map(e => e.id));
      if (wantedIds.length === 0 || eventIds.length === 0) {
        if (!cancelled) setResult(EMPTY);
        return;
      }

      // Bounded by what is on screen, and keyed by attribute_definition_id —
      // never a scan over event_attributes (BUG-S103-ANYATTR).
      const { data: attrs, error: attrErr } = await supabase
        .from('event_attributes')
        .select('event_id, attribute_definition_id, value_text, value_number')
        .in('event_id', eventIds)
        .in('attribute_definition_id', wantedIds);
      if (attrErr || !attrs) { if (!cancelled) setResult(EMPTY); return; }

      const bySlug = new Map<string, Map<string, { text: string | null; num: number | null }>>();
      for (const a of attrs as {
        event_id: string; attribute_definition_id: string;
        value_text: string | null; value_number: number | null;
      }[]) {
        const slug = slugById.get(a.attribute_definition_id);
        if (!slug) continue;
        if (!bySlug.has(a.event_id)) bySlug.set(a.event_id, new Map());
        bySlug.get(a.event_id)!.set(slug, { text: a.value_text, num: a.value_number });
      }

      // Same predicate the SQL applies (sql/035 §3): `in` needs a value present,
      // `not_in` passes when there is none.
      const passes = (eventId: string) =>
        (widget.filters ?? []).every(f => {
          const v = bySlug.get(eventId)?.get(f.slug)?.text;
          const hit = v != null && f.values.includes(v);
          return f.op === 'not_in' ? !hit : hit;
        });

      const signedOf = (g: ActivityGroup) => {
        let sum = 0;
        for (const e of g.events) {
          if (!passes(e.id)) continue;
          const plus = widget.plus ? bySlug.get(e.id)?.get(widget.plus)?.num ?? 0 : 0;
          const minus = widget.minus ? bySlug.get(e.id)?.get(widget.minus)?.num ?? 0 : 0;
          sum += Number(plus) - Number(minus);
        }
        return sum;
      };

      // ---- walk down ----
      const byKey = new Map<string, number | null>();
      let running = total;
      for (const g of p.activities) {
        const moves = g.events.some(e => passes(e.id));
        const beforeAnchor = anchorOn !== null && g.event_date <= anchorOn;
        byKey.set(g.sessionKey, moves && !beforeAnchor ? running : null);
        running -= signedOf(g);
      }

      if (!cancelled) {
        setResult({ enabled: true, byKey, unit: widget.unit, groupValue, anchorOn });
      }
    })();

    return () => { cancelled = true; };
    // keySignature stands in for `activities` so a re-render with the same rows
    // does not re-query; the row set is what actually matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.areaId, widget, orderOk, p.attrFilter?.attrDefId, p.attrFilter?.value, p.attrFilter?.isExact, p.dateTo, keySignature]);

  return result;
}
