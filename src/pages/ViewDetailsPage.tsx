/**
 * ViewDetailsPage
 *
 * Read-only prikaz aktivnosti (events grupiranih po session_start).
 *
 * Key features:
 * - Sve vrijednosti su read-only
 * - Indigo header (THEME['view'])
 * - Prev / Next navigacija prema filtriranom popisu iz FilterContext
 * - "Edit" button prelazi na EditActivityPage za isti session
 * - Leaf kategorija automatski otvorena
 * - Attr count: "(N attrs / M empty)"
 *
 * Entry: Activities table → ⋮ menu → View Details
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useCategoryChain } from '@/hooks/useCategoryChain';
import { useTouchSwipe } from '@/hooks/useTouchSwipe';
import { useAttributeDefinitions } from '@/hooks/useAttributeDefinitions';
import { useActivities, type ActivityGroup } from '@/hooks/useActivities';
import { useFilter } from '@/context/FilterContext';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/cn';
import {
  type CachedViewEvent,
  getOrFetchActivity,
  prefetchActivity,
  makeCacheKey,
} from '@/lib/activityViewCache';

import type { UUID } from '@/types';

// ============================================
// Helpers
// ============================================

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function formatTimeHM(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ============================================
// Types
// ============================================

type ViewEvent = CachedViewEvent;

// ============================================
// Read-only attribute value display
// ============================================

function AttributeValueDisplay({
  value,
  dataType,
  name,
}: {
  value: string | number | boolean | null;
  dataType: string;
  name: string;
}) {
  const t = THEME.view;

  if (value === null || value === undefined || value === '') {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-500">{name}</span>
        <span className="text-sm text-gray-300 italic">—</span>
      </div>
    );
  }

  let displayValue: string;
  if (dataType === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (dataType === 'datetime' && typeof value === 'string') {
    try {
      displayValue = new Date(value).toLocaleString('sv-SE');
    } catch {
      displayValue = String(value);
    }
  } else {
    displayValue = String(value);
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{name}</span>
      <span className={cn('text-sm font-medium', t.lightText)}>{displayValue}</span>
    </div>
  );
}

// ============================================
// Read-only attribute chain display
// ============================================

function ReadOnlyAttributeChain({
  categoryChain,
  attributesByCategory,
  attributeValues,
}: {
  categoryChain: { id: string; name: string }[];
  attributesByCategory: Map<string, { id: string; name: string; data_type: string }[]>;
  attributeValues: Map<string, { value: string | number | boolean | null; dataType: string }>;
}) {
  const t = THEME.view;

  // Display order: root → ... → leaf (same as Edit page)
  const displayOrder = [...categoryChain]
    .reverse()
    .filter((category) => {
      const isLeaf = category.id === categoryChain[0].id;
      const attrs = attributesByCategory.get(category.id) || [];
      return isLeaf || attrs.length > 0;
    });

  // State: leaf expanded by default, others collapsed
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    if (categoryChain.length > 0) {
      return new Set([categoryChain[0].id]); // leaf = first in chain
    }
    return new Set();
  });

  // Update when chain changes (e.g. loading)
  useEffect(() => {
    if (categoryChain.length > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        next.add(categoryChain[0].id);
        return next;
      });
    }
  }, [categoryChain]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  if (categoryChain.length === 0) return null;

  return (
    <div className="space-y-2">
      {displayOrder.map((category) => {
        const isLeaf = category.id === categoryChain[0].id;
        const isExpanded = expandedCategories.has(category.id);
        const attributes = attributesByCategory.get(category.id) || [];
        const emptyCount = attributes.filter(a => {
          const v = attributeValues.get(a.id)?.value;
          return v === null || v === undefined || v === '';
        }).length;

        return (
          <div
            key={category.id}
            className={`border rounded-lg overflow-hidden ${
              isLeaf ? `border-indigo-200 bg-indigo-50/30` : 'border-gray-200'
            }`}
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={cn(
                'w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors',
                isLeaf ? `${t.light} hover:bg-indigo-100` : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
                <span className={`font-medium ${isLeaf ? t.lightText : 'text-gray-700'}`}>
                  {category.name}
                </span>
                {isLeaf && (
                  <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">
                    leaf
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                <span>
                  ({attributes.length} attrs
                  {emptyCount > 0 && (
                    <span className="text-amber-600"> / {emptyCount} empty</span>
                  )})
                </span>
              </div>
            </button>

            {/* Attributes */}
            {isExpanded && (
              <div className={`px-4 py-3 border-t ${isLeaf ? 'border-indigo-100' : 'border-gray-100'}`}>
                {attributes.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No attributes defined</p>
                ) : (
                  <div>
                    {attributes.map(attr => (
                      <AttributeValueDisplay
                        key={attr.id}
                        value={attributeValues.get(attr.id)?.value ?? null}
                        dataType={attr.data_type}
                        name={attr.name}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function ViewDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionStart } = useParams<{ sessionStart: string }>();
  const [searchParams] = useSearchParams();
  const categoryIdParam = searchParams.get('categoryId') as UUID | null;
  const noSession = searchParams.get('noSession') === '1';
  const ownerIdParam = searchParams.get('userId');

  // BUG-S45-1 fix (Opcija A): use navActivities from location.state when available.
  // AppHome pre-builds this list (no date filter, 500 items) and passes it here,
  // ensuring Prev/Next uses the exact same ordered list as the table.
  // Fall back to own useActivities only for direct URL access / page refresh.
  const stateNavActivities = (location.state as { navActivities?: ActivityGroup[] } | null)?.navActivities ?? null;

  const { filter, sharedContext } = useFilter();
  const t = THEME.view;

  // DA1: Dynamički mjerimo visinu headera
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(190); // generous default to avoid overlap on first render
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ============================================
  // Load Activity Data
  // ============================================

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<UUID | null>(null);
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [sessionDateTime, setSessionDateTime] = useState<Date>(new Date());
  const [viewEvents, setViewEvents] = useState<ViewEvent[]>([]);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [isOwnEvent, setIsOwnEvent] = useState(true);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  // currentUserLabel: logged-in user's email — for "area owner" display (scenarios 1–3)
  const [currentUserLabel, setCurrentUserLabel] = useState<string | null>(null);
  // VIEW-P2: parent atributi dijeljeni za sve tabove (Activity, Gym itd.)
  const [parentAttrValues, setParentAttrValues] = useState<Map<string, { value: string | number | boolean | null; dataType: string }>>(new Map());

  useEffect(() => {
    if (!sessionStart) {
      navigate('/app', { replace: true });
      return;
    }
    loadActivityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStart, categoryIdParam, noSession, ownerIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivityData = async () => {
    if (!sessionStart) return;
    setIsLoading(true);
    setLoadError(null);
    setSelectedEventIndex(0);
    setParentAttrValues(new Map());
    setViewEvents([]);
    setIsOwnEvent(true);
    setOwnerDisplayName(null);
    setCurrentUserLabel(null);

    const decoded = noSession ? sessionStart : decodeURIComponent(sessionStart);
    const key = makeCacheKey(decoded, categoryIdParam, ownerIdParam, noSession);

    const cached = await getOrFetchActivity(key, decoded, categoryIdParam, noSession, ownerIdParam);

    if (!cached) {
      setLoadError('Activity not found');
      setIsLoading(false);
      return;
    }

    setCategoryId(cached.leafCategoryId);
    setIsOwnEvent(cached.isOwnEvent);
    setCurrentUserLabel(cached.currentUserLabel);
    setOwnerDisplayName(cached.ownerDisplayName);
    setCategoryPath(cached.categoryPath);
    setSessionDateTime(cached.sessionDateTime);
    setViewEvents(cached.viewEvents);
    setParentAttrValues(cached.parentAttrValues);
    setIsLoading(false);
  };

  // ============================================
  // Category Chain & Attributes
  // ============================================

  const { chain: categoryChain, loading: chainLoading } = useCategoryChain(categoryId);

  const chainCategoryIds = useMemo(() => categoryChain.map(c => c.id), [categoryChain]);

  const { attributesByCategory, loading: attributesLoading } = useAttributeDefinitions(chainCategoryIds);

  // Build attribute values map for current event
  const currentEvent = viewEvents[selectedEventIndex];

  const attributeValues = useMemo(() => {
    // VIEW-P2: Merge parent attrs + leaf attrs za trenutni event
    // Parent (Activity, Gym): dijeljeni, isti za sve tabove
    // Leaf (Strength): specifični za svaki tab
    const merged = new Map<string, { value: string | number | boolean | null; dataType: string }>(parentAttrValues);
    if (currentEvent) {
      currentEvent.attributes.forEach((v, k) => merged.set(k, v));
    }
    return merged;
  }, [currentEvent, parentAttrValues]);

  // ============================================
  // Prev / Next Navigation
  // ============================================

  // Load all activities (same area/category filter, NO date filter) to find neighbours.
  // Z1 fix: date filter je feature Home page tablice, ne navigacije. Ako bi Prev/Next
  // koristio dateFrom/dateTo, Edit koji promijeni datum aktivnosti izvan filtera bi
  // uzrokovao currentIndex === -1 → oba gumba disabled odmah nakon Save.
  //
  // BUG-S45-1 fix: if AppHome passed navActivities via location.state, use that list
  // directly (same instance, same order). Fall back to own fetch for direct URL access.
  const { activities: ownActivities } = useActivities({
    areaId: filter.areaId,
    categoryId: filter.categoryId,
    dateFrom: null,   // Z1: ignoriraj date filter za Prev/Next
    dateTo: null,     // Z1: ignoriraj date filter za Prev/Next
    sortOrder: filter.sortOrder,
    pageSize: 500,
    // Skip fetch when we already have the list from AppHome
    skip: stateNavActivities !== null,
  });
  const activities = stateNavActivities ?? ownActivities;

  const currentIndex = useMemo(() => {
    if (!sessionStart) return -1;
    const decoded = noSession ? sessionStart : decodeURIComponent(sessionStart);
    return activities.findIndex(g => {
      if (noSession) return g.events[0]?.id === decoded;
      // Format-agnostic comparison: Edit Save generira URL s toISOString() (.000Z),
      // ali Supabase vraća +00:00 format — isti trenutak, različit string.
      // Parsiranjem u ms izbjegavamo false mismatch nakon Edit→View navigacije.
      if (!g.session_start) return false;
      const sessionMatch = new Date(g.session_start).getTime() === new Date(decoded).getTime();
      const categoryMatch = !categoryIdParam || g.category_id === categoryIdParam;
      // ownerIdParam: u collab scenariju dva korisnika mogu imati isti session_start+category
      // (npr. nakon "Import as mine") — user_id disambiguira koji je red aktivan.
      const userMatch = !ownerIdParam || g.user_id === ownerIdParam;
      return sessionMatch && categoryMatch && userMatch;
    });
  }, [activities, sessionStart, noSession, categoryIdParam, ownerIdParam]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activities.length - 1;

  // Prefetch ±3 neighbours while user reads the current one.
  // With MAX_SIZE=7 in the cache this fills the window exactly (N-3…N+3).
  // Fires after both currentIndex and activities are resolved (list may arrive async).
  useEffect(() => {
    if (currentIndex < 0 || activities.length === 0) return;

    const prefetchGroup = (group: ActivityGroup) => {
      const isNoSession = !group.session_start;
      const ss = group.session_start ?? group.events[0]?.id;
      if (!ss) return;
      const key = makeCacheKey(ss, group.category_id, group.user_id, isNoSession);
      prefetchActivity(key, ss, group.category_id, isNoSession, group.user_id);
    };

    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue;
      const idx = currentIndex + offset;
      if (idx >= 0 && idx < activities.length) prefetchGroup(activities[idx]);
    }
  }, [currentIndex, activities]);

  // Konstruiraj sessionKey direktno iz URL params – isti format kao useActivities groupMap
  // Ne oslanjamo se na loaded activities (mogu biti još u loading stanju kad korisnik klikne X)
  const currentSessionKey = useMemo(() => {
    if (!sessionStart) return null;
    if (noSession) return sessionStart; // event.id je sessionKey za no-session slučaj
    const decoded = decodeURIComponent(sessionStart);
    // Mora matchati format useActivities groupMap: `${user_id}_${category_id}_${session_start}`
    if (ownerIdParam && categoryIdParam) return `${ownerIdParam}_${categoryIdParam}_${decoded}`;
    if (categoryIdParam) return `${categoryIdParam}_${decoded}`;
    return decoded;
  }, [sessionStart, noSession, categoryIdParam, ownerIdParam]);

  const navigateBack = useCallback(() => {
    navigate('/app', { state: { highlightKey: currentSessionKey, collapseFilter: true } });
  }, [navigate, currentSessionKey]);

  const navigateToGroup = useCallback((group: typeof activities[0]) => {
    if (!group) return;
    // Forward the same navActivities list so each step in Prev/Next keeps the same order
    const navState = { navActivities: activities };
    if (group.session_start) {
      const enc = encodeURIComponent(group.session_start);
      navigate(`/app/view/${enc}?categoryId=${group.category_id}&userId=${group.user_id}`, { state: navState });
    } else {
      const eventId = group.events[0]?.id;
      if (eventId) navigate(`/app/view/${eventId}?noSession=1&categoryId=${group.category_id}&userId=${group.user_id}`, { state: navState });
    }
  }, [navigate, activities]);

  const handlePrev = useCallback(() => {
    if (hasPrev) navigateToGroup(activities[currentIndex - 1]);
  }, [hasPrev, currentIndex, activities, navigateToGroup]);

  const handleNext = useCallback(() => {
    if (hasNext) navigateToGroup(activities[currentIndex + 1]);
  }, [hasNext, currentIndex, activities, navigateToGroup]);

  useTouchSwipe(handleNext, handlePrev);

  // ============================================
  // Navigate to Edit
  // ============================================

  const handleEdit = useCallback(() => {
    if (!sessionStart) return;
    if (noSession) {
      navigate(`/app/edit/${sessionStart}?noSession=1${categoryIdParam ? `&categoryId=${categoryIdParam}` : ''}`);
    } else {
      navigate(`/app/edit/${sessionStart}${categoryIdParam ? `?categoryId=${categoryIdParam}` : ''}`);
    }
  }, [sessionStart, noSession, categoryIdParam, navigate]);

  // ============================================
  // Duration
  // ============================================

  const totalDuration = useMemo(() => {
    if (viewEvents.length < 2) return 0;
    const first = viewEvents[0].createdAt;
    const last = viewEvents[viewEvents.length - 1].createdAt;
    return Math.floor((last.getTime() - first.getTime()) / 1000);
  }, [viewEvents]);

  // ============================================
  // Render - Loading
  // ============================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${t.spinner} mx-auto mb-4`} />
          <p className="text-gray-500">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load activity</h2>
          <p className="text-gray-500 mb-4">{loadError}</p>
          <button onClick={navigateBack} className={cn('px-4 py-2 rounded-lg text-white', t.accent)}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // BUG-D guard: loading done, no error, but no data (e.g. stale navigation after collision bypass)
  if (!isLoading && viewEvents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Activity not found</h2>
          <p className="text-gray-500 mb-4 text-sm">
            This activity may have been deleted or the session timestamp no longer matches.
          </p>
          <button onClick={navigateBack} className={cn('px-4 py-2 rounded-lg text-white', t.accent)}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // Render - Main
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 pb-4">

      {/* ── STICKY HEADER ─────────────────────────── */}
      <header ref={headerRef} className={cn('fixed top-0 left-0 right-0 z-30 shadow-md', t.headerBg)}>

        {/* Row 1: Title + Path */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <h1 className={cn('text-lg font-semibold', t.headerText)}>View Activity</h1>
            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                className={cn(
                  'px-2 py-1 rounded text-sm font-medium transition-colors',
                  hasPrev
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                )}
                title="Previous activity"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                className={cn(
                  'px-2 py-1 rounded text-sm font-medium transition-colors',
                  hasNext
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                )}
                title="Next activity"
              >
                Next ▶
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <p className={cn('text-base font-medium opacity-90', t.headerText)}>
              {categoryPath.join(' > ')}
            </p>
            {/* Ownership indicator — 3 scenarios:
                1/2  own event  → email of logged-in user
                3    foreign event (shared area, owner view) → Area: ownerEmail / Activity: foreignEmail
                grantee foreign → Activity: foreignEmail  */}
            {ownerDisplayName && (
              isOwnEvent ? (
                <p className="text-xs text-white/80 shrink-0">👤 {ownerDisplayName}</p>
              ) : (
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {/* Area owner line: logged-in user (owner view) or sharedContext owner (grantee view) */}
                  <p className="text-xs text-white/70">
                    Area: {sharedContext ? (sharedContext.ownerDisplayName || sharedContext.ownerEmail || 'Owner') : (currentUserLabel || 'You')}
                  </p>
                  <p className="text-xs text-amber-200 font-medium">Activity: {ownerDisplayName}</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Row 2: Date / Duration (read-only) */}
        <div className="px-4 py-2 bg-black/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-xs">📅</span>
              <span className={cn('font-medium text-sm tabular-nums', t.headerText)}>
                {formatDateYMD(sessionDateTime)} {formatTimeHM(sessionDateTime)}
              </span>
            </div>
            {totalDuration > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs">Duration</span>
                <span className={cn('font-mono font-semibold', t.headerText)}>
                  {formatDuration(totalDuration)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Back + Edit button */}
        <div className="px-4 py-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={navigateBack}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Back to list"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {isOwnEvent && (
            <button
              type="button"
              onClick={handleEdit}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors', t.accent)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Activity
            </button>
          )}
        </div>
      </header>

      {/* ── CONTENT ───────────────────────────────── */}
      <div
        className="max-w-2xl mx-auto px-4 pb-4"
        style={{ paddingTop: `${headerHeight + 12}px` }}
      >
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">

          {/* Session info banner */}
          <div className={cn('px-3 py-2 border-b', t.light, t.lightBorder)}>
            <span className={cn('text-sm font-medium', t.lightText)}>
              👁️ {viewEvents.length} event{viewEvents.length !== 1 ? 's' : ''} in this session
            </span>
          </div>

          {/* Event Tabs (if multiple events) */}
          {viewEvents.length > 1 && (
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b">
              {viewEvents.map((event, index) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventIndex(index)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    index === selectedEventIndex
                      ? `${t.accent} ring-0`
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  #{index + 1}
                </button>
              ))}
            </div>
          )}

          {/* Event timestamp */}
          {currentEvent && (
            <div className="px-3 pt-3 pb-1">
              <div className="text-sm text-gray-500">
                Event #{selectedEventIndex + 1} · {(() => {
                  const d = currentEvent.createdAt;
                  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                })()}
              </div>
            </div>
          )}

          {/* Attributes */}
          <div className="px-3 pb-3 pt-2">
            {(chainLoading || attributesLoading) ? (
              <div className="flex items-center justify-center py-6">
                <div className={cn('animate-spin rounded-full h-6 w-6 border-b-2', t.spinner)} />
                <span className="ml-2 text-gray-500 text-sm">Loading...</span>
              </div>
            ) : categoryId && categoryChain.length > 0 ? (
              <ReadOnlyAttributeChain
                categoryChain={categoryChain}
                attributesByCategory={attributesByCategory}
                attributeValues={attributeValues}
              />
            ) : null}
          </div>

          {/* Event Note */}
          {currentEvent?.note && (
            <div className="px-3 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Event Note
              </label>
              <div className={cn('w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700', t.light)}>
                {currentEvent.note}
              </div>
            </div>
          )}

          {/* Photos */}
          {currentEvent && currentEvent.photos.length > 0 && (
            <div className="px-3 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📷 Photos ({currentEvent.photos.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {currentEvent.photos.map(photo => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename || 'Photo'}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
