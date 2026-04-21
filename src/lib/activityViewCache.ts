/**
 * activityViewCache.ts
 *
 * Module-level LRU cache for ViewDetailsPage data.
 * Allows prefetching adjacent activities (Prev/Next) while user reads the current one.
 *
 * Cache key is timestamp-normalised so +00:00 and .000Z formats map to the same entry.
 * Max 7 entries (current ±3) — evicts oldest on overflow.
 */

import { supabase } from '@/lib/supabaseClient';
import { loadParentAttrs } from '@/lib/parentEventLoader';
import type { UUID } from '@/types';

// ---- Public types ----

export interface CachedViewEvent {
  id: UUID;
  categoryId: UUID;
  createdAt: Date;
  note: string | null;
  attributes: Map<string, { value: string | number | boolean | null; dataType: string }>;
  photos: { id: UUID; url: string; filename: string | null }[];
}

export interface CachedActivityData {
  viewEvents: CachedViewEvent[];
  categoryPath: string[];
  sessionDateTime: Date;
  isOwnEvent: boolean;
  ownerDisplayName: string | null;
  currentUserLabel: string | null;
  parentAttrValues: Map<string, { value: string | number | boolean | null; dataType: string }>;
  leafCategoryId: UUID;
  categoryChain: { id: UUID; name: string }[];
  attributesByCategory: Map<string, { id: UUID; name: string; data_type: string }[]>;
}

// ---- Internal DB types ----

interface DbEvent {
  id: UUID;
  category_id: UUID;
  event_date: string;
  session_start: string | null;
  comment: string | null;
  created_at: string;
  edited_at: string;
  user_id: string;
}

interface DbAttribute {
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

interface DbAttachment {
  id: UUID;
  event_id: UUID;
  url: string;
  filename: string | null;
}

// ---- LRU cache ----

const MAX_SIZE = 7;
const _cache = new Map<string, Promise<CachedActivityData | null>>();
const _order: string[] = [];

function evict(): void {
  while (_order.length >= MAX_SIZE) {
    const key = _order.shift()!;
    _cache.delete(key);
  }
}

/**
 * Build a normalised cache key.
 * For session-based entries, converts session_start to ms to unify +00:00 vs .000Z formats.
 */
export function makeCacheKey(
  sessionStart: string,
  categoryId: string | null,
  userId: string | null,
  noSession: boolean,
): string {
  if (noSession) {
    return `ns|${sessionStart}|${categoryId ?? ''}|${userId ?? ''}`;
  }
  const ms = new Date(sessionStart).getTime();
  return `ss|${ms}|${categoryId ?? ''}|${userId ?? ''}`;
}

/** Get cached data, or fetch and store. Returns null on error/not-found. */
export async function getOrFetchActivity(
  key: string,
  sessionStart: string,
  categoryIdParam: string | null,
  noSession: boolean,
  ownerIdParam: string | null,
): Promise<CachedActivityData | null> {
  if (!_cache.has(key)) {
    evict();
    _order.push(key);
    _cache.set(key, _fetchActivityData(sessionStart, categoryIdParam, noSession, ownerIdParam));
  }
  return _cache.get(key)!;
}

/** Fire-and-forget prefetch. Silently ignores errors. */
export function prefetchActivity(
  key: string,
  sessionStart: string,
  categoryIdParam: string | null,
  noSession: boolean,
  ownerIdParam: string | null,
): void {
  if (_cache.has(key)) return;
  evict();
  _order.push(key);
  _cache.set(
    key,
    _fetchActivityData(sessionStart, categoryIdParam, noSession, ownerIdParam).catch(() => null),
  );
}

/** Remove a specific entry (e.g. after Edit saves new data). */
export function invalidateCacheKey(key: string): void {
  _cache.delete(key);
  const idx = _order.indexOf(key);
  if (idx >= 0) _order.splice(idx, 1);
}

// ---- Fetch logic ----

async function _buildCategoryChain(leafCatId: UUID): Promise<{
  chain: { id: UUID; name: string }[];
  path: string[];
  attributesByCategory: Map<string, { id: UUID; name: string; data_type: string }[]>;
}> {
  // Fetch all categories in one query, walk up from leaf
  const { data: allCats } = await supabase
    .from('categories')
    .select('id, name, parent_category_id, area_id')
    .order('level', { ascending: false }) as {
      data: { id: string; name: string; parent_category_id: string | null; area_id: string | null }[] | null;
    };

  const catMap = new Map((allCats ?? []).map(c => [c.id, c]));
  const chain: { id: UUID; name: string }[] = [];
  let currentId: UUID | null = leafCatId;
  let areaId: UUID | null = null;

  while (currentId) {
    const cat = catMap.get(currentId);
    if (!cat) break;
    chain.push({ id: cat.id as UUID, name: cat.name });
    if (cat.area_id) areaId = cat.area_id as UUID;
    currentId = cat.parent_category_id as UUID | null;
  }

  // Build display path (root → leaf, with area prefix)
  const path: string[] = [...chain].reverse().map(c => c.name);
  if (areaId) {
    const { data: area } = await supabase.from('areas').select('name').eq('id', areaId).single();
    if (area) path.unshift((area as { name: string }).name);
  }

  // Fetch attr defs for all chain categories in one query
  const chainIds = chain.map(c => c.id);
  const { data: attrDefs } = await supabase
    .from('attribute_definitions')
    .select('id, name, data_type, category_id')
    .in('category_id', chainIds)
    .order('sort_order', { ascending: true }) as {
      data: { id: string; name: string; data_type: string; category_id: string }[] | null;
    };

  const attributesByCategory = new Map<string, { id: UUID; name: string; data_type: string }[]>();
  for (const attr of attrDefs ?? []) {
    const existing = attributesByCategory.get(attr.category_id) ?? [];
    existing.push({ id: attr.id as UUID, name: attr.name, data_type: attr.data_type });
    attributesByCategory.set(attr.category_id, existing);
  }

  return { chain, path, attributesByCategory };
}

async function _fetchActivityData(
  sessionStart: string,    // decoded (or event UUID for noSession)
  categoryIdParam: string | null,
  noSession: boolean,
  ownerIdParam: string | null,
): Promise<CachedActivityData | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let events: DbEvent[];

