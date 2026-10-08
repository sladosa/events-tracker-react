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

import { Fragment, useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { useFilter } from '@/context/FilterContext';
import { BalanceByGroupTile } from './BalanceByGroupTile';
import { DueStrip } from './DueStrip';
import { BreakdownTile } from './BreakdownTile';
import type { DashboardConfig, DueConfig, Grouping, UUID } from '@/types/database';

/** Koja je pločica otvorena — v. „Harmonika" u komponenti. Modul, ne storage. */
let lastOpenTile: { area: UUID; idx: number | null } | null = null;
const rememberOpenTile = (v: { area: UUID; idx: number | null }) => { lastOpenTile = v; };

interface Props {
  areaId: UUID;
  config: DashboardConfig;
  /** `settings.groupings` — bucketi pločice razreza (RAZREZ §10.2). */
  groupings?: Record<string, Grouping> | null;
  canWrite: boolean;
  /** D5 (DOSPJELO_SPEC): potvrdu košare upisuje samo vlasnica Aree. */
  isOwner: boolean;
  /** Switch the tab strip to Activities after a drill sets the filter. */
  onNavigateToActivities: () => void;
}

export function OverviewTab({ areaId, config, groupings, canWrite, isOwner, onNavigateToActivities }: Props) {
  const { filter, setAttrFilter } = useFilter();
  // Skupni redak iz trake miče saldo ⇒ pločica se mora ponovo učitati.
  const [balanceReload, setBalanceReload] = useState(0);

  // Harmonika (S166, Saša): otvorena je najviše JEDNA pločica — dvije otvorene
  // guraju filtar (razdoblje!) predaleko gore. Zadano saldo, jer ga Koka uvijek
  // treba; razrez se otvara na zahtjev.
  // Pamti se na razini MODULA: preživi odlazak u Activities (drill ↗ i povratak —
  // AppHome ovaj tab odmontira), a NE preživi F5 — svako otvaranje appa kreće od
  // salda. Stanje nosi Areu za koju vrijedi (obrazac `loadedFor`, S145).
  const defaultOpen = (() => {
    const b = config.widgets.findIndex(w => w.type === 'balance_by_group');
    return b >= 0 ? b : 0;
  })();
  const [openState, setOpenState] = useState(lastOpenTile);
  const openIdx = openState && openState.area === areaId ? openState.idx : defaultOpen;
  // Uvijek je otvorena TOČNO JEDNA (Saša: „ili jedno ili drugo"): klik na
  // otvorenu pločicu otvara sljedeću — obje zatvorene nikome ne trebaju.
  // Sama jedna pločica (druge Aree) se smije i sklopiti.
  const toggleTile = (i: number) => {
    const n = config.widgets.length;
    const idx = openIdx !== i ? i : n > 1 ? (i + 1) % n : null;
    const next = { area: areaId, idx };
    rememberOpenTile(next);
    setOpenState(next);
  };
  const many = config.widgets.length > 1;

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
              <Fragment key={`${w.type}-${w.group_by}-${i}`}>
              {/* „Dospjelo" IZNAD salda (DOSPJELO_SPEC §4): potvrdiš gore,
                  saldo ispod se pomakne. Samo kad config ima `due`. */}
              {/* ⚠ `w` iz configa, ne `{ ...w }` — nov objekt na svakom renderu
                  bi traku ponovo učitavao pri svakoj promjeni filtra. */}
              {w.due && (
                <DueStrip
                  areaId={areaId}
                  widget={w as typeof w & { due: DueConfig }}
                  isOwner={isOwner}
                  onSettled={() => setBalanceReload(n => n + 1)}
                />
              )}
              <BalanceByGroupTile
                areaId={areaId}
                widget={w}
                canWrite={canWrite}
                reloadToken={balanceReload}
                collapsed={openIdx !== i}
                onToggleCollapsed={many ? () => toggleTile(i) : undefined}
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
                  //
                  // ⚠ NOT `split.filters[0]`. Since 2026-08-19 the split repeats
                  //   the balance's own `Izvor` condition (sql/037), so the first
                  //   entry is the SHARED one and drilling on it would just say
                  //   "this account" — the same thing the balance drill does.
                  //   What makes the split a split is the condition the base
                  //   filter does NOT have; that is the one worth drilling on.
                  if (opts.planned && w.split?.filters?.length) {
                    const base = w.filters ?? [];
                    const same = (a: typeof base[number], b: typeof base[number]) =>
                      a.slug === b.slug && a.op === b.op &&
                      a.values.length === b.values.length &&
                      a.values.every((v, vi) => v === b.values[vi]);
                    const f = w.split.filters.find(sf => !base.some(bf => same(sf, bf)))
                      ?? w.split.filters[0];
                    void drill(f.slug, f.values[0] ?? '');
                  } else {
                    void drill(w.group_by, groupValue);
                  }
                }}
              />
              </Fragment>
            );
          case 'breakdown':
            return (
              // Ključ nosi Areu: unutarnje stanje (strana, os) kreće iznova po Arei.
              <BreakdownTile
                key={`${w.type}-${w.title}-${areaId}-${i}`}
                areaId={areaId}
                widget={w}
                grouping={w.grouping ? groupings?.[w.grouping] : undefined}
                // Razdoblje = filtar, UKLJUČIVO s obje strane (RAZREZ §12.2).
                dateFrom={filter.dateFrom}
                dateTo={filter.dateTo}
                // Drill ne dira raspon datuma: „po kupnji" je event_date, isto
                // što filtar Activities filtrira (§12.3).
                onDrill={(slug, value) => { void drill(slug, value); }}
                collapsed={openIdx !== i}
                onToggleCollapsed={() => toggleTile(i)}
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
