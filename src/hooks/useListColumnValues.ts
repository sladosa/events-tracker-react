// ============================================================
// useListColumnValues.ts — attribute values for the configured list columns
// ============================================================
// Spec: CLAUDE.md Backlog, "Kolone Activities liste po Arei".
//
// SCOPE OF THE QUERY — the part that matters
//   Keyed by `attribute_definition_id` and bounded by the event ids ALREADY ON
//   SCREEN. Never an `ILIKE` or an unfiltered read over `event_attributes`:
//   that table is the one BUG-S103-ANYATTR times out on for grantees, and it
//   passes 20k rows on a single dense Area. "Load more" extends the row set,
//   so the query re-runs over a superset — still bounded, still one round trip.
//
// P2 — PARENT EVENTS ARE READ, NEVER SUMMED (S186)
//   `pair` adds up a session's LEAF events. For an Area whose leaf sits at L1
//   that is one transaction, which is the case this was built for.
//   A column may name an attribute of a PARENT level (`Activity.mood`): its
//   value lives on the P2 parent event, which `useActivities` never lists. It
//   is found by the same identity View uses and taken ONCE, only when no
//   closer level carries the slug — `listChainValues.ts`.
//   ⚠ The parent query runs only when a wanted attribute is defined on a
//   category that is not a row's leaf. Financije (all on L1 `Transakcija`)
//   therefore sends exactly the requests it sent before.
//
// EMPTY IS AN ANSWER, NOT A FAILURE
//   A slug that no event carries yields `null`, and the cell renders an em dash.
//   It must never render as `0` — for money that is a claim, not a blank.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchAllPagedIn } from '@/lib/supabasePaging';
import { withRetry, withRetryQuery } from '@/lib/retry';
import { getCategoryMapContaining } from '@/lib/categoryCache';
import { ancestorIds } from '@/lib/categoryTree';
import {
  combineChainValues, matchParentEvents,
  type ListAttrRow, type ParentCandidate,
} from '@/lib/listChainValues';
import type { ActivityGroup } from '@/hooks/useActivities';
import type { UUID } from '@/types/database';
import type { ResolvedColumn } from '@/lib/listColumns';

export interface RowValues {
  /** slug → first non-empty text value across the session's events. */
  text: Map<string, string>;
  /** slug → summed numeric value across the session's events. */
  num: Map<string, number>;
}

export interface ListColumnValues {
  /** sessionKey → values. A missing key means "not loaded yet", not "empty". */
  byKey: Map<string, RowValues>;
  /** True only when the answer is for the CURRENT rows and slugs.
   *
   *  ⚠ S159 (Backlog B6, S147 sighting): this used to be a plain flag that
   *  stayed `true` from the previous answer while a new filter / "load more"
   *  was in flight — so new rows rendered `—` ("no amount") instead of the
   *  loading placeholder. Same class as BUG-S145-OVERVIEWTAB: `loaded` is a
   *  claim about an INPUT, so it is derived from the input it was computed for. */
  loaded: boolean;
  /** The read failed (after retries). Cells must not read this as "empty". */
  failed: boolean;
}

interface StoredResult {
  byKey: Map<string, RowValues>;
  /** `areaId|slugs|keys` the answer belongs to. */
  forSig: string | null;
  failed: boolean;
}

const EMPTY: StoredResult = { byKey: new Map(), forSig: null, failed: false };

interface Params {
  areaId: UUID | null;
  columns: ResolvedColumn[];
  activities: ActivityGroup[];
}

