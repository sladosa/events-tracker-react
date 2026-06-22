import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';
import { resolveLeafCategoryIds, applyEventFilters, attrFilterJoinClause } from '@/lib/eventQueryBuilder';

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
  user_id: string;
  // Joined data
  category_name: string;
  category_path: string[];   // ['Fitness', 'Activity', 'Gym', 'Strength']
  area_id: UUID;
  area_name: string;
  area_icon: string | null;
}

export interface ActivityGroup {
  sessionKey: string;        // category_id + session_start (or event_id if no session)
  category_id: UUID;
  category_name: string;
  category_path: string[];
  area_id: UUID;
  area_name: string;
  area_icon: string | null;
  event_date: string;
  session_start: string | null;
  events: ActivityEvent[];
  eventCount: number;
  has_photos: boolean;       // 1.4.3: true if any event in this group has attachments
  user_id: string;           // Owner of this session
  user_display_name: string; // display_name ili email iz profiles
  user_email: string;        // raw email (za Re-invite pre-fill)
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
  sortOrder?: 'desc' | 'asc';   // D3: newest first (default) or oldest first
  commentSearch?: string;
  attrFilter?: { attrDefId: string; value: string; isExact: boolean } | null;
  pageSize?: number;
  skip?: boolean;               // When true, skip fetch (e.g. caller already has list from location.state)
}

// --------------------------------------------
// Type for Supabase responses
// --------------------------------------------

