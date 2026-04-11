/**
 * Events Tracker – Excel Data Loader
 * ====================================
 * Supabase queries for Excel export/import.
 * Mirrors Python data loading helpers from excel_events_io.py V2.5.8
 */

import { supabase } from '@/lib/supabaseClient';
import type { Area, Category, AttributeDefinition } from '@/types/database';
import type { StructureNode } from '@/types/structure';
import type {
  ExportCategoriesDict,
  ExportCategoryInfo,
  ExportAttrDef,
  ExportEvent,
  ExportFilters,
} from './excelTypes';

// ─────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────

export async function loadCategoriesForExport(_userId: string): Promise<ExportCategoriesDict> {
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, sort_order')
    .order('sort_order');

  const areasMap = new Map<string, string>((areas ?? []).map(a => [a.id, a.name]));

  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, parent_category_id, area_id, level, sort_order')
    .order('level')
    .order('sort_order');

  if (!cats || cats.length === 0) return {};

  const catById = new Map<string, typeof cats[0]>(cats.map(c => [c.id, c]));

  const result: ExportCategoriesDict = {};

  for (const cat of cats) {
    // Build full path by walking up parent chain
    const parts: string[] = [];
    let cur: typeof cats[0] | undefined = cat;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parent_category_id ? catById.get(cur.parent_category_id) : undefined;
    }

    const areaName = cat.area_id ? (areasMap.get(cat.area_id) ?? 'Unknown') : 'Unknown';

    result[cat.id] = {
      id:                 cat.id,
      name:               cat.name,
      full_path:          parts.join(' > '),
      area_id:            cat.area_id,
      area_name:          areaName,
      level:              cat.level ?? 1,
      parent_category_id: cat.parent_category_id ?? null,
      sort_order:         cat.sort_order ?? 0,
    } satisfies ExportCategoryInfo;
  }

  return result;
}

/** Get all descendant category IDs (including self) */
export function getAllDescendants(
  categoriesDict: ExportCategoriesDict,
  parentIds: string[],
): string[] {
  const result = new Set<string>(parentIds);
  const queue  = [...parentIds];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const [catId, cat] of Object.entries(categoriesDict)) {
      if (cat.parent_category_id === currentId && !result.has(catId)) {
        result.add(catId);
        queue.push(catId);
      }
    }
  }

  return Array.from(result);
}

/** Get category IDs including all ancestors (for attribute loading) */
function getCategoryIdsWithParents(
  categoriesDict: ExportCategoriesDict,
  categoryIds: string[],
): string[] {
  const result = new Set<string>(categoryIds);

  for (const catId of categoryIds) {
    let cur = categoriesDict[catId];
    while (cur?.parent_category_id) {
      result.add(cur.parent_category_id);
      cur = categoriesDict[cur.parent_category_id];
    }
  }

  return Array.from(result);
}

// ─────────────────────────────────────────────
// Attribute definitions
// ─────────────────────────────────────────────