export function useListColumnValues(p: Params): ListColumnValues {
  const [result, setResult] = useState<StoredResult>(EMPTY);

  // Which slugs the columns actually read. Sorted so the signature is stable.
  const wantedSlugs = useMemo(() => {
    const out = new Set<string>();
    for (const c of p.columns) {
      if (c.plus) out.add(c.plus);
      if (c.minus) out.add(c.minus);
      for (const s of c.slugs ?? []) out.add(s);
    }
    return [...out].sort();
  }, [p.columns]);

  const slugSignature = wantedSlugs.join('|');
  const keySignature = p.activities.map(g => g.sessionKey).join('|');
  const sig = `${p.areaId ?? ''}#${slugSignature}#${keySignature}`;

  useEffect(() => {
    let cancelled = false;
    const done = (byKey: Map<string, RowValues>, failed = false) => {
      if (!cancelled) setResult({ byKey, forSig: sig, failed });
    };

    if (!p.areaId || wantedSlugs.length === 0 || p.activities.length === 0) {
      done(new Map());
      return;
    }

    (async () => {
      let defs: unknown[];
      try {
        const res = await withRetryQuery(() => supabase
          .from('attribute_definitions')
          .select('id, slug, category_id, categories!inner(area_id)')
          .eq('categories.area_id', p.areaId));
        defs = res.data ?? [];
      } catch (e) {
        console.error('useListColumnValues: definitions failed', e);
        done(new Map(), true);
        return;
      }

      // P1: the same slug can be defined at several levels of the chain, so a
      // slug maps to a LIST of definition ids, not to one.
      const slugById = new Map<string, string>();
      const wantedIds: string[] = [];
      const wantedCats = new Set<string>();
      for (const d of defs as { id: string; slug: string; category_id: string }[]) {
        slugById.set(d.id, d.slug);
        if (wantedSlugs.includes(d.slug)) { wantedIds.push(d.id); wantedCats.add(d.category_id); }
      }
      if (wantedIds.length === 0) {
        done(new Map());
        return;
      }

      // Parent levels (S186). Only categories that both hold a wanted attribute
      // AND are an ancestor of some row are asked about.
      let parentsByKey = new Map<string, string[]>();
      const rowCats = new Set(p.activities.map(g => g.category_id as string));
      if ([...wantedCats].some(c => !rowCats.has(c))) {
        try {
          const map = await getCategoryMapContaining({ areaId: p.areaId });
          const ancestorsOf = (leaf: string) =>
            ancestorIds(map, leaf as UUID).slice(1).filter(c => wantedCats.has(c));
          const parentCats = [...new Set(p.activities.flatMap(g => ancestorsOf(g.category_id)))];
          const starts = [...new Set(p.activities.map(g => g.session_start).filter((s): s is string => !!s))];
          if (parentCats.length > 0 && starts.length > 0) {
            const res = await withRetry(
              () => fetchAllPagedIn<ParentCandidate>(starts, (chunk, from, to) => supabase
                .from('events')
                .select('id, category_id, chain_key, user_id, session_start')
                .in('session_start', chunk)
                .in('category_id', parentCats)
                .order('id')
                .range(from, to)),
              r => r.error != null,
            );
            parentsByKey = matchParentEvents(p.activities, res.data, ancestorsOf);
          }
        } catch (e) {
          // A failed read is not "no parent value": the cells would say `—`.
          console.error('useListColumnValues: parent events failed', e);
          done(new Map(), true);
          return;
        }
      }

      // ⚠ Paged and chunked (S159): rows × slugs passes PostgREST's 1000-row
      //   cap after a few "load more" clicks, and the cap cuts WITHOUT an error
      //   — the rows past it would render `—`, i.e. "no amount".
      const eventIds = [
        ...p.activities.flatMap(g => g.events.map(e => e.id)),
        ...[...parentsByKey.values()].flat(),
      ];
      let attrs: unknown[];
      try {
        const res = await withRetry(
          () => fetchAllPagedIn<unknown>(eventIds, (chunk, from, to) => supabase
            .from('event_attributes')
            .select('id, event_id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean')
            .in('event_id', chunk)
            .in('attribute_definition_id', wantedIds)
            .order('id')
            .range(from, to)),
          r => r.error != null,
        );
        attrs = res.data;
      } catch (e) {
        console.error('useListColumnValues: values failed', e);
        done(new Map(), true);
        return;
      }

      const perEvent = new Map<string, ListAttrRow[]>();
      for (const a of attrs as ListAttrRow[]) {
        if (!perEvent.has(a.event_id)) perEvent.set(a.event_id, []);
        perEvent.get(a.event_id)!.push(a);
      }

      const byKey = new Map<string, RowValues>();
      for (const g of p.activities) {
        const levels = [g.events.map(e => e.id), ...(parentsByKey.get(g.sessionKey) ?? []).map(id => [id])];
        byKey.set(g.sessionKey, combineChainValues(levels, perEvent, slugById));
      }

      done(byKey);
    })();

    return () => { cancelled = true; };
    // Signatures stand in for the arrays: a re-render with the same rows and
    // the same slugs must not re-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.areaId, slugSignature, keySignature]);

  const current = result.forSig === sig;
  return {
    // Rows already answered keep their values while a superset loads ("load
    // more"); only the new rows show the placeholder.
    byKey: result.byKey,
    loaded: current,
    failed: current && result.failed,
  };
}
