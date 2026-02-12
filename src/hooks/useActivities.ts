import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

// --------------------------------------------
// Debug Configuration
// --------------------------------------------

// Debug Configuration - set to true to enable console logging
const DEBUG_ENABLED = false;

interface DebugLogEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Global debug log (accessible via window for debugging)
const debugLog: DebugLogEntry[] = [];

function logDebug(action: string, details: Record<string, unknown>) {
  if (!DEBUG_ENABLED) return;
  
  const entry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    details
  };
  
  debugLog.push(entry);
  
  // Keep only last 100 entries
  if (debugLog.length > 100) {
    debugLog.shift();
  }
  
  // Log to console with formatting
  console.log(
    `%c[useActivities] ${action}`,
    'color: #6366f1; font-weight: bold;',
    details
  );
}

// Expose debug log to window for inspection
if (typeof window !== 'undefined') {
  (window as unknown as { __activitiesDebugLog: DebugLogEntry[] }).__activitiesDebugLog = debugLog;
}

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
  totalCount: number;        // Number of raw events (from DB count)
  activityCount: number;     // P3: Number of activity groups (for display)
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  // P4: Debug info
  debugInfo: {
    lastQuery: {
      categoryIds: UUID[];
      filters: { areaId: UUID | null; categoryId: UUID | null; dateFrom: string | null; dateTo: string | null };
      isLeaf: boolean;
    } | null;
  };
}

interface UseActivitiesOptions {
  areaId?: UUID | null;
  categoryId?: UUID | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  pageSize?: number;
}

// --------------------------------------------
// Type for Supabase responses
// --------------------------------------------

interface CategoryRow {
  id: UUID;
  name: string;
  parent_category_id: UUID | null;
  area_id: UUID | null;
}

interface AreaRow {
  name: string;
  icon: string | null;
}

interface EventRow {
  id: UUID;
  category_id: UUID;
  event_date: string;
  session_start: string | null;
  comment: string | null;
  created_at: string;
  edited_at: string;
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
  const [activityCount, setActivityCount] = useState(0); // P3: Total activity groups
  const [offset, setOffset] = useState(0);
  
  // P4: Debug info ref
  const debugInfoRef = useRef<UseActivitiesResult['debugInfo']>({
    lastQuery: null
  });

  // P4: Log when options change
  useEffect(() => {
    logDebug('OPTIONS_CHANGED', { areaId, categoryId, dateFrom, dateTo, pageSize });
  }, [areaId, categoryId, dateFrom, dateTo, pageSize]);

  // Check if category has children (not a leaf)
  const checkHasChildren = useCallback(async (catId: UUID): Promise<boolean> => {
    logDebug('CHECK_HAS_CHILDREN', { categoryId: catId });
    
    const { data, error: checkError } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_category_id', catId)
      .limit(1);
    
    const hasChildren = !checkError && (data?.length || 0) > 0;
    logDebug('CHECK_HAS_CHILDREN_RESULT', { categoryId: catId, hasChildren, childCount: data?.length || 0 });
    
    return hasChildren;
  }, []);

  // Get descendant category IDs for hierarchical filtering
  const getDescendantCategoryIds = useCallback(async (catId: UUID): Promise<UUID[]> => {
    logDebug('GET_DESCENDANTS_START', { parentId: catId });
    
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
    
    logDebug('GET_DESCENDANTS_RESULT', { parentId: catId, descendantIds: ids, count: ids.length });
    
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
    let foundAreaId: UUID | null = null;

    while (currentId) {
      const { data: cat, error: catError } = await supabase
        .from('categories')
        .select('id, name, parent_category_id, area_id')
        .eq('id', currentId)
        .single();

      if (catError || !cat) break;

      const catData = cat as CategoryRow;
      path.unshift(catData.name);
      if (!categoryName) categoryName = catData.name;
      if (catData.area_id) foundAreaId = catData.area_id;
      currentId = catData.parent_category_id;
    }

    // Get area info
    let areaName = '';
    let areaIcon: string | null = null;
    if (foundAreaId) {
      const { data: area } = await supabase
        .from('areas')
        .select('name, icon')
        .eq('id', foundAreaId)
        .single();
      
      if (area) {
        const areaData = area as AreaRow;
        areaName = areaData.name;
        areaIcon = areaData.icon;
        path.unshift(areaData.name);
      }
    }

    return { path, categoryName, areaName, areaIcon };
  }, []);