export async function loadAttrDefsForCategories(
  _userId:        string,
  categoryIds:    string[],
  categoriesDict: ExportCategoriesDict,
): Promise<ExportAttrDef[]> {
  if (categoryIds.length === 0) return [];

  // Include parent categories so we get inherited attributes
  const allCatIds = getCategoryIdsWithParents(categoriesDict, categoryIds);

  const { data: attrs } = await supabase
    .from('attribute_definitions')
    .select('id, category_id, name, data_type, unit, is_required, default_value, validation_rules, sort_order')
    .in('category_id', allCatIds);

  if (!attrs || attrs.length === 0) return [];

  // Sort hierarchically: build sort path per category, then by sort_order within category
  const catSortPath = (catId: string): string => {
    const parts: string[] = [];
    let cur = categoriesDict[catId];
    while (cur) {
      parts.unshift(cur.sort_order.toString().padStart(4, '0'));
      cur = cur.parent_category_id ? categoriesDict[cur.parent_category_id] : undefined!;
    }
    return parts.join('/');
  };

  attrs.sort((a, b) => {
    const pathA = catSortPath(a.category_id);
    const pathB = catSortPath(b.category_id);
    if (pathA !== pathB) return pathA.localeCompare(pathB);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  return attrs as ExportAttrDef[];
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

/** Count events matching filters (cheap COUNT query for pagination UI) */
export async function countEventsForExport(
  _userId:  string,
  filters: ExportFilters,
  categoryIds: string[],
): Promise<number> {
  let query = supabase
    .from('events')
    .select('id', { count: 'exact', head: true });

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (filters.dateFrom) query = query.gte('event_date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('event_date', filters.dateTo);

  const { count } = await query;
  return count ?? 0;
}

/** Load a page of events with their attributes and user emails */
export async function loadEventsForExport(
  _userId:     string,
  filters:     ExportFilters,
  categoryIds: string[],
  offset:      number = 0,
  limit:       number = 10000,
): Promise<ExportEvent[]> {
  const desc = filters.sortOrder === 'desc';

  // RLS handles access control — no .eq('user_id') needed
  let query = supabase
    .from('events')
    .select(`id,user_id,category_id,event_date,session_start,comment,created_at,event_attributes(id,attribute_definition_id,value_text,value_number,value_datetime,value_boolean)`);

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (filters.dateFrom) query = query.gte('event_date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('event_date', filters.dateTo);

  query = query
    .order('event_date',    { ascending: !desc })
    .order('session_start', { ascending: !desc, nullsFirst: false })
    .order('user_id',       { ascending: true })   // tie-breaker: isti sort kao useActivities
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  const rawEvents = (data ?? []) as Array<Record<string, unknown>>;

  // Batch-lookup emails from profiles
  const userIds = [...new Set(rawEvents.map(e => e.user_id as string).filter(Boolean))];
  let emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);
    emailMap = new Map((profiles ?? []).map(p => [p.id as string, p.email as string]));
  }

  return rawEvents.map(e => ({
    ...e,
    user_email: emailMap.get(e.user_id as string) ?? '',
  })) as unknown as ExportEvent[];
}

// ─────────────────────────────────────────────
// Effective category IDs from filter state
// ─────────────────────────────────────────────

export async function resolveExportCategoryIds(
  _userId:        string,
  filters:        ExportFilters,
  categoriesDict: ExportCategoriesDict,
): Promise<string[]> {
  if (filters.categoryId) {
    // Specific category selected → expand to all descendants
    return getAllDescendants(categoriesDict, [filters.categoryId]);
  }

  if (filters.areaId) {
    // Area selected → all categories in area + descendants
    const areaCats = Object.values(categoriesDict)
      .filter(c => c.area_id === filters.areaId)
      .map(c => c.id);
    return areaCats;
  }

  // No filter → all categories
  return Object.keys(categoriesDict);
}

// ─────────────────────────────────────────────
// Structure nodes loader (for unified workbook)
// ─────────────────────────────────────────────

/**
 * Load all StructureNode[] for a user — same data as useStructureData hook,
 * but as a plain async function (no React, no event counts).
 * Used by ExcelExportModal to include Structure + HelpStructure sheets.
 */
export async function loadStructureNodes(_userId: string): Promise<StructureNode[]> {
  const [{ data: areasRaw }, { data: catsRaw }, { data: attrsRaw }] = await Promise.all([
    supabase.from('areas').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('attribute_definitions').select('*').order('sort_order'),
  ]);

  const areas      = (areasRaw  ?? []) as Area[];
  const categories = (catsRaw   ?? []) as Category[];
  const attrDefs   = (attrsRaw  ?? []) as AttributeDefinition[];

  // Build lookup maps
  const attrsByCategory = new Map<string, AttributeDefinition[]>();
  for (const def of attrDefs) {
    if (!def.category_id) continue;
    const list = attrsByCategory.get(def.category_id) ?? [];
    list.push(def);
    attrsByCategory.set(def.category_id, list);
  }

  const catsByParent = new Map<string | null, Category[]>();
  for (const cat of categories) {
    const key = cat.parent_category_id ?? null;
    const list = catsByParent.get(key) ?? [];
    list.push(cat);
    catsByParent.set(key, list);
  }

  const parentCategoryIds = new Set<string>();
  for (const cat of categories) {
    if (cat.parent_category_id) parentCategoryIds.add(cat.parent_category_id);
  }

  const result: StructureNode[] = [];

  for (const area of areas) {
    result.push({
      id: area.id,
      nodeType: 'area',
      name: area.name,
      fullPath: area.name,
      level: 0,
      isLeaf: false,
      description: area.description,
      sortOrder: area.sort_order,
      areaId: area.id,
      parentCategoryId: null,
      attributeDefinitions: [],
      attrCount: 0,
      eventCount: 0,
      area,
      category: null,
    });

    const l1Cats = (catsByParent.get(null) ?? [])
      .filter(c => c.area_id === area.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const l1 of l1Cats) {
      _addCategorySubtree(l1, area, [area.name], 1, result, catsByParent, parentCategoryIds, attrsByCategory);
    }
  }

  return result;
}

function _addCategorySubtree(
  cat: Category,
  area: Area,
  ancestorNames: string[],
  level: number,
  result: StructureNode[],
  catsByParent: Map<string | null, Category[]>,
  parentCategoryIds: Set<string>,
  attrsByCategory: Map<string, AttributeDefinition[]>,
): void {
  const pathNames = [...ancestorNames, cat.name];
  const attrs = attrsByCategory.get(cat.id) ?? [];

  result.push({
    id: cat.id,
    nodeType: 'category',
    name: cat.name,
    fullPath: pathNames.join(' > '),
    level,
    isLeaf: !parentCategoryIds.has(cat.id),
    description: cat.description,
    sortOrder: cat.sort_order,
    areaId: cat.area_id ?? area.id,
    parentCategoryId: cat.parent_category_id,
    attributeDefinitions: attrs,
    attrCount: attrs.length,
    eventCount: 0,
    area,
    category: cat,
  });

  const children = (catsByParent.get(cat.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
  for (const child of children) {
    _addCategorySubtree(child, area, pathNames, level + 1, result, catsByParent, parentCategoryIds, attrsByCategory);
  }
}

// ─────────────────────────────────────────────
// All-in-one high-level export loader
// ─────────────────────────────────────────────

export interface ExportDataBundle {
  events:         ExportEvent[];
  attrDefs:       ExportAttrDef[];
  categoriesDict: ExportCategoriesDict;
  totalCount:     number;
  categoryIds:    string[];
}

export async function loadExportData(
  userId:  string,
  filters: ExportFilters,
  offset:  number = 0,
  limit:   number = 10000,
): Promise<ExportDataBundle> {
  const categoriesDict = await loadCategoriesForExport(userId);
  const categoryIds    = await resolveExportCategoryIds(userId, filters, categoriesDict);
  const totalCount     = await countEventsForExport(userId, filters, categoryIds);
  const rawEvents      = await loadEventsForExport(userId, filters, categoryIds, offset, limit);
  const attrDefs       = await loadAttrDefsForCategories(userId, categoryIds, categoriesDict);

  // ── Merge parent event attributes into each leaf event ──────────────────
  // Leaf events only have their own event_attributes. Parent category attributes
  // (e.g. Sport.napomena) live on separate parent event rows in the DB.
  // We batch-fetch all parent events for the same sessions and merge their attrs.
  if (rawEvents.length > 0) {
    // Collect all parent category IDs (non-leaf parents of our leaf categoryIds)
    const parentCatIds = new Set<string>();
    for (const leafCatId of categoryIds) {
      let cur = categoriesDict[leafCatId]?.parent_category_id ?? null;
      while (cur) {
        parentCatIds.add(cur);
        cur = categoriesDict[cur]?.parent_category_id ?? null;
      }
    }

    if (parentCatIds.size > 0) {
      // Collect unique session_starts across all leaf events
      const sessionStarts = [...new Set(rawEvents.map(e => e.session_start).filter(Boolean))] as string[];

      if (sessionStarts.length > 0) {
        // Batch fetch all parent events for these sessions
        const { data: parentEvents } = await supabase
          .from('events')
          .select('id, user_id, category_id, session_start, chain_key, event_attributes(id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean)')
          .in('category_id', [...parentCatIds])
          .in('session_start', sessionStarts);

        if (parentEvents && parentEvents.length > 0) {
          // Index parent events by (user_id + chain_key + session_start)
          // chain_key = leaf category_id (set by Add/Edit/Import flows, BUG-G fix)
          const parentMap = new Map<string, Array<{ attribute_definition_id: string; value_text: string | null; value_number: number | null; value_datetime: string | null; value_boolean: boolean | null }>>();
          for (const pe of parentEvents as Array<Record<string, unknown>>) {
            const key = `${pe.user_id}__${pe.chain_key}__${pe.session_start}`;
            if (!parentMap.has(key)) parentMap.set(key, []);
            const attrs = (pe.event_attributes as Array<Record<string, unknown>>) ?? [];
            for (const a of attrs) {
              parentMap.get(key)!.push(a as { attribute_definition_id: string; value_text: string | null; value_number: number | null; value_datetime: string | null; value_boolean: boolean | null });
            }
          }

          // Merge parent attrs into each leaf event
          for (const ev of rawEvents) {
            const key = `${ev.user_email ? '' : ''}${(ev as unknown as Record<string, unknown>).user_id}__${ev.category_id}__${ev.session_start}`;
            const parentAttrs = parentMap.get(key);
            if (parentAttrs && parentAttrs.length > 0) {
              // Append parent attrs — excelExport.ts reads event_attributes array
              (ev.event_attributes as unknown[]).push(...parentAttrs);
            }
          }
        }
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  return { events: rawEvents, attrDefs, categoriesDict, totalCount, categoryIds };
}

// ─────────────────────────────────────────────
// Shared emails by area (for Structure sheet SharedWith column)
// ─────────────────────────────────────────────

/**
 * Returns a map of areaId → pipe-separated grantee emails for all areas
 * the current user owns and has active shares for.
 */
export async function loadSharedEmailsByArea(userId: string): Promise<Record<string, string>> {
  const { data: sharesData } = await supabase
    .from('data_shares')
    .select('target_id, grantee_id')
    .eq('owner_id', userId)
    .eq('share_type', 'area');

  if (!sharesData || sharesData.length === 0) return {};

  const granteeIds = [...new Set((sharesData as Array<{ target_id: string; grantee_id: string }>).map(s => s.grantee_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', granteeIds);

  const emailMap = new Map((profiles ?? []).map(p => [p.id as string, p.email as string]));

  const result: Record<string, string> = {};
  for (const share of sharesData as Array<{ target_id: string; grantee_id: string }>) {
    const email = emailMap.get(share.grantee_id);
    if (!email) continue;
    if (result[share.target_id]) {
      result[share.target_id] += '|' + email;
    } else {
      result[share.target_id] = email;
    }
  }
  return result;
}
