import { useState, useEffect, useMemo } from 'react';
import { useAreas } from './useAreas';
import { useCategories } from './useCategories';
import type { TreeNode, Area, CategoryWithArea, UUID } from '@/types';

interface UseCategoryTreeReturn {
  tree: TreeNode[];
  flatNodes: TreeNode[];
  loading: boolean;
  error: Error | null;
  findNode: (id: UUID) => TreeNode | undefined;
  getChildren: (parentId: UUID | null) => TreeNode[];
}

/**
 * Gradi hijerarhijsko stablo od Areas i Categories
 * 
 * Struktura:
 * - Area 1
 *   - Category 1.1 (level 1)
 *     - Category 1.1.1 (level 2)
 *   - Category 1.2 (level 1)
 * - Area 2
 *   - ...
 */
export function useCategoryTree(): UseCategoryTreeReturn {
  const { areas, loading: areasLoading, error: areasError } = useAreas();
  const { categories, loading: catsLoading, error: catsError } = useCategories();
  
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [flatNodes, setFlatNodes] = useState<TreeNode[]>([]);

  // Build tree when data changes
  useEffect(() => {
    if (areasLoading || catsLoading) return;
    if (areasError || catsError) return;

    const { treeNodes, flat } = buildTree(areas, categories);
    setTree(treeNodes);
    setFlatNodes(flat);
  }, [areas, categories, areasLoading, catsLoading, areasError, catsError]);

  // Helper to find a node by ID
  const findNode = useMemo(() => {
    const nodeMap = new Map<UUID, TreeNode>();
    flatNodes.forEach(node => nodeMap.set(node.id, node));
    return (id: UUID) => nodeMap.get(id);
  }, [flatNodes]);

  // Helper to get children of a node
  const getChildren = useMemo(() => {
    return (parentId: UUID | null): TreeNode[] => {
      if (parentId === null) {
        // Return root level (areas)
        return tree;
      }
      const parent = findNode(parentId);
      return parent?.children || [];
    };
  }, [tree, findNode]);

  return {
    tree,
    flatNodes,
    loading: areasLoading || catsLoading,
    error: areasError || catsError,
    findNode,
    getChildren
  };
}

// --------------------------------------------
// Tree Building Logic
// --------------------------------------------

function buildTree(
  areas: Area[], 
  categories: CategoryWithArea[]
): { treeNodes: TreeNode[]; flat: TreeNode[] } {
  const flat: TreeNode[] = [];
  
  // Create area nodes
  const areaNodes: TreeNode[] = areas.map(area => {
    const node: TreeNode = {
      id: area.id,
      name: area.name,
      type: 'area',
      icon: area.icon,
      color: area.color,
      level: 0,
      children: [],
      parent_id: null
    };
    flat.push(node);
    return node;
  });

  // Create category nodes map for quick lookup
  const categoryNodeMap = new Map<UUID, TreeNode>();
  
  // First pass: create all category nodes
  categories.forEach(cat => {
    const node: TreeNode = {
      id: cat.id,
      name: cat.name,
      type: 'category',
      level: cat.level,
      children: [],
      parent_id: cat.parent_category_id,
      area_id: cat.area_id || undefined
    };
    categoryNodeMap.set(cat.id, node);
    flat.push(node);
  });

  // Second pass: build hierarchy
  categories.forEach(cat => {
    const node = categoryNodeMap.get(cat.id)!;
    
    if (cat.parent_category_id) {
      // Has parent category - add as child of parent
      const parentNode = categoryNodeMap.get(cat.parent_category_id);
      if (parentNode) {
        parentNode.children.push(node);
      }
    } else if (cat.area_id) {
      // Root category - add as child of area
      const areaNode = areaNodes.find(a => a.id === cat.area_id);
      if (areaNode) {
        areaNode.children.push(node);
      }
    }
  });

  // Sort children by sort_order (using original category data)
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      // Areas use their own sort, categories use level then name
      if (a.type === 'area' && b.type === 'area') {
        const areaA = areas.find(ar => ar.id === a.id);
        const areaB = areas.find(ar => ar.id === b.id);
        return (areaA?.sort_order || 0) - (areaB?.sort_order || 0);
      }
      
      const catA = categories.find(c => c.id === a.id);
      const catB = categories.find(c => c.id === b.id);
      
      // First by level, then by sort_order
      if (a.level !== b.level) return a.level - b.level;
      return (catA?.sort_order || 0) - (catB?.sort_order || 0);
    });

    // Recursively sort children
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(areaNodes);

  return { treeNodes: areaNodes, flat };
}

// --------------------------------------------
// Helper: Get tree filtered by area
// --------------------------------------------

export function useCategoryTreeByArea(areaId: UUID | null): UseCategoryTreeReturn {
  const fullTree = useCategoryTree();
  
  const filteredTree = useMemo(() => {
    if (!areaId) return fullTree.tree;
    return fullTree.tree.filter(node => node.id === areaId);
  }, [fullTree.tree, areaId]);

  const filteredFlat = useMemo(() => {
    if (!areaId) return fullTree.flatNodes;
    
    const areaNode = fullTree.tree.find(n => n.id === areaId);
    if (!areaNode) return [];
    
    // Collect all descendants
    const collectNodes = (node: TreeNode): TreeNode[] => {
      return [node, ...node.children.flatMap(collectNodes)];
    };
    
    return collectNodes(areaNode);
  }, [fullTree.tree, fullTree.flatNodes, areaId]);

  return {
    ...fullTree,
    tree: filteredTree,
    flatNodes: filteredFlat
  };
}
