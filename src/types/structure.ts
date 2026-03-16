// ============================================================
// structure.ts — TypeScript types for the Structure tab
// ============================================================
// StructureNode: one row in the hierarchical Table View.
// One node per Area or per Category (at any level).
// Loaded by useStructureData, rendered by StructureTableView.
// ============================================================

import type { Area, Category, AttributeDefinition } from '@/types/database';

// Node type discriminator
export type StructureNodeType = 'area' | 'category';

// StructureNode — one row in the Structure Table View
export interface StructureNode {
  // Identity
  id: string;                          // area.id or category.id
  nodeType: StructureNodeType;

  // Display
  name: string;                        // short name (area.name or category.name)
  fullPath: string;                    // "Fitness > Activity > Gym > Cardio"
  level: number;                       // 0 = Area, 1 = L1, 2 = L2, etc.
  isLeaf: boolean;                     // true if category has no children

  // Metadata
  description: string | null;
  sortOrder: number;
  areaId: string;                      // always set (even for Area nodes: areaId === id)
  parentCategoryId: string | null;     // null for Area nodes and L1 categories

  // Attributes at this level only (not accumulated from parents)
  attributeDefinitions: AttributeDefinition[];
  attrCount: number;                   // attributeDefinitions.length

  // Event count for this category (leaf events only, not parent events)
  eventCount: number;

  // Raw DB objects for detail panel, edit forms etc.
  area: Area;
  category: Category | null;          // null for Area nodes
}

// Shape of the raw event-count query result
export interface EventCountRow {
  category_id: string;
  count: number;
}
