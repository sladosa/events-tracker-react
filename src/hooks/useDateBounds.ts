import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';
import { localYmd, todayLocalYmd } from '@/lib/localDate';
import { withRetryQuery } from '@/lib/retry';

interface DateBounds {
  minDate: string | null;  // YYYY-MM-DD
  maxDate: string | null;  // YYYY-MM-DD
}

interface UseDateBoundsResult {
  bounds: DateBounds;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const NO_BOUNDS: DateBounds = { minDate: null, maxDate: null };

/**
 * Hook to fetch the date range of events in the database.
 * Respects area and category filters to show appropriate date bounds.
 *
 * ⚠ BUG-S154-DATARANGE: na TEST-u je `Financije_all` (2025-01-01 → 2026-08-24)
 *   pokazivao „Data range: 2003-04-07 — 2027-04-30" — obje granice iz DRUGIH
 *   Area (`Health`, `Health_Sasa`), izmjereno REST-om. Dva puta do upita bez
 *   filtra, oba zatvorena:
 *   (a) utrka: pri učitavanju je `areaId` kratko `null` (FilterContext se
 *       obnavlja u efektu) ⇒ krene upit nad CIJELOM bazom; stigne li on POSLIJE
 *       filtriranog, pregazi ga. Zato odgovor nosi ključ ulaza za koji vrijedi
 *       (`loadedFor`, isti razred kao BUG-S145-OVERVIEWTAB), a `loading` se
 *       izvodi u renderu — prozor u kojem granice lažu ne može nastati;
 *   (b) palo čitanje kategorija davalo je `[]`, a `[]` je značio „bez filtra".
 *       Sada baca, a Area bez kategorija ne broji ništa.
 *   ⚠ Greška NIJE „danas–danas" (bio je fallback): auto-init bi to upisao kao
 *   „All time" i sakrio sve retke. Greška je `error` i granice ostaju prazne.
 *
 * @param areaId - Optional area filter
 * @param categoryId - Optional category filter (will include all descendants)
 */
export function useDateBounds(
  areaId: UUID | null = null,
  categoryId: UUID | null = null
): UseDateBoundsResult {
  const inputKey = `${areaId ?? ''}|${categoryId ?? ''}`;
  const [result, setResult] = useState<{ key: string; bounds: DateBounds; error: Error | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);

  const fetchBounds = useCallback(async () => {
    const requestId = ++latestRequest.current;
    const isLatest = () => requestId === latestRequest.current;
    setRefreshing(true);
    try {
      const bounds = await loadDateBounds(areaId, categoryId);
      if (isLatest()) setResult({ key: inputKey, bounds, error: null });
    } catch (err) {
      if (!isLatest()) return;
      console.error('Failed to fetch date bounds:', err);
      setResult({
        key: inputKey,
        bounds: NO_BOUNDS,
        error: err instanceof Error ? err : new Error('Failed to fetch date bounds'),
      });
    } finally {
      if (isLatest()) setRefreshing(false);
    }
  }, [areaId, categoryId, inputKey]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchBounds();
  }, [fetchBounds]);

  // Odgovor za PRETHODNI ulaz se ne pokazuje ni jedan render (v. gore, a).
  const current = result !== null && result.key === inputKey;
  return {
    bounds: current ? result.bounds : NO_BOUNDS,
    loading: refreshing || !current,
    error: current ? result.error : null,
    refresh: fetchBounds
  };
}

/**
 * Najstariji i najnoviji `event_date` za Areu / kategoriju (s potomcima), ili
 * za cijelu bazu kad nije zadano ni jedno. Baca kad čitanje padne — nikad ne
 * vraća „bez filtra" umjesto greške.
 */
