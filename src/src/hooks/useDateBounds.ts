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
  return [
    {
      label: 'Today',
      getRange: () => {
        const today = new Date().toISOString().split('T')[0];
        return { from: today, to: today };
      }
    },
    {
      label: 'This Week',
      getRange: () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return {
          from: monday.toISOString().split('T')[0],
          to: sunday.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'This Month',
      getRange: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0]
        };
      }
    },
    {
      label: 'This Year',
      getRange: () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), 0, 1);
        const lastDay = new Date(now.getFullYear(), 11, 31);
        
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0]
        };
      }
    }
  ];
}

/**
 * Format date for display
 */
export function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
