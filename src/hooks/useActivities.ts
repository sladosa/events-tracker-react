import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

// --------------------------------------------
// Types
// --------------------------------------------

export interface ActivityEvent {
  id: UUID;
  category_id: UUID;
  event_date: string;        // YYYY-MM-DD
  session_start: string | null;  // ISO timestamp
  comment: string | null;
  created_at: string;
  edited_at: string;
  // Joined data
  category_name: string;
  category_path: string[];   // ['Fitness', 'Activity', 'Gym', 'Strength']
  area_name: string;
  area_icon: string | null;
}

export interface ActivityGroup {
  sessionKey: string;        // category_id + session_start (or event_id if no session)
  category_id: UUID;
  category_name: string;
  category_path: string[];
  area_name: string;
  area_icon: string | null;
  event_date: string;
  session_start: string | null;
  events: ActivityEvent[];
  eventCount: number;
}

interface UseActivitiesResult {
  activities: ActivityGroup[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface UseActivitiesOptions {
  areaId?: UUID | null;
  categoryId?: UUID | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  pageSize?: number;
}

// --------------------------------------------
// Hook
// --------------------------------------------

export function useActivities(options: UseActivitiesOptions = {}): UseActivitiesResult {
  const {
    areaId = null,
    categoryId = null,
    dateFrom = null,
    dateTo = null,
    pageSize = 20
  } = options;

  const [activities, setActivities] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  // Get descendant category IDs for hierarchical filtering
  const getDescendantCategoryIds = useCallback(async (catId: UUID): Promise<UUID[]> => {
    const ids: UUID[] = [catId];
    
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

    await getChildren(catId);
    return ids;
  }, []);

  // Build category path from category to root
  const buildCategoryPath = useCallback(async (catId: UUID): Promise<{
    path: string[];
    categoryName: string;
    areaName: string;
    areaIcon: string | null;
  }> => {
    const path: string[] = [];
    let currentId: UUID | null = catId;
    let categoryName = '';
    let areaId: UUID | null = null;

    while (currentId) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, parent_category_id, area_id')
        .eq('id', currentId)
        .single();

      if (!cat) break;

      path.unshift(cat.name);
      if (!categoryName) categoryName = cat.name;
      if (cat.area_id) areaId = cat.area_id;
      currentId = cat.parent_category_id;
    }

    // Get area info
    let areaName = '';
    let areaIcon: string | null = null;
    if (areaId) {
      const { data: area } = await supabase
        .from('areas')
        .select('name, icon')
        .eq('id', areaId)
        .single();
      
      if (area) {
        areaName = area.name;
        areaIcon = area.icon;
        path.unshift(area.name);
      }
    }

    return { path, categoryName, areaName, areaIcon };
  }, []);

  // Fetch activities
  const fetchActivities = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOffset(0);
        setActivities([]);
      }
      setError(null);

      // Determine category filter
      let categoryIds: UUID[] = [];
      
      if (categoryId) {
        categoryIds = await getDescendantCategoryIds(categoryId);
      } else if (areaId) {
        const { data: areaCats } = await supabase
          .from('categories')
          .select('id')
          .eq('area_id', areaId);
        categoryIds = (areaCats || []).map(c => c.id);
      }

      // Build query
      let query = supabase
        .from('events')
        .select('id, category_id, event_date, session_start, comment, created_at, edited_at', { count: 'exact' });

      // Apply filters
      if (categoryIds.length > 0) {
        query = query.in('category_id', categoryIds);
      }
      
      if (dateFrom) {
        query = query.gte('event_date', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('event_date', dateTo);
      }

      // Order and paginate
      const currentOffset = isLoadMore ? offset : 0;
      query = query
        .order('event_date', { ascending: false })
        .order('session_start', { ascending: false, nullsFirst: false })
        .range(currentOffset, currentOffset + pageSize - 1);

      const { data: events, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      if (count !== null) {
        setTotalCount(count);
      }

      // Check if there are more
      setHasMore((events?.length || 0) === pageSize);

      if (!events || events.length === 0) {
        if (!isLoadMore) {
          setActivities([]);
        }
        return;
      }

      // Build category paths (cache to avoid duplicate queries)
      const pathCache = new Map<UUID, Awaited<ReturnType<typeof buildCategoryPath>>>();
      
      const enrichedEvents: ActivityEvent[] = await Promise.all(
        events.map(async (event) => {
          let pathInfo = pathCache.get(event.category_id);
          if (!pathInfo) {
            pathInfo = await buildCategoryPath(event.category_id);
            pathCache.set(event.category_id, pathInfo);
          }
          
          return {
            ...event,
            category_name: pathInfo.categoryName,
            category_path: pathInfo.path,
            area_name: pathInfo.areaName,
            area_icon: pathInfo.areaIcon
          };
        })
      );

      // Group by session (category_id + session_start)
      const groupMap = new Map<string, ActivityGroup>();
      
      for (const event of enrichedEvents) {
        // Create session key - if no session_start, use event id (each event is its own group)
        const sessionKey = event.session_start 
          ? `${event.category_id}_${event.session_start}`
          : event.id;

        let group = groupMap.get(sessionKey);
        if (!group) {
          group = {
            sessionKey,
            category_id: event.category_id,
            category_name: event.category_name,
            category_path: event.category_path,
            area_name: event.area_name,
            area_icon: event.area_icon,
            event_date: event.event_date,
            session_start: event.session_start,
            events: [],
            eventCount: 0
          };
          groupMap.set(sessionKey, group);
        }
        
        group.events.push(event);
        group.eventCount++;
      }

      const newGroups = Array.from(groupMap.values());
      
      if (isLoadMore) {
        setActivities(prev => [...prev, ...newGroups]);
        setOffset(prev => prev + pageSize);
      } else {
        setActivities(newGroups);
        setOffset(pageSize);
      }

    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch activities'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [areaId, categoryId, dateFrom, dateTo, pageSize, offset, getDescendantCategoryIds, buildCategoryPath]);

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    fetchActivities(false);
  }, [areaId, categoryId, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchActivities(true);
    }
  }, [loadingMore, hasMore, fetchActivities]);

  const refresh = useCallback(async () => {
    await fetchActivities(false);
  }, [fetchActivities]);

  return {
    activities,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh
  };
}

// --------------------------------------------
// Helper functions
// --------------------------------------------

/**
 * Format time from ISO timestamp or session_start
 */
export function formatTime(isoString: string | null): string {
  if (!isoString) return '-';
  
  const date = new Date(isoString);
  return date.toLocaleTimeString('hr-HR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format date with weekday
 */
export function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('hr-HR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
