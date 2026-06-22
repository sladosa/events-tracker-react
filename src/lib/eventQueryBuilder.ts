/**
 * Shared event query filter logic — single source of truth.
 * Used by useActivities (Activities table) and excelDataLoader (Excel export).
 *
 * Adding a new filter? Add it here once → both consumers get it.
 */

import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

export interface AttrFilterParam {
  attrDefId: string;
  value: string;
  isExact: boolean;
}

export interface EventQueryFilters {
  categoryIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  commentSearch?: string;
  attrFilter?: AttrFilterParam | null;
}

// ─────────────────────────────────────────────
// SELECT helpers
// ─────────────────────────────────────────────

/**
 * Returns the `!inner` join suffix for the SELECT clause when attrFilter is active.
 * Caller appends this to their base select columns.
 *
 * @param includeId  true → includes `id` in the join select (useActivities needs it)
 * @returns e.g. ", event_attributes!event_attributes_event_id_fkey!inner(attribute_definition_id, value_text)"
 *          or "" if no attr filter is active
 */
export function attrFilterJoinClause(
  attrFilter?: AttrFilterParam | null,
  includeId = false,
): string {
  if (!attrFilter?.attrDefId || !attrFilter.value) return '';
  const idField = includeId ? 'id, ' : '';
  return `, event_attributes!event_attributes_event_id_fkey!inner(${idField}attribute_definition_id, value_text)`;
}

/**
 * Whether the attr filter !inner join is active (non-empty attrDefId + value).
 */
export function isAttrFilterActive(attrFilter?: AttrFilterParam | null): boolean {
  return !!(attrFilter?.attrDefId && attrFilter.value);
}

// ─────────────────────────────────────────────
// WHERE clause builder
// ─────────────────────────────────────────────

/**
 * Apply WHERE-clause filters to a Supabase `events` query.
 * Caller is responsible for SELECT, ORDER BY, and RANGE/LIMIT.
 *
 * Handles: categoryIds, dateFrom, dateTo, commentSearch, attrFilter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyEventFilters(query: any, filters: EventQueryFilters): any {
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    query = query.in('category_id', filters.categoryIds);
  }

  if (filters.dateFrom) {
    query = query.gte('event_date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('event_date', filters.dateTo);
  }

  if (filters.commentSearch) {
    query = query.ilike('comment', `%${filters.commentSearch}%`);
  }

  if (isAttrFilterActive(filters.attrFilter)) {
    const af = filters.attrFilter!;
    query = query.eq('event_attributes.attribute_definition_id', af.attrDefId);
    if (af.isExact) {
      query = query.eq('event_attributes.value_text', af.value);
    } else {
      query = query.ilike('event_attributes.value_text', `%${af.value}%`);
    }
  }

  return query;
}

// ─────────────────────────────────────────────
// Category ID resolution (Activities table)
// ─────────────────────────────────────────────

async function filterToLeafCategories(ids: UUID[]): Promise<UUID[]> {
  if (ids.length === 0) return ids;
  const { data } = await supabase
    .from('categories')
    .select('parent_category_id')
    .in('parent_category_id', ids);
  const parentSet = new Set(
    (data ?? []).map(r => (r as { parent_category_id: string }).parent_category_id),
  );
  return ids.filter(id => !parentSet.has(id));
}

async function getDescendantCategoryIds(catId: UUID): Promise<UUID[]> {
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
}

/**
 * Resolve leaf category IDs from area/category filter.
 * Used by Activities table — only leaf categories (parent events are loaded separately).
 */
export async function resolveLeafCategoryIds(
  areaId: UUID | null,
  categoryId: UUID | null,
): Promise<{ categoryIds: UUID[]; isLeafCategory: boolean }> {
  if (categoryId) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_category_id', categoryId)
      .limit(1);
    const hasChildren = (data?.length ?? 0) > 0;

    if (hasChildren) {
      const allDesc = await getDescendantCategoryIds(categoryId);
      const leafIds = await filterToLeafCategories(allDesc);
      return { categoryIds: leafIds, isLeafCategory: false };
    }
    return { categoryIds: [categoryId], isLeafCategory: true };
  }

  if (areaId) {
    const { data: areaCats } = await supabase
      .from('categories')
      .select('id')
      .eq('area_id', areaId);
    const allAreaIds = (areaCats || []).map(c => c.id);
    const leafIds = await filterToLeafCategories(allAreaIds);
    return { categoryIds: leafIds, isLeafCategory: false };
  }

  // No filter → all leaf categories (RLS scoped)
  const { data: allCats } = await supabase
    .from('categories')
    .select('id');
  const allCatIds = (allCats || []).map(c => c.id);
  const leafIds = await filterToLeafCategories(allCatIds);
  return { categoryIds: leafIds, isLeafCategory: false };
}