    if (noSession) {
      const { data, error } = await supabase
        .from('events')
        .select('id, category_id, event_date, session_start, comment, created_at, edited_at, user_id')
        .eq('id', sessionStart);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      events = data as DbEvent[];
    } else {
      let query = supabase
        .from('events')
        .select('id, category_id, event_date, session_start, comment, created_at, edited_at, user_id')
        .eq('session_start', sessionStart);
      if (categoryIdParam) query = query.eq('category_id', categoryIdParam);
      if (ownerIdParam) query = query.eq('user_id', ownerIdParam);
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      events = data as DbEvent[];
    }

    const leafCategoryId = events[events.length - 1].category_id;
    const isOwnEvent = events[0].user_id === user.id;

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', user.id)
      .single();
    const myLabel =
      (myProfile as { display_name?: string | null; email?: string } | null)?.display_name ||
      (myProfile as { display_name?: string | null; email?: string } | null)?.email ||
      user.email ||
      user.id;

    let ownerDisplayName: string | null;
    if (!isOwnEvent) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', events[0].user_id)
        .single();
      ownerDisplayName =
        (profile as { display_name?: string | null; email?: string } | null)?.display_name ||
        (profile as { display_name?: string | null; email?: string } | null)?.email ||
        events[0].user_id;
    } else {
      ownerDisplayName = myLabel;
    }

    const { chain: categoryChain, path: categoryPath, attributesByCategory } = await _buildCategoryChain(leafCategoryId);
    const sessionDateTime = noSession
      ? new Date(events[0].created_at)
      : new Date(sessionStart);

    const viewEvents: CachedViewEvent[] = [];
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

      const loadedAttrs = (attrs || []) as unknown as DbAttribute[];
      const loadedAttachments = (attachments || []) as DbAttachment[];

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

      viewEvents.push({
        id: event.id,
        categoryId: event.category_id,
        createdAt: new Date(event.created_at),
        note: event.comment,
        attributes: attrMap,
        photos: loadedAttachments.map(a => ({ id: a.id, url: a.url, filename: a.filename })),
      });
    }

    let parentAttrValues = new Map<string, { value: string | number | boolean | null; dataType: string }>();
    if (!noSession && events[0]?.session_start) {
      parentAttrValues = await loadParentAttrs(
        leafCategoryId,
        events[0].session_start,   // DB format — guarantees reliable match
        events[0].user_id,
      );
    }

    return {
      viewEvents,
      categoryPath,
      sessionDateTime,
      isOwnEvent,
      ownerDisplayName,
      currentUserLabel: myLabel,
      parentAttrValues,
      leafCategoryId,
      categoryChain,
      attributesByCategory,
    };
  } catch (err) {
    console.error('[activityViewCache] fetch error:', err);
    return null;
  }
}
