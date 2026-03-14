import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

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

/**
 * Hook to fetch the date range of events in the database.
 * Respects area and category filters to show appropriate date bounds.
 * 
 * @param areaId - Optional area filter
 * @param categoryId - Optional category filter (will include all descendants)
 */
export function useDateBounds(
  areaId: UUID | null = null,
  categoryId: UUID | null = null
): UseDateBoundsResult {
  const [bounds, setBounds] = useState<DateBounds>({ minDate: null, maxDate: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBounds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build the query based on filters
      let categoryIds: UUID[] = [];

      if (categoryId) {
        // Get all descendant category IDs (including the selected one)
        categoryIds = await getDescendantCategoryIds(categoryId);
      } else if (areaId) {
        // Get all category IDs for this area
        const { data: areaCats } = await supabase
          .from('categories')
          .select('id')
          .eq('area_id', areaId);
        
        categoryIds = (areaCats || []).map(c => c.id);
      }

      // Query for min and max dates
      let query = supabase
        .from('events')
        .select('event_date');

      // Apply category filter if we have category IDs
      if (categoryIds.length > 0) {
        query = query.in('category_id', categoryIds);
      }

      // Get min date
      const { data: minData, error: minError } = await query
        .order('event_date', { ascending: true })
        .limit(1);

      if (minError) throw minError;

      // Get max date (need fresh query)
      let maxQuery = supabase
        .from('events')
        .select('event_date');

      if (categoryIds.length > 0) {
        maxQuery = maxQuery.in('category_id', categoryIds);
      }

      const { data: maxData, error: maxError } = await maxQuery
        .order('event_date', { ascending: false })
        .limit(1);

      if (maxError) throw maxError;

      const minDate = minData?.[0]?.event_date || null;
      const maxDate = maxData?.[0]?.event_date || null;

      // If maxDate is in the past, use today as max
      // If maxDate is in the future, keep it (for scheduled events)
      const today = new Date().toISOString().split('T')[0];
      const effectiveMaxDate = maxDate 
        ? (maxDate > today ? maxDate : today)
        : today;

      setBounds({
        minDate,
        maxDate: effectiveMaxDate
      });

    } catch (err) {
      console.error('Failed to fetch date bounds:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch date bounds'));
      
      // Set fallback bounds
      const today = new Date().toISOString().split('T')[0];
      setBounds({
        minDate: today,
        maxDate: today
      });
    } finally {
      setLoading(false);
    }
  }, [areaId, categoryId]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchBounds();
  }, [fetchBounds]);

  return {
    bounds,
    loading,
    error,
    refresh: fetchBounds
  };
}

/**
 * Get all descendant category IDs for a given category (including itself)
 */
async function getDescendantCategoryIds(categoryId: UUID): Promise<UUID[]> {
  const ids: UUID[] = [categoryId];
  
  // Recursive function to get children
  const getChildren = async (parentId: UUID): Promise<void> => {
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_category_id', parentId);

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
export function getDatePresets(): { label: string; getRange: () => { from: string; to: string } }[] {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  /** Helper: subtract N years from today, return YYYY-MM-DD */
  const yearsAgo = (n: number): string => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - n);
    return d.toISOString().split('T')[0];
  };

  return [
    {
      label: 'Today',
      getRange: () => ({ from: todayStr, to: todayStr }),
    },
    {
      label: 'This Week',
      getRange: () => {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          from: monday.toISOString().split('T')[0],
          to: sunday.toISOString().split('T')[0],
        };
      },
    },
    {
      label: 'This Month',
      getRange: () => {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0],
        };
      },
    },
    {
      label: 'This Year',
      getRange: () => ({
        from: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        to: new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0],
      }),
    },
    // Dynamic rolling windows — always relative to today
    {
      label: 'Last Year',
      getRange: () => ({ from: yearsAgo(1), to: todayStr }),
    },
    {
      label: 'Last 3 Years',
      getRange: () => ({ from: yearsAgo(3), to: todayStr }),
    },
    {
      label: 'Last 5 Years',
      getRange: () => ({ from: yearsAgo(5), to: todayStr }),
    },
  ];
}

/**
 * Format date for display - YYYY-MM-DD format
 */
export function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-';
  // dateStr is already in YYYY-MM-DD format from Supabase
  return dateStr;
}
