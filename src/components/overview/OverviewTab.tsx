// ============================================================
// OverviewTab.tsx — the shell that renders one Area's tiles
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md §2.3, §2.15, §2.16, OQ-4.
//
// The tab only exists when the Area has `settings.dashboard` (OQ-4) — that
// check lives in AppHome, which owns the tab strip. This component assumes a
// config and renders it.
//
// ⚠ No configurator UI, deliberately (§2.15): with N = 1 Area we do not yet
//   know whether the widget dictionary is actually generic, and a UI would cast
//   the wrong vocabulary in concrete. Config is written by hand until N = 2.
// ============================================================

import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { BalanceByGroupTile } from './BalanceByGroupTile';
import type { DashboardConfig, UUID } from '@/types/database';

interface Props {
  areaId: UUID;
  config: DashboardConfig;
  canWrite: boolean;
  /** Switch the tab strip to Activities after a drill sets the filter. */
  onNavigateToActivities: () => void;
}

export function OverviewTab({ areaId, config, canWrite, onNavigateToActivities }: Props) {
  const { filter, setAttrFilter } = useFilter();

  /**
   * Drill = produce filter state, exactly the shape a Shortcut already saves
   * (§2.16) — so "Save as Shortcut" can capture the drilled view with no new
   * machinery.
   *
   * ⚠ KNOWN LIMIT, and §2.16 predicted it: FilterContext holds ONE attrFilter,
   *   while the tile's own condition is two (`Izvor = Racun` AND
   *   `Status ≠ Planiran`). So the drill deliberately means "show me this
   *   account", not "show me exactly the rows this number summed". For hunting
   *   a discrepancy that is the more useful list anyway — but it is a gap, not
   *   a design, and it is written down as one.
   */
  const drill = useCallback(
    async (slug: string, value: string) => {
      const { data, error } = await supabase
        .from('attribute_definitions')
        .select('id, category_id, categories!inner(area_id)')
        .eq('slug', slug)
        .eq('categories.area_id', areaId)
        .limit(1);

      if (error || !data || data.length === 0) {
        toast.error(`Ne mogu filtrirati — atribut "${slug}" nije nađen u ovoj Arei.`);
        return;
      }

      setAttrFilter({ attrDefId: data[0].id as string, value, isExact: true });
      onNavigateToActivities();
    },
    [areaId, setAttrFilter, onNavigateToActivities],
  );

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {config.widgets.map((w, i) => {
        switch (w.type) {
          case 'balance_by_group':
            return (
              <BalanceByGroupTile
                key={`${w.type}-${w.group_by}-${i}`}
                areaId={areaId}
                widget={w}
                canWrite={canWrite}
                // The global date filter reaches the tile, so "balance on
                // 31.03.2025" is answerable — and the same date stamps a
                // confirmation, which is what makes the anchor a check (§2.17).
                // `dateFrom` is deliberately NOT passed: a balance has no start,
                // it accumulates from the anchor.
                asOf={filter.dateTo}
                onDrill={(groupValue, opts) => {
                  // The planned number drills on its own condition; the balance
                  // drills on the group value. Both are single-attribute, which
                  // is all the filter can carry today.
                  if (opts.planned && w.split?.filters?.length) {
                    const f = w.split.filters[0];
                    void drill(f.slug, f.values[0] ?? '');
                  } else {
                    void drill(w.group_by, groupValue);
                  }
                }}
              />
            );
          default:
            // A widget type this build does not know. Say so — a silently
            // skipped tile is how a dashboard quietly becomes wrong.
            return (
              <div
                key={i}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                Nepoznat tip pločice: <code>{(w as { type: string }).type}</code> — ova verzija
                aplikacije ga ne zna nacrtati.
              </div>
            );
        }
      })}
    </div>
  );
}
