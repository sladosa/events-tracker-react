// ============================================================
// StructureAddChildPanel.tsx
// ============================================================
// Inline amber panel for adding a child category under any node.
//
// S22: "+ Add Child" is available on ALL node types in Edit Mode:
//   - Area        → creates L1 Category (parent_category_id = null)
//   - Category    → creates child Category (parent_category_id = parent.id)
//   - Leaf        → creates child Category (parent becomes non-leaf after this)
//
// Slug generation: name → lowercase, spaces → '_', strip non-alphanum-underscore.
// sort_order: max existing sibling sort_order + 10, or 10 if first child.
//
// Theme: THEME.structureEdit (amber) — same as StructureNodeEditPanel.
// ============================================================

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'category';
}

function computeNextSortOrder(
  parentNode: StructureNode,
  allNodes: StructureNode[],
): number {
  const siblings = allNodes.filter(n =>
    n.nodeType === 'category' &&
    (parentNode.nodeType === 'area'
      ? n.areaId === parentNode.id && n.parentCategoryId === null
      : n.parentCategoryId === parentNode.id),
  );
  if (siblings.length === 0) return 10;
  const maxSort = Math.max(...siblings.map(s => s.sortOrder));
  return maxSort + 10;
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// --------------------------------------------------------
// Props
// --------------------------------------------------------
interface StructureAddChildPanelProps {
  /** The parent node under which the new category will be created */
  parentNode: StructureNode;
  allNodes: StructureNode[];
  onClose: () => void;
  /** Called with the new category's id after successful creation */
  onCreated: (newNodeId: string) => void;
}

// --------------------------------------------------------
// Component
// --------------------------------------------------------
export function StructureAddChildPanel({
  parentNode,
  allNodes,
  onClose,
  onCreated,
}: StructureAddChildPanelProps) {
  const t = THEME.structureEdit;

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;
  const previewSlug = trimmedName ? generateSlug(trimmedName) : '';

  const newLevel = parentNode.nodeType === 'area' ? 1 : parentNode.level + 1;

  const handleCreate = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const slug = generateSlug(trimmedName);
      const sortOrder = computeNextSortOrder(parentNode, allNodes);

      const newCategory = {
        area_id: parentNode.areaId,
        parent_category_id: parentNode.nodeType === 'area' ? null : parentNode.id,
        name: trimmedName,
        slug,
        level: newLevel,
        sort_order: sortOrder,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('categories')
        .insert(newCategory)
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('No id returned from insert');

      onCreated(data.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Create failed');
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-600 rounded-t-xl',
          t.headerBg,
        )}>
          <div className="flex items-center gap-2">
            <span className="text-white"><PlusIcon /></span>
            <h3 className={cn('text-sm font-semibold', t.headerText)}>
              Add Child Category
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className={cn('p-1 rounded-md transition-colors', t.accent)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Context */}
          <div className={cn('rounded-lg px-3 py-2 text-xs', t.light)}>
            <span className="text-gray-500">Under: </span>
            <span className={cn('font-medium', t.lightText)}>{parentNode.fullPath}</span>
            <span className="text-gray-400 ml-2">→ Level {newLevel}</span>
          </div>

          {/* Name input */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Upper Body"
              autoFocus
              disabled={saving}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm transition-colors',
                'focus:outline-none focus:ring-2',
                t.lightBorder,
                t.ring,
                saving && 'opacity-50 cursor-not-allowed',
              )}
            />
            {previewSlug && (
              <p className="text-xs text-gray-400">
                Slug: <span className="font-mono">{previewSlug}</span>
              </p>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
              Error: {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'flex justify-end gap-2 px-5 py-4 border-t border-gray-100 rounded-b-xl bg-gray-50',
        )}>
          <button
            onClick={onClose}
            disabled={saving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              t.cancelBtn,
              saving && 'opacity-50 cursor-not-allowed',
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || saving}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              'bg-amber-600 hover:bg-amber-700 text-white',
              (!isValid || saving) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {saving ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating…
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
