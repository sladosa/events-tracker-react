// ============================================================
// useAreaDashboard.ts — does this Area have an Overview to show?
// ============================================================
// Spec: docs/OVERVIEW_TAB_SPEC.md OQ-4 — an Area with no dashboard config gets
// NO Overview tab, not an empty one. An empty tab is an invitation to
// disappointment; a missing tab says nothing and promises nothing.
//
// The config lives in `areas.settings.dashboard`, the same JSONB that already
// carries `automations`, `comment_template` and `export_profiles`.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { withRetryQuery } from '@/lib/retry';
import type { AreaSettings, DashboardConfig, ListColumnsConfig, UUID } from '@/types/database';

export interface AreaDashboard {
  config: DashboardConfig | null;
  /**
   * `settings.list_columns` — the Activities list layout for this Area.
   * It rides along on this hook because it comes out of the SAME `settings`
   * read; a second query for a sibling key would double the round trips for
   * nothing. `null` means "no config", which the table renders as today's list.
   */
  listColumns: ListColumnsConfig | null;
  /** True once the answer is known — the tab must not flicker into view. */
  loaded: boolean;
  areaName: string;
  /**
   * The read failed after retries, so `config` and `listColumns` are NOT an
   * answer — they are the absence of one.
   *
   * ⚠ Callers must not render "this Area has no dashboard / no column config"
   *   while this is true. That conflation is BUG-S121-AREACTX: one failed read
   *   silently turned Financije into a different app (no Overview tab, no
   *   amounts, no account abbreviations) until the user pressed F5 — and a user
   *   who does not know to press F5 concludes their data is gone.
   */
  error: boolean;
  reload: () => void;
}

export function useAreaDashboard(areaId: UUID | null): AreaDashboard {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [listColumns, setListColumns] = useState<ListColumnsConfig | null>(null);
  const [areaName, setAreaName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  /** Area whose config is currently in state, so a failed read can tell stale
   *  data apart from wrong data. Keeping Area A's columns while showing Area B
   *  would be worse than showing none. */
  const loadedAreaIdRef = useRef<UUID | null>(null);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (!areaId) {
      setConfig(null);
      setListColumns(null);
      setAreaName('');
      setError(false);
      loadedAreaIdRef.current = null;
      setLoaded(true);
      return;
    }

    setLoaded(false);
    (async () => {
      try {
        const { data } = await withRetryQuery(
          () => supabase.from('areas').select('name, settings').eq('id', areaId).single(),
          { onRetry: (n, e) => console.warn(`useAreaDashboard: retry ${n}`, e) },
        );
        if (cancelled) return;

        const settings = (data?.settings ?? null) as AreaSettings | null;
        const dash = settings?.dashboard ?? null;
        setConfig(dash && dash.widgets?.length ? dash : null);
        const cols = settings?.list_columns ?? null;
        setListColumns(cols && cols.columns?.length ? cols : null);
        setAreaName((data?.name as string) ?? '');
        setError(false);
        loadedAreaIdRef.current = areaId;
      } catch (e) {
        if (cancelled) return;
        console.error('useAreaDashboard:', e);
        // ⚠ Do NOT null the config here. Absence and failure look identical to
        //   every caller, and this branch is failure. Keep whatever we already
        //   hold IF it belongs to this same Area — stale-but-right beats empty.
        //   For a different Area we have nothing honest to show, so clear it;
        //   `error` is what stops callers reading that as "no config".
        if (loadedAreaIdRef.current !== areaId) {
          setConfig(null);
          setListColumns(null);
          setAreaName('');
        }
        setError(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [areaId, tick]);

  // Structure edits (rename, import, settings save) dispatch this; the dashboard
  // config can change under us — a renamed slug is fixed up in the same write.
  useEffect(() => {
    window.addEventListener('areas-changed', reload);
    return () => window.removeEventListener('areas-changed', reload);
  }, [reload]);

  return { config, listColumns, loaded, areaName, error, reload };
}
