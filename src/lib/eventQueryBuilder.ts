/**
 * Shared event query filter logic — single source of truth.
 * Used by useActivities (Activities table) and excelDataLoader (Excel export).
 *
 * Adding a new filter? Add it here once → both consumers get it.
 */

import type { UUID } from '@/types';
import { getCategoryMapContaining } from '@/lib/categoryCache';
import { areaCategoryIds, descendantIds, leafOnly } from '@/lib/categoryTree';
import {
  numericFilterValue, dateFilterBounds, booleanFilterValue, isTypedFilterReadable,
  type NumericOp, type AttrFilterKind,
} from '@/lib/attrFilterNumeric';

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

export const ATTR_FILTER_ANY = '__any__';

export interface AttrFilterParam {
  attrDefId: string;
  value: string;
  isExact: boolean;
  /** F4 — present ⇒ compare `value_number` with `op` (see attrFilterNumeric.ts). */
  op?: NumericOp | null;
  /** S160 — `datetime` (`value_datetime`, `op` na razini dana) ili `boolean`
   *  (`value_boolean`). Odsutan = broj uz `op`, tekst bez njega. */
  kind?: AttrFilterKind | null;
}

/** Stupac `event_attributes` koji uvjet cita — JOIN i WHERE moraju se slagati. */
function valueColumn(af: AttrFilterParam): string {
  if (af.kind === 'datetime') return 'value_datetime';
  if (af.kind === 'boolean') return 'value_boolean';
  return af.op ? 'value_number' : 'value_text';
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
  if (!isAttrFilterActive(attrFilter)) return '';
  const idField = includeId ? 'id, ' : '';
  const valueField = valueColumn(attrFilter!);
  return `, event_attributes!event_attributes_event_id_fkey!inner(${idField}attribute_definition_id, ${valueField})`;
}

/**
 * Whether the attr filter !inner join is active (non-empty attrDefId + value).
 *
 * ⚠ A numeric condition whose value does not parse is NOT active (F4): the
 *   join and the WHERE must agree, and filtering by a guessed number is worse
 *   than showing everything while the person is still typing.
 *   "In any attribute" never carries `op` — it searches text.
 */
export function isAttrFilterActive(attrFilter?: AttrFilterParam | null): boolean {
  if (!attrFilter?.attrDefId || !attrFilter.value) return false;
  if (attrFilter.op || attrFilter.kind) {
    return attrFilter.attrDefId !== ATTR_FILTER_ANY && isTypedFilterReadable(attrFilter);
  }
  return true;
}

export function isAnyAttrFilter(attrFilter?: AttrFilterParam | null): boolean {
  return attrFilter?.attrDefId === ATTR_FILTER_ANY;
}

// ─────────────────────────────────────────────
// ILIKE helpers
// ─────────────────────────────────────────────

/**
 * Escapes ILIKE wildcard characters (%, _) and the escape char itself, so
 * user-typed search text is matched literally instead of as a SQL pattern
 * (e.g. "100%" or "_test_" would otherwise match far more than intended).
 */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
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
    query = query.ilike('comment', `%${escapeIlike(filters.commentSearch)}%`);
  }

  if (isAttrFilterActive(filters.attrFilter)) {
    const af = filters.attrFilter!;
    if (!isAnyAttrFilter(af)) {
      query = query.eq('event_attributes.attribute_definition_id', af.attrDefId);
    }
    if (af.kind === 'datetime') {
      for (const b of dateFilterBounds(af.op!, af.value)!) {
        query = query[b.op]('event_attributes.value_datetime', b.iso);
      }
    } else if (af.kind === 'boolean') {
      query = query.eq('event_attributes.value_boolean', booleanFilterValue(af));
    } else if (af.op) {
      // F4: `gt`/`gte`/`lt`/`lte`/`eq` are PostgREST's own operator names.
      query = query[af.op]('event_attributes.value_number', numericFilterValue(af));
    } else if (af.isExact) {
      query = query.eq('event_attributes.value_text', af.value);
    } else {
      query = query.ilike('event_attributes.value_text', `%${escapeIlike(af.value)}%`);
    }
  }

  return query;
}

// ─────────────────────────────────────────────
// Category ID resolution (Activities table)
// ─────────────────────────────────────────────

/**
 * Resolve leaf category IDs from area/category filter.
 * Used by Activities table — only leaf categories (parent events are loaded separately).
 *
 * S162: iz `categoryCache` (memorija), ne iz baze. Prije su to bila TRI serijska
 * kruga prije upita liste (id-jevi Aree → koji su leaf → eventi), a za odabranu
 * kategoriju i po jedan upit po razini stabla. Palo čitanje keša BACA — nikad
 * „nema kategorija" (to bi bila prazna lista koja izgleda kao odgovor).
 */
export async function resolveLeafCategoryIds(
  areaId: UUID | null,
  categoryId: UUID | null,
): Promise<{ categoryIds: UUID[]; isLeafCategory: boolean }> {
  const map = await getCategoryMapContaining({ categoryId, areaId });

  if (categoryId) {
    const desc = descendantIds(map, categoryId);
    if (desc.length > 1) {
      return { categoryIds: leafOnly(map, desc), isLeafCategory: false };
    }
    return { categoryIds: [categoryId], isLeafCategory: true };
  }

  if (areaId) {
    return { categoryIds: leafOnly(map, areaCategoryIds(map, areaId)), isLeafCategory: false };
  }

  // No filter → all leaf categories (RLS scoped)
  return { categoryIds: leafOnly(map, [...map.keys()] as UUID[]), isLeafCategory: false };
}
