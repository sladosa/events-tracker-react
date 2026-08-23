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

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
  reload: () => void;
}

export function useAreaDashboard(areaId: UUID | null): AreaDashboard {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [listColumns, setListColumns] = useState<ListColumnsConfig | null>(null);
  const [areaName, setAreaName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (!areaId) {
      setConfig(null);
      setListColumns(null);
      setAreaName('');
      setLoaded(true);
      return;
    }

    setLoaded(false);
    (async () => {
      const { data, error } = await supabase
        .from('areas')
        .select('name, settings')
        .eq('id', areaId)
        .single();
      if (cancelled) return;

      if (error) {
        // No dashboard is the safe answer: the tab disappears rather than
        // rendering tiles that would query with a config we could not read.
        console.error('useAreaDashboard:', error);
        setConfig(null);
        setListColumns(null);
        setAreaName('');
        setLoaded(true);
        return;
      }

      const settings = (data?.settings ?? null) as AreaSettings | null;
      const dash = settings?.dashboard ?? null;
      setConfig(dash && dash.widgets?.length ? dash : null);
      const cols = settings?.list_columns ?? null;
      setListColumns(cols && cols.columns?.length ? cols : null);
      setAreaName((data?.name as string) ?? '');
      setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [areaId, tick]);

  // Structure edits (rename, import, settings save) dispatch this; the dashboard
  // config can change under us — a renamed slug is fixed up in the same write.
  useEffect(() => {
    window.addEventListener('areas-changed', reload);
    return () => window.removeEventListener('areas-changed', reload);
  }, [reload]);

  return { config, listColumns, loaded, areaName, reload };
}