interface EventRow {
  id: UUID;
  category_id: UUID;
  event_date: string;
  session_start: string | null;
  comment: string | null;
  created_at: string;
  edited_at: string;
  user_id: string;
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
    sortOrder = 'desc',
    commentSearch = '',
    attrFilter = null,
    pageSize = 20,
    skip = false,
  } = options;

  const [activities, setActivities] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(!skip); // skip=true → no fetch → not loading
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

  // Race condition fix: track the latest fetch so older async results don't overwrite newer ones
  const latestFetchIdRef = useRef<number>(0);

  // P4: Log when options change
  useEffect(() => {
    logDebug('OPTIONS_CHANGED', { areaId, categoryId, dateFrom, dateTo, pageSize });
  }, [areaId, categoryId, dateFrom, dateTo, sortOrder, pageSize]);

  // Fetch activities
  const fetchActivities = useCallback(async (isLoadMore = false) => {
    const fetchId = Date.now(); // Unique ID for this fetch
    // Register as latest fetch - any older fetch that resolves later will be ignored
    latestFetchIdRef.current = fetchId;
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

      // Determine category filter (shared helper — leaf only for Activities table)
      const resolved = await resolveLeafCategoryIds(areaId, categoryId);
      const categoryIds = resolved.categoryIds;
      const isLeafCategory = resolved.isLeafCategory;

      logDebug('CATEGORIES_RESOLVED', {
        fetchId, areaId, categoryId,
        categoryIdCount: categoryIds.length,
        isLeaf: isLeafCategory,
      });

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

      // Build query — shared filter helper applies WHERE clause
      const baseSelectCols = 'id, category_id, event_date, session_start, comment, created_at, edited_at, user_id';
      const joinSuffix = attrFilterJoinClause(attrFilter, true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('events')
        .select(baseSelectCols + joinSuffix, { count: 'exact' });

      query = applyEventFilters(query, { categoryIds, dateFrom, dateTo, commentSearch, attrFilter });

      // Order and paginate
      const currentOffset = isLoadMore ? offset : 0;
      query = query
        .order('event_date', { ascending: sortOrder === 'asc' })
        .order('session_start', { ascending: sortOrder === 'asc', nullsFirst: false })
        .order('user_id',      { ascending: true })   // tie-breaker: isti session_start + diff user → deterministički
        .order('category_id', { ascending: true })    // tie-breaker za parent evente iste sesije
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

      // Stale fetch guard: if a newer fetch has started, discard these results
      if (fetchId !== latestFetchIdRef.current) {
        logDebug('STALE_FETCH_DISCARDED', { fetchId, latestFetchId: latestFetchIdRef.current });
        return;
      }

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

      // Batch fetch all category paths in one query via category_full_paths view
      // (replaces the old N+1 buildCategoryPath loop)
      const uniqueCatIds = [...new Set(eventRows.map(e => e.category_id))];
      const { data: pathRows } = await supabase
        .from('category_full_paths')
        .select('category_id, category_name, area_id, area_name, area_icon, full_path')
        .in('category_id', uniqueCatIds);

      const pathMap = new Map<UUID, { path: string[]; categoryName: string; areaId: UUID; areaName: string; areaIcon: string | null }>();
      for (const row of pathRows ?? []) {
        pathMap.set(row.category_id as UUID, {
          path: (row.full_path as string[]) ?? [],
          categoryName: (row.category_name as string) ?? '',
          areaId: (row.area_id as UUID) ?? ('' as UUID),
          areaName: (row.area_name as string) ?? '',
          areaIcon: row.area_icon as string | null,
        });
      }

      const enrichedEvents: ActivityEvent[] = eventRows.map(event => {
        const pathInfo = pathMap.get(event.category_id) ?? {
          path: [], categoryName: '', areaId: '' as UUID, areaName: '', areaIcon: null,
        };
        return {
          ...event,
          category_name: pathInfo.categoryName,
          category_path: pathInfo.path,
          area_id: pathInfo.areaId,
          area_name: pathInfo.areaName,
          area_icon: pathInfo.areaIcon,
        };
      });

      // Group by session (user_id + category_id + session_start)
      // user_id is included so that two users' events at the same session_start
      // (e.g. after "Import as mine") appear as separate rows in shared view.
      const groupMap = new Map<string, ActivityGroup>();

      for (const event of enrichedEvents) {
        // Create session key - if no session_start, use event id (each event is its own group)
        const sessionKey = event.session_start
          ? `${event.user_id}_${event.category_id}_${event.session_start}`
          : event.id;

        let group = groupMap.get(sessionKey);
        if (!group) {
          group = {
            sessionKey,
            category_id: event.category_id,
            category_name: event.category_name,
            category_path: event.category_path,
            area_id: event.area_id,
            area_name: event.area_name,
            area_icon: event.area_icon,
            event_date: event.event_date,
            session_start: event.session_start,
            events: [],
            eventCount: 0,
            has_photos: false,
            user_id: event.user_id,
            user_display_name: '',
            user_email: '',
          };
          groupMap.set(sessionKey, group);
        }
        
        group.events.push(event);
        group.eventCount++;
      }

      // 1.4.3: Batch query for photo indicators – single query for all events on this page
      const allEventIds = enrichedEvents.map(e => e.id);
      if (allEventIds.length > 0) {
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('event_id')
          .in('event_id', allEventIds)
          .eq('type', 'image');

        if (attachments && attachments.length > 0) {
          const eventIdsWithPhotos = new Set(
            (attachments as { event_id: string }[]).map(a => a.event_id)
          );
          for (const group of groupMap.values()) {
            if (group.events.some(e => eventIdsWithPhotos.has(e.id))) {
              group.has_photos = true;
            }
          }
        }
      }

      // Batch fetch display names + emails for unique user_ids
      const uniqueUserIds = [...new Set(Array.from(groupMap.values()).map(g => g.user_id))];
      if (uniqueUserIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, email, display_name')
          .in('id', uniqueUserIds);
        const displayMap = new Map(
          (profileRows ?? []).map(p => [
            p.id as string,
            ((p as { display_name?: string | null }).display_name || (p as { email?: string }).email || '') as string,
          ])
        );
        const emailMap = new Map(
          (profileRows ?? []).map(p => [p.id as string, (p as { email?: string }).email ?? ''])
        );
        for (const group of groupMap.values()) {
          group.user_display_name = displayMap.get(group.user_id) ?? group.user_id;
          group.user_email = emailMap.get(group.user_id) ?? '';
        }
      }

      // Explicit sort for deterministic order — DB query has no stable tie-breaker
      // for groups with same (event_date, session_start). Without this, AppHome and
      // ViewDetailsPage (separate useActivities calls) may return different orderings,
      // causing Prev/Next to skip or repeat groups.
      const sortMult = sortOrder === 'asc' ? 1 : -1;
      const newGroups = Array.from(groupMap.values()).sort((a, b) => {
        const dateCmp = a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
        if (dateCmp !== 0) return dateCmp * sortMult;
        const ssCmp = (a.session_start ?? '') < (b.session_start ?? '') ? -1
                    : (a.session_start ?? '') > (b.session_start ?? '') ? 1 : 0;
        if (ssCmp !== 0) return ssCmp * sortMult;
        // Tie-breaker: user_id alphabetically (deterministic, consistent across calls)
        return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
      });
      
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

      // Second stale check after async path-building (most likely place for race condition)
      if (fetchId !== latestFetchIdRef.current) {
        logDebug('STALE_FETCH_DISCARDED_POST_GROUPING', { fetchId, latestFetchId: latestFetchIdRef.current });
        return;
      }
      
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
      const pgErr = err as { message?: string; code?: string; details?: string; hint?: string };
      console.error('Failed to fetch activities:', pgErr?.code, pgErr?.message, pgErr?.details);
      logDebug('FETCH_ERROR', {
        error: pgErr?.message ?? (err instanceof Error ? err.message : 'Unknown error'),
        code: pgErr?.code,
        details: pgErr?.details,
      });
      const errMsg = pgErr?.message ?? (err instanceof Error ? err.message : 'Failed to fetch activities');
      setError(new Error(errMsg));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [areaId, categoryId, dateFrom, dateTo, sortOrder, commentSearch, attrFilter?.attrDefId, attrFilter?.value, attrFilter?.isExact, pageSize, offset]);

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    if (skip) return; // BUG-S45-1: skip fetch when caller already has the list
    logDebug('FILTER_EFFECT_TRIGGERED', { areaId, categoryId, dateFrom, dateTo });
    fetchActivities(false);
  }, [areaId, categoryId, dateFrom, dateTo, sortOrder, commentSearch, attrFilter?.attrDefId, attrFilter?.value, skip]); // eslint-disable-line react-hooks/exhaustive-deps

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
 * Format date for display: YYYY/MM/DD dan (P2.2)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const weekday = date.toLocaleDateString('hr-HR', { weekday: 'short' });
  return `${y}/${m}/${d} ${weekday}`;
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
