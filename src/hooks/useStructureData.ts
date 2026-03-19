// ============================================================
// useStructureData.ts — Structure tab data hook
// ============================================================
// Fetches: areas, categories (all levels), attribute_definitions,
// event counts per category.
// Returns: StructureNode[] in DFS order (depth-first, sort_order
// within each level). This is the single source of truth for
// StructureTableView and StructureSunburstView.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Area, Category, AttributeDefinition } from '@/types/database';
import type { StructureNode, EventCountRow } from '@/types/structure';

const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

interface UseStructureDataReturn {
  nodes: StructureNode[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useStructureData(): UseStructureDataReturn {
  const [nodes, setNodes] = useState<StructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNodes([]);
        return;
      }

      // --------------------------------------------------------
      // 1. Fetch all areas for this user (exclude template user)
      // --------------------------------------------------------
      const { data: areasRaw, error: areasErr } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (areasErr) throw areasErr;
      const areas = (areasRaw || []) as Area[];

      // --------------------------------------------------------
      // 2. Fetch all categories for this user (all levels at once)
      // --------------------------------------------------------
      const { data: categoriesRaw, error: catsErr } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (catsErr) throw catsErr;
      const categories = (categoriesRaw || []) as Category[];

      // --------------------------------------------------------
      // 3. Fetch all attribute_definitions for this user
      // --------------------------------------------------------
      const { data: attrsRaw, error: attrsErr } = await supabase
        .from('attribute_definitions')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (attrsErr) throw attrsErr;
      const attrDefs = (attrsRaw || []) as AttributeDefinition[];

      // --------------------------------------------------------
      // 4. Fetch event counts per category
      //    We can't use GROUP BY directly in supabase-js, so we
      //    fetch all leaf events and count in JS. For large data
      //    sets this should be replaced with a DB function, but
      //    for the expected scale (personal data) this is fine.
      // --------------------------------------------------------
      const { data: eventCountsRaw, error: countsErr } = await supabase
        .from('events')
        .select('category_id')
        .eq('user_id', user.id)
        .neq('user_id', TEMPLATE_USER_ID);

      if (countsErr) throw countsErr;

      // Build categoryId → count map
      const eventCountMap = new Map<string, number>();
      for (const row of (eventCountsRaw || []) as { category_id: string | null }[]) {
        if (!row.category_id) continue;
        eventCountMap.set(row.category_id, (eventCountMap.get(row.category_id) ?? 0) + 1);
      }

      // --------------------------------------------------------
      // 5. Build lookup maps
      // --------------------------------------------------------

      // attrDefs grouped by category_id
      const attrsByCategory = new Map<string, AttributeDefinition[]>();
      for (const def of attrDefs) {
        if (!def.category_id) continue;
        const existing = attrsByCategory.get(def.category_id) ?? [];
        existing.push(def);
        attrsByCategory.set(def.category_id, existing);
      }

      // area lookup by id
      const areaById = new Map<string, Area>();
      for (const area of areas) areaById.set(area.id, area);

      // categories grouped by parent_category_id (null = root/L1)
      const catsByParent = new Map<string | null, Category[]>();
      for (const cat of categories) {
        const key = cat.parent_category_id ?? null;
        const existing = catsByParent.get(key) ?? [];
        existing.push(cat);
        catsByParent.set(key, existing);
      }

      // Set of category IDs that ARE parents (have children)
      const parentCategoryIds = new Set<string>();
      for (const cat of categories) {
        if (cat.parent_category_id) {
          parentCategoryIds.add(cat.parent_category_id);
        }
      }

      // --------------------------------------------------------
      // 6. Build StructureNode[] in DFS order
      //
      //    Order: Area node first, then its L1 children in
      //    sort_order, each L1 followed by its subtree, etc.
      //    This mirrors the Excel export format.
      // --------------------------------------------------------
      const result: StructureNode[] = [];

      for (const area of areas) {
        // Area node (level 0)
        result.push({
          id: area.id,
          nodeType: 'area',
          name: area.name,
          fullPath: area.name,
          level: 0,
          isLeaf: false,            // areas are never leaf nodes
          description: area.description,
          sortOrder: area.sort_order,
          areaId: area.id,
          parentCategoryId: null,
          attributeDefinitions: [], // areas have no attribute_definitions in current schema
          attrCount: 0,
          eventCount: 0,
          area,
          category: null,
        });

        // DFS into L1 categories for this area
        // L1 categories have parent_category_id = null AND area_id = area.id
        const l1Cats = (catsByParent.get(null) ?? [])
          .filter(c => c.area_id === area.id)
          .sort((a, b) => a.sort_order - b.sort_order);

        for (const l1 of l1Cats) {
          addCategorySubtree(
            l1,
            area,
            [area.name],
            1,
            result,
            catsByParent,
            parentCategoryIds,
            attrsByCategory,
            eventCountMap,
          );
        }
      }

      // --------------------------------------------------------
      // 7. Post-process: replace each node's eventCount with
      //    "subtree leaf event count" — the sum of leaf event
      //    counts for all leaf descendants (or own count if leaf).
      //
      //    Why: a non-leaf category (Activity, Gym) stores parent
      //    events in the DB, not leaf events. The raw eventCount
      //    for "Gym" is 1 (one parent event row), not 8 (sessions).
      //    Subtree leaf count = number of activity sessions under
      //    that node, which is what the user expects to see in the
      //    Sunburst tooltip and Table View.
      // --------------------------------------------------------
      const subtreeLeafCount = new Map<string, number>();

      // Initialise: leaf nodes get their own direct event count;
      // non-leaf nodes start at 0 (will accumulate from children).
      for (const node of result) {
        subtreeLeafCount.set(node.id, node.isLeaf ? node.eventCount : 0);
      }

      // Bottom-up pass: iterate in reverse DFS order (children before
      // parents) and propagate each node's subtree count to its parent.
      for (let i = result.length - 1; i >= 0; i--) {
        const node = result[i];
        const myCount = subtreeLeafCount.get(node.id) ?? 0;

        if (node.parentCategoryId) {
          // Non-root category → propagate to direct parent category
          subtreeLeafCount.set(
            node.parentCategoryId,
            (subtreeLeafCount.get(node.parentCategoryId) ?? 0) + myCount,
          );
        } else if (node.nodeType === 'category') {
          // L1 category (parentCategoryId = null) → propagate to Area node
          subtreeLeafCount.set(
            node.areaId,
            (subtreeLeafCount.get(node.areaId) ?? 0) + myCount,
          );
        }
        // Area nodes (nodeType === 'area') are accumulation targets only;
        // they have no parent to propagate to.
      }

      // Apply the computed subtree counts back onto each node.
      const finalResult = result.map(node => ({
        ...node,
        eventCount: subtreeLeafCount.get(node.id) ?? node.eventCount,
      }));

      setNodes(finalResult);
    } catch (err) {
      console.error('useStructureData: fetch failed', err);
      setError(err instanceof Error ? err : new Error('Failed to load structure data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { nodes, loading, error, refetch: fetchAll };
}

// --------------------------------------------------------
// DFS helper — recursively adds a category and all its
// descendants to the result array.
// --------------------------------------------------------
function addCategorySubtree(
  cat: Category,
  area: Area,
  ancestorNames: string[],   // names from Area down to (not including) this cat
  level: number,
  result: StructureNode[],
  catsByParent: Map<string | null, Category[]>,
  parentCategoryIds: Set<string>,
  attrsByCategory: Map<string, AttributeDefinition[]>,
  eventCountMap: Map<string, number>,
): void {
  const pathNames = [...ancestorNames, cat.name];
  const fullPath = pathNames.join(' > ');
  const isLeaf = !parentCategoryIds.has(cat.id);
  const attrs = attrsByCategory.get(cat.id) ?? [];

  result.push({
    id: cat.id,
    nodeType: 'category',
    name: cat.name,
    fullPath,
    level,
    isLeaf,
    description: cat.description,
    sortOrder: cat.sort_order,
    areaId: cat.area_id ?? area.id,
    parentCategoryId: cat.parent_category_id,
    attributeDefinitions: attrs,
    attrCount: attrs.length,
    eventCount: eventCountMap.get(cat.id) ?? 0,
    area,
    category: cat,
  });

  // Recurse into children in sort_order
  const children = (catsByParent.get(cat.id) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const child of children) {
    addCategorySubtree(
      child,
      area,
      pathNames,
      level + 1,
      result,
      catsByParent,
      parentCategoryIds,
      attrsByCategory,
      eventCountMap,
    );
  }
}

// --------------------------------------------------------
// Helper: apply FilterContext selection to node list.
// Used by StructureTableView to narrow the displayed rows.
// --------------------------------------------------------
export function filterStructureNodes(
  nodes: StructureNode[],
  areaId: string | null,
  categoryId: string | null,
): StructureNode[] {
  if (!areaId && !categoryId) return nodes;

  if (categoryId) {
    // Find the selected node, then keep it and all descendants.
    // A descendant has the selected node's fullPath as a prefix.
    const pivot = nodes.find(n => n.id === categoryId);
    if (!pivot) return nodes;
    const prefix = pivot.fullPath;
    return nodes.filter(
      n => n.fullPath === prefix || n.fullPath.startsWith(prefix + ' > ')
    );
  }

  // areaId only — keep the area node and all its descendants
  return nodes.filter(n => n.areaId === areaId);
}

// Re-export EventCountRow so callers can import from one place
export type { EventCountRow };
