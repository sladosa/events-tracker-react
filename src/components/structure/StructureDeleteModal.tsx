// ============================================================
// StructureDeleteModal.tsx
// ============================================================
// Delete confirmation modal for Structure tab Edit Mode.
//
// S22 scope (safe phase):
//   - Blocked if node has any events in subtree (eventCount > 0)
//     → shows informational message, no delete possible
//   - Allowed only if eventCount === 0 (no data loss risk)
//     → confirm → execute → onDeleted callback
//
// Full delete-with-backup (eventCount > 0 case) deferred to S23
// when combined Structure+Activities backup is implemented.
//
// Delete sequence (eventCount === 0):
//   1. Delete attribute_definitions for all subtree category IDs
//   2. Delete categories leaf-first (sorted by level DESC) to satisfy FK
//   3. If Area: delete area record
// ============================================================

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

/** Returns all category IDs in the subtree rooted at node (inclusive). */
function getSubtreeCategoryIds(node: StructureNode, allNodes: StructureNode[]): string[] {
  if (node.nodeType === 'area') {
    return allNodes
      .filter(n => n.nodeType === 'category' && n.areaId === node.id)
      .map(n => n.id);
  }
  // BFS from category node
  const result: string[] = [];
  const queue = [node.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const n of allNodes) {
      if (n.nodeType === 'category' && n.parentCategoryId === id) {
        queue.push(n.id);
      }
    }
  }
  return result;
}

/** Execute cascade delete for a node with eventCount === 0. */
async function executeDelete(
  node: StructureNode,
  allNodes: StructureNode[],
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const subtreeIds = getSubtreeCategoryIds(node, allNodes);

  // 1. Delete attribute_definitions for all subtree categories
  if (subtreeIds.length > 0) {
    const { error: attrErr } = await supabase
      .from('attribute_definitions')
      .delete()
      .in('category_id', subtreeIds)
      .eq('user_id', user.id);
    if (attrErr) throw attrErr;
  }

  // 2. Delete categories leaf-first (highest level first) to satisfy FK
  if (subtreeIds.length > 0) {
    const subtreeNodes = allNodes
      .filter(n => n.nodeType === 'category' && subtreeIds.includes(n.id))
      .sort((a, b) => b.level - a.level); // deepest first

    const levels = [...new Set(subtreeNodes.map(n => n.level))].sort((a, b) => b - a);
    for (const level of levels) {
      const idsAtLevel = subtreeNodes
        .filter(n => n.level === level)
        .map(n => n.id);
      const { error: catErr } = await supabase
        .from('categories')
        .delete()
        .in('id', idsAtLevel)
        .eq('user_id', user.id);
      if (catErr) throw catErr;
    }
  }

  // 3. If Area: delete the area record itself
  if (node.nodeType === 'area') {
    const { error: areaErr } = await supabase
      .from('areas')
      .delete()
      .eq('id', node.id)
      .eq('user_id', user.id);
    if (areaErr) throw areaErr;
  }
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// --------------------------------------------------------
// Props
// --------------------------------------------------------
interface StructureDeleteModalProps {
  node: StructureNode;
  allNodes: StructureNode[];
  onClose: () => void;
  /** Called after successful delete — pass the deleted node's id for highlight/refetch */
  onDeleted: (deletedNodeId: string) => void;
}

// --------------------------------------------------------
// Component
// --------------------------------------------------------
export function StructureDeleteModal({
  node,
  allNodes,
  onClose,
  onDeleted,
}: StructureDeleteModalProps) {
  const t = THEME.structure;
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isBlocked = node.eventCount > 0;

  // Count direct child categories for informational message
  const childCategories = allNodes.filter(n =>
    n.nodeType === 'category' &&
    (node.nodeType === 'area'
      ? n.areaId === node.id && n.parentCategoryId === null
      : n.parentCategoryId === node.id),
  );
  const subtreeIds = getSubtreeCategoryIds(node, allNodes);
  const totalCategoriesInSubtree = subtreeIds.length;

  const handleDelete = async () => {
    setExecuting(true);
    setErrorMsg(null);
    try {
      await executeDelete(node, allNodes);
      onDeleted(node.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
      setExecuting(false);
    }
  };

  // Build description of what will be deleted
  const deletedLabel = node.nodeType === 'area'
    ? `Area "${node.name}"`
    : `Category "${node.name}"`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !executing) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 px-5 py-4 border-b border-gray-100 rounded-t-xl',
          isBlocked ? 'bg-orange-50' : 'bg-red-50',
        )}>
          <span className={isBlocked ? 'text-orange-500' : 'text-red-500'}>
            {isBlocked ? <LockIcon /> : <TrashIcon />}
          </span>
          <h3 className={cn(
            'text-sm font-semibold',
            isBlocked ? 'text-orange-700' : 'text-red-700',
          )}>
            {isBlocked ? 'Cannot Delete' : 'Confirm Delete'}
          </h3>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-gray-800">
            {node.fullPath}
          </p>

          {/* Blocked state — has events */}
          {isBlocked && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
              <p className="text-sm text-orange-800 font-medium">
                {node.eventCount} {node.eventCount === 1 ? 'activity' : 'activities'} exist in this {node.nodeType === 'area' ? 'area' : 'subtree'}.
              </p>
              <p className="text-xs text-orange-700">
                Deleting a {node.nodeType} with existing activity data requires a full backup
                (structure + activities). This will be available in a future version.
              </p>
              <p className="text-xs text-orange-600">
                To manage existing data, export your activities to Excel first.
              </p>
            </div>
          )}

          {/* Allowed state — no events */}
          {!isBlocked && (
            <div className="space-y-2">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">
                  This will permanently delete {deletedLabel}
                  {totalCategoriesInSubtree > 0 && (
                    <span>
                      {' '}and{' '}
                      <span className="font-medium">
                        {totalCategoriesInSubtree} {totalCategoriesInSubtree === 1 ? 'sub-category' : 'sub-categories'}
                      </span>
                      {' '}below it
                    </span>
                  )}
                  {' '}along with all attribute definitions.
                </p>
              </div>
              {childCategories.length > 0 && (
                <p className="text-xs text-gray-500">
                  Children: {childCategories.map(c => c.name).join(', ')}
                  {totalCategoriesInSubtree > childCategories.length && ' (+ deeper levels)'}
                </p>
              )}
              <p className="text-xs text-gray-400">
                No activity data exists in this subtree — safe to delete.
                This action cannot be undone.
              </p>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              Error: {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={cn('flex justify-end gap-2 px-5 py-4 border-t border-gray-100 rounded-b-xl', 'bg-gray-50')}>
          <button
            onClick={onClose}
            disabled={executing}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              t.cancelBtn,
              executing && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isBlocked ? 'OK' : 'Cancel'}
          </button>

          {!isBlocked && (
            <button
              onClick={handleDelete}
              disabled={executing}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                'bg-red-600 hover:bg-red-700 text-white',
                executing && 'opacity-70 cursor-not-allowed',
              )}
            >
              {executing ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