  // Fetch activities
  const fetchActivities = useCallback(async (isLoadMore = false) => {
    const fetchId = Date.now(); // Unique ID for this fetch
    logDebug('FETCH_START', { 
      fetchId,
      isLoadMore, 
      currentFilters: { areaId, categoryId, dateFrom, dateTo },
      currentOffset: offset 
    });

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
      let isLeafCategory = false;
      
      if (categoryId) {
        // Check if this category has children (is it a leaf?)
        const hasChildren = await checkHasChildren(categoryId);
        isLeafCategory = !hasChildren;
        
        logDebug('CATEGORY_TYPE_DETERMINED', { 
          fetchId,
          categoryId, 
          hasChildren, 
          isLeaf: isLeafCategory 
        });
        
        if (hasChildren) {
          // Non-leaf: get all descendants including self
          categoryIds = await getDescendantCategoryIds(categoryId);
        } else {
          // LEAF: filter ONLY by this exact category - no descendants!
          categoryIds = [categoryId];
        }
      } else if (areaId) {
        // Get all category IDs for this area
        logDebug('FETCHING_AREA_CATEGORIES', { fetchId, areaId });
        
        const { data: areaCats } = await supabase
          .from('categories')
          .select('id')
          .eq('area_id', areaId);
        categoryIds = (areaCats || []).map(c => c.id);
        
        logDebug('AREA_CATEGORIES_LOADED', { 
          fetchId, 
          areaId, 
          categoryCount: categoryIds.length 
        });
      }

      // P4: Store debug info
      debugInfoRef.current.lastQuery = {
        categoryIds,
        filters: { areaId, categoryId, dateFrom, dateTo },
        isLeaf: isLeafCategory
      };

      logDebug('BUILDING_QUERY', { 
        fetchId,
        categoryIds, 
        categoryIdCount: categoryIds.length,
        dateFrom, 
        dateTo,
        expectedFilter: categoryIds.length > 0 ? 'BY_CATEGORY_IDS' : 'ALL_EVENTS'
      });

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

      logDebug('QUERY_EXECUTED', { 
        fetchId,
        eventCount: events?.length || 0, 
        totalCount: count,
        error: fetchError?.message || null,
        firstEvent: events?.[0] ? { 
          id: events[0].id, 
          category_id: events[0].category_id 
        } : null
      });

      if (fetchError) throw fetchError;

      // Note: Removed isMounted check - it was causing issues with React StrictMode
      // React handles state updates on unmounted components gracefully now
      logDebug('QUERY_COMPLETED', { fetchId, eventCount: events?.length || 0, totalCount: count });

      if (count !== null) {
        setTotalCount(count);
      }

      // Check if there are more
      setHasMore((events?.length || 0) === pageSize);

      if (!events || events.length === 0) {
        logDebug('NO_EVENTS_FOUND', { fetchId, isLoadMore });
        if (!isLoadMore) {
          setActivities([]);
          setActivityCount(0);
        }
        return;
      }

      const eventRows = events as EventRow[];

      // P4: Verify all events match our filter
      if (categoryIds.length > 0) {
        const mismatchedEvents = eventRows.filter(e => !categoryIds.includes(e.category_id));
        if (mismatchedEvents.length > 0) {
          logDebug('⚠️ FILTER_MISMATCH_DETECTED', {
            fetchId,
            expectedCategoryIds: categoryIds,
            mismatchedEvents: mismatchedEvents.map(e => ({
              id: e.id,
              category_id: e.category_id
            }))
          });
        }
      }

      // Build category paths (cache to avoid duplicate queries)
      const pathCache = new Map<UUID, Awaited<ReturnType<typeof buildCategoryPath>>>();
      
      const enrichedEvents: ActivityEvent[] = await Promise.all(
        eventRows.map(async (event) => {
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
      
      logDebug('GROUPING_COMPLETE', { 
        fetchId,
        eventCount: enrichedEvents.length,
        groupCount: newGroups.length,
        groups: newGroups.map(g => ({
          sessionKey: g.sessionKey,
          category: g.category_name,
          path: g.category_path.join(' > '),
          eventCount: g.eventCount
        }))
      });
      
      if (isLoadMore) {
        setActivities(prev => [...prev, ...newGroups]);
        setActivityCount(prev => prev + newGroups.length);
        setOffset(prev => prev + pageSize);
      } else {
        setActivities(newGroups);
        setActivityCount(newGroups.length);
        setOffset(pageSize);
      }

      logDebug('FETCH_COMPLETE', { 
        fetchId,
        totalEvents: count,
        loadedEvents: enrichedEvents.length,
        activityGroups: newGroups.length
      });

    } catch (err) {
      console.error('Failed to fetch activities:', err);
      logDebug('FETCH_ERROR', { 
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err : new Error('Failed to fetch activities'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [areaId, categoryId, dateFrom, dateTo, pageSize, offset, checkHasChildren, getDescendantCategoryIds, buildCategoryPath]);

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    logDebug('FILTER_EFFECT_TRIGGERED', { areaId, categoryId, dateFrom, dateTo });
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
    activityCount, // P3: Number of activity groups
    loadMore,
    refresh,
    // P4: Debug info
    debugInfo: debugInfoRef.current
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
 * Format date for display (compact, single line with weekday)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const formatted = date.toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
  const weekday = date.toLocaleDateString('hr-HR', { weekday: 'short' });
  return `${formatted} ${weekday}`;
}

/**
 * Get debug log (for testing/debugging)
 */
export function getActivitiesDebugLog(): DebugLogEntry[] {
  return [...debugLog];
}

/**
 * Clear debug log
 */
export function clearActivitiesDebugLog(): void {
  debugLog.length = 0;
}
