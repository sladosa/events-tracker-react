/**
 * Events Tracker – Excel Data Loader
 * ====================================
 * Supabase queries for Excel export/import.
 * Mirrors Python data loading helpers from excel_events_io.py V2.5.8
 */

import { supabase } from '@/lib/supabaseClient';
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

export async function loadCategoriesForExport(userId: string): Promise<ExportCategoriesDict> {
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, sort_order')
    .eq('user_id', userId)
    .order('sort_order');

  const areasMap = new Map<string, string>((areas ?? []).map(a => [a.id, a.name]));

  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, parent_category_id, area_id, level, sort_order')
    .eq('user_id', userId)
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
  userId:         string,
  categoryIds:    string[],
  categoriesDict: ExportCategoriesDict,
): Promise<ExportAttrDef[]> {
  if (categoryIds.length === 0) return [];

  // Include parent categories so we get inherited attributes
  const allCatIds = getCategoryIdsWithParents(categoriesDict, categoryIds);

  const { data: attrs } = await supabase
    .from('attribute_definitions')
    .select('id, category_id, name, data_type, unit, is_required, default_value, validation_rules, sort_order')
    .eq('user_id', userId)
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
  userId:  string,
  filters: ExportFilters,
  categoryIds: string[],
): Promise<number> {
  let query = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (filters.dateFrom) query = query.gte('event_date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('event_date', filters.dateTo);

  const { count } = await query;
  return count ?? 0;
}

/** Load a page of events with their attributes */
export async function loadEventsForExport(
  userId:      string,
  filters:     ExportFilters,
  categoryIds: string[],
  offset:      number = 0,
  limit:       number = 10000,
): Promise<ExportEvent[]> {
  const desc = filters.sortOrder === 'desc';

  let query = supabase
    .from('events')
    .select(`
      id,
      category_id,
      event_date,
      session_start,
      comment,
      created_at,
      event_attributes (
        id,
        attribute_definition_id,
        value_text,
        value_number,
        value_datetime,
        value_boolean
      )
    `)
    .eq('user_id', userId);

  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (filters.dateFrom) query = query.gte('event_date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('event_date', filters.dateTo);

  query = query
    .order('event_date',    { ascending: !desc })
    .order('session_start', { ascending: !desc, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as unknown as ExportEvent[];
}

// ─────────────────────────────────────────────
// Effective category IDs from filter state
// ─────────────────────────────────────────────

export async function resolveExportCategoryIds(
  userId:         string,
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

  return { events: rawEvents, attrDefs, categoriesDict, totalCount, categoryIds };
}
