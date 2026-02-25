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
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useCategoryChain } from '@/hooks/useCategoryChain';
import { useAttributeDefinitions } from '@/hooks/useAttributeDefinitions';
import { useActivities } from '@/hooks/useActivities';
import { useFilter } from '@/context/FilterContext';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/cn';

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

interface LoadedEvent {
  id: UUID;
  category_id: UUID;
  event_date: string;
  session_start: string | null;
  comment: string | null;
  created_at: string;
  edited_at: string;
}

interface LoadedAttribute {
  id: UUID;
  attribute_definition_id: UUID;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
  attribute_definitions: {
    id: UUID;
    name: string;
    data_type: string;
    category_id: UUID;
  } | null;
}

interface LoadedAttachment {
  id: UUID;
  event_id: UUID;
  url: string;
  filename: string | null;
}

interface ViewEvent {
  id: UUID;
  categoryId: UUID;
  createdAt: Date;
  note: string | null;
  attributes: Map<string, { value: string | number | boolean | null; dataType: string }>;
  photos: { id: UUID; url: string; filename: string | null }[];
}

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
  const { sessionStart } = useParams<{ sessionStart: string }>();
  const [searchParams] = useSearchParams();
  const categoryIdParam = searchParams.get('categoryId') as UUID | null;
  const noSession = searchParams.get('noSession') === '1';

  const { filter } = useFilter();
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

  useEffect(() => {
    if (!sessionStart) {
      navigate('/app', { replace: true });
      return;
    }
    loadActivityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStart]);

  const loadActivityData = async () => {
    if (!sessionStart) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let events: LoadedEvent[];

      if (noSession) {
        const { data, error } = await supabase
          .from('events')
          .select('id, category_id, event_date, session_start, comment, created_at, edited_at')
          .eq('id', sessionStart)
          .eq('user_id', user.id);
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Activity not found');
        events = data as LoadedEvent[];
      } else {
        const decoded = decodeURIComponent(sessionStart);
        let query = supabase
          .from('events')
          .select('id, category_id, event_date, session_start, comment, created_at, edited_at')
          .eq('session_start', decoded)
          .eq('user_id', user.id);
        if (categoryIdParam) {
          query = query.eq('category_id', categoryIdParam);
        }
        const { data, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Activity not found');
        events = data as LoadedEvent[];
      }

      const leafCategoryId = events[events.length - 1].category_id;
      setCategoryId(leafCategoryId);

      // Build category path
      const path = await buildCategoryPath(leafCategoryId);
      setCategoryPath(path);

      // Set session datetime
      const sessionDate = noSession
        ? new Date(events[0].created_at)
        : new Date(decodeURIComponent(sessionStart));
      setSessionDateTime(sessionDate);

      // Fetch attributes & attachments for each event
      const loadedEvents: ViewEvent[] = [];

      for (const event of events) {
        const { data: attrs } = await supabase
          .from('event_attributes')
          .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
          .eq('event_id', event.id);

        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('id, event_id, url, filename')
          .eq('event_id', event.id)
          .eq('type', 'image');

        const loadedAttrs = (attrs || []) as unknown as LoadedAttribute[];
        const loadedAttachments = (attachments || []) as LoadedAttachment[];

        const attrMap = new Map<string, { value: string | number | boolean | null; dataType: string }>();
        for (const attr of loadedAttrs) {
          if (!attr.attribute_definitions) continue;
          const dataType = attr.attribute_definitions.data_type;
          let value: string | number | boolean | null = null;
          if (dataType === 'number' && attr.value_number !== null) value = attr.value_number;
          else if (dataType === 'boolean' && attr.value_boolean !== null) value = attr.value_boolean;
          else if (dataType === 'datetime' && attr.value_datetime !== null) value = attr.value_datetime;
          else if (attr.value_text !== null) value = attr.value_text;

          attrMap.set(attr.attribute_definition_id, { value, dataType });
        }

        loadedEvents.push({
          id: event.id,
          categoryId: event.category_id,
          createdAt: new Date(event.created_at),
          note: event.comment,
          attributes: attrMap,
          photos: loadedAttachments.map(a => ({ id: a.id, url: a.url, filename: a.filename })),
        });
      }

      setViewEvents(loadedEvents);

    } catch (err) {
      console.error('Failed to load activity:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  };

  const buildCategoryPath = async (catId: UUID): Promise<string[]> => {
    const path: string[] = [];
    let currentId: UUID | null = catId;
    let areaId: UUID | null = null;

    while (currentId) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id, name, parent_category_id, area_id')
        .eq('id', currentId)
        .single() as { data: { id: string; name: string; parent_category_id: string | null; area_id: string | null } | null };

      if (!cat) break;
      path.unshift(cat.name);
      if (cat.area_id) areaId = cat.area_id;
      currentId = cat.parent_category_id;
    }

    if (areaId) {
      const { data: area } = await supabase.from('areas').select('name').eq('id', areaId).single();
      if (area) path.unshift(area.name);
    }

    return path;
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
    if (!currentEvent) return new Map<string, { value: string | number | boolean | null; dataType: string }>();
    // Re-key by attribute_definition_id (already the key in currentEvent.attributes)
    return currentEvent.attributes;
  }, [currentEvent]);

  // ============================================
  // Prev / Next Navigation
  // ============================================

  // Load all activities (same filter) to find neighbours
  const { activities } = useActivities({
    areaId: filter.areaId,
    categoryId: filter.categoryId,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    pageSize: 500, // large enough for nav; TODO: could use cursor
  });

  const currentIndex = useMemo(() => {
    if (!sessionStart) return -1;
    const decoded = noSession ? sessionStart : decodeURIComponent(sessionStart);
    return activities.findIndex(g => {
      if (noSession) return g.events[0]?.id === decoded;
      return g.session_start === decoded && (!categoryIdParam || g.category_id === categoryIdParam);
    });
  }, [activities, sessionStart, noSession, categoryIdParam]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activities.length - 1;

  // Konstruiraj sessionKey direktno iz URL params – isti format kao useActivities groupMap
  // Ne oslanjamo se na loaded activities (mogu biti još u loading stanju kad korisnik klikne X)
  const currentSessionKey = useMemo(() => {
    if (!sessionStart) return null;
    if (noSession) return sessionStart; // event.id je sessionKey za no-session slučaj
    const decoded = decodeURIComponent(sessionStart);
    return categoryIdParam ? `${categoryIdParam}_${decoded}` : decoded;
  }, [sessionStart, noSession, categoryIdParam]);

  const navigateBack = useCallback(() => {
    navigate('/app', { state: { highlightKey: currentSessionKey } });
  }, [navigate, currentSessionKey]);

  const navigateToGroup = useCallback((group: typeof activities[0]) => {
    if (!group) return;
    if (group.session_start) {
      const enc = encodeURIComponent(group.session_start);
      navigate(`/app/view/${enc}?categoryId=${group.category_id}`);
    } else {
      const eventId = group.events[0]?.id;
      if (eventId) navigate(`/app/view/${eventId}?noSession=1&categoryId=${group.category_id}`);
    }
  }, [navigate]);

  const handlePrev = useCallback(() => {
    if (hasPrev) navigateToGroup(activities[currentIndex - 1]);
  }, [hasPrev, currentIndex, activities, navigateToGroup]);

  const handleNext = useCallback(() => {
    if (hasNext) navigateToGroup(activities[currentIndex + 1]);
  }, [hasNext, currentIndex, activities, navigateToGroup]);

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
          <p className={cn('text-base font-medium mt-1 opacity-90', t.headerText)}>
            {categoryPath.join(' > ')}
          </p>
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
                  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