async function loadDateBounds(areaId: UUID | null, categoryId: UUID | null): Promise<DateBounds> {
  const today = todayLocalYmd();
  let categoryIds: UUID[] | null = null;   // null = bez filtra (nije zadana ni Area ni kategorija)

  if (categoryId) {
    categoryIds = await getDescendantCategoryIds(categoryId);
  } else if (areaId) {
    const { data: areaCats } = await withRetryQuery(() => supabase
      .from('categories')
      .select('id')
      .eq('area_id', areaId));
    categoryIds = (areaCats || []).map(c => c.id as UUID);
  }

  // Area bez ijedne kategorije nema ni evenata — isto kao filtrirani upit bez redaka.
  if (categoryIds !== null && categoryIds.length === 0) return { minDate: null, maxDate: today };

  const edge = async (ascending: boolean): Promise<string | null> => {
    const { data } = await withRetryQuery(() => {
      let q = supabase.from('events').select('event_date');
      if (categoryIds !== null) q = q.in('category_id', categoryIds);
      return q.order('event_date', { ascending }).limit(1);
    });
    return (data?.[0]?.event_date as string | undefined) || null;
  };
  const [minDate, maxDate] = await Promise.all([edge(true), edge(false)]);

  // If maxDate is in the past, use today as max
  // If maxDate is in the future, keep it (for scheduled events)
  return { minDate, maxDate: maxDate && maxDate > today ? maxDate : today };
}

/**
 * Get all descendant category IDs for a given category (including itself)
 */
async function getDescendantCategoryIds(categoryId: UUID): Promise<UUID[]> {
  const ids: UUID[] = [categoryId];

  // Recursive function to get children
  const getChildren = async (parentId: UUID): Promise<void> => {
    const { data: children } = await withRetryQuery(() => supabase
      .from('categories')
      .select('id')
      .eq('parent_category_id', parentId));

    if (children && children.length > 0) {
      for (const child of children) {
        ids.push(child.id);
        await getChildren(child.id);
      }
    }
  };

  await getChildren(categoryId);
  return ids;
}

/**
 * Helper to get date presets
 */
export type PeriodKey =
  | 'all-time'
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'last-2-months'
  | 'last-3-months'
  | 'this-year'
  | 'last-year'
  | 'last-3-years'
  | 'last-5-years'
  | 'custom';

export interface DatePreset {
  key: PeriodKey;
  label: string;
  getRange: () => { from: string; to: string };
}

export function getDatePresets(): DatePreset[] {
  const today = new Date();
  const todayStr = localYmd(today);

  const yearsAgo = (n: number): string => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - n);
    return localYmd(d);
  };

  const monthsAgo = (n: number): string => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - n);
    return localYmd(d);
  };

  return [
    {
      key: 'today',
      label: 'Today',
      getRange: () => ({ from: todayStr, to: todayStr }),
    },
    {
      key: 'this-week',
      label: 'This Week',
      getRange: () => {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          from: localYmd(monday),
          to: localYmd(sunday),
        };
      },
    },
    {
      key: 'this-month',
      label: 'This Month',
      getRange: () => {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          from: localYmd(firstDay),
          to: localYmd(lastDay),
        };
      },
    },
    {
      key: 'last-2-months',
      label: 'Last 2 Months',
      getRange: () => ({ from: monthsAgo(2), to: todayStr }),
    },
    {
      key: 'last-3-months',
      label: 'Last 3 Months',
      getRange: () => ({ from: monthsAgo(3), to: todayStr }),
    },
    {
      key: 'this-year',
      label: 'This Year',
      getRange: () => ({
        from: localYmd(new Date(today.getFullYear(), 0, 1)),
        to: localYmd(new Date(today.getFullYear(), 11, 31)),
      }),
    },
    {
      key: 'last-year',
      label: 'Last Year',
      getRange: () => ({ from: yearsAgo(1), to: todayStr }),
    },
    {
      key: 'last-3-years',
      label: 'Last 3 Years',
      getRange: () => ({ from: yearsAgo(3), to: todayStr }),
    },
    {
      key: 'last-5-years',
      label: 'Last 5 Years',
      getRange: () => ({ from: yearsAgo(5), to: todayStr }),
    },
  ];
}

/** Resolve a PeriodKey to absolute date range. Returns null for 'custom' or 'all-time'. */
export function resolvePeriodKey(key: PeriodKey): { from: string; to: string } | null {
  if (key === 'all-time' || key === 'custom') return null;
  const preset = getDatePresets().find(p => p.key === key);
  return preset ? preset.getRange() : null;
}

/**
 * Format date for display - YYYY-MM-DD format
 */
export function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-';
  // dateStr is already in YYYY-MM-DD format from Supabase
  return dateStr;
}
