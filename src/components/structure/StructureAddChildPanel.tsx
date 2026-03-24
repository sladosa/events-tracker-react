// ============================================================
// StructureAddChildPanel.tsx
// ============================================================
// Amber modal for adding a child category under any node (S22).
//
// Available on ALL node types:
//   Area     → L1 category (parent_category_id = null, area_id = area.id)
//   Category → level+1 category (parent_category_id = node.id)
//   Leaf     → level+1 category (leaf becomes non-leaf automatically)
//
// BUG FIX (S23): Area node's child must have parent_category_id = null,
//   NOT node.id — because Area IDs live in the `areas` table, not
//   `categories`, so FK constraint (categories.parent_category_id →
//   categories.id) would reject the insert.
//
// LEAF BLOCKED (S24): If parent node is a leaf with events, the panel
//   shows a blocked state — Add Child is not allowed. Adding a child
//   to a leaf with events breaks the event chain (events remain on the
//   now-non-leaf parent and disappear from the activity view).
//
// Slug: generated on frontend, preview shown live.
// sort_order: max sibling sort_order + 10 (or 10 if no siblings).
//
// After create: onCreated(newNodeId) → StructureTableView refetches + highlights.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureAddChildPanelProps {
  parentNode: StructureNode;
  allNodes: StructureNode[];
  userId: string;
  onClose: () => void;
  onCreated: (newNodeId: string) => void;
}

// --------------------------------------------------------
// Slug generation (mirrors structureImport.ts logic)
// --------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function StructureAddChildPanel({
  parentNode,
  allNodes,
  userId,
  onClose,
  onCreated,
}: StructureAddChildPanelProps) {
  const t = THEME.structureEdit;
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [creating, onClose]);

  const slug = generateSlug(name);

  // ── Context line ──────────────────────────────────────────
  // "Under: Fitness > Activity > Gym  →  Level 3"
  const newLevel = parentNode.nodeType === 'area' ? 1 : parentNode.level + 1;
  const contextPath = parentNode.fullPath;

  // ── Leaf with events — show warning ──────────────────────
  const isLeafWithEvents = parentNode.isLeaf && parentNode.nodeType === 'category' && parentNode.eventCount > 0;

  // ── Compute sort_order ────────────────────────────────────
  // Siblings = categories in same parent slot
  const computeSortOrder = useCallback((): number => {
    let siblings: StructureNode[];
    if (parentNode.nodeType === 'area') {
      // Siblings = existing L1 categories under this area
      siblings = allNodes.filter(
        n => n.nodeType === 'category' && n.areaId === parentNode.id && n.parentCategoryId === null,
      );
    } else {
      // Siblings = categories with same parent
      siblings = allNodes.filter(
        n => n.nodeType === 'category' && n.parentCategoryId === parentNode.id,
      );
    }
    const maxSort = siblings.reduce((max, n) => Math.max(max, n.sortOrder), 0);
    return maxSort + 10;
  }, [parentNode, allNodes]);

  // ── Create handler ────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    setError(null);

    try {
      const newId = crypto.randomUUID();
      const sortOrder = computeSortOrder();

      // KEY FIX: Area children have parent_category_id = null
      // because Area IDs are in the `areas` table, not `categories`.
      // FK constraint: categories.parent_category_id → categories.id
      const parentCategoryId = parentNode.nodeType === 'area' ? null : parentNode.id;
      const areaId = parentNode.areaId;

      const { error: insertErr } = await supabase
        .from('categories')
        .insert({
          id: newId,
          user_id: userId,
          area_id: areaId,
          parent_category_id: parentCategoryId,
          name: trimmedName,
          slug: slug || generateSlug(trimmedName),
          level: newLevel,
          sort_order: sortOrder,
          description: null,
        });

      if (insertErr) throw insertErr;

      onCreated(newId);
    } catch (err) {
      console.error('StructureAddChildPanel: create failed', err);
      setError(err instanceof Error ? err.message : 'Create failed. Please try again.');
      setCreating(false);
    }
  }, [name, slug, parentNode, userId, newLevel, computeSortOrder, onCreated]);

  // Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !creating) {
      handleCreate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !creating) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className={cn('flex items-center justify-between px-5 py-4', t.headerBg)}>
          <h3 className={cn('text-base font-semibold', t.headerText)}>
            + Add Child Category
          </h3>
          <button
            onClick={onClose}
            disabled={creating}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              t.accent,
              creating && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        {isLeafWithEvents ? (
          /* Blocked state — leaf has events, Add Child not allowed */
          <div className="px-5 py-5 space-y-3">
            <div className="flex items-start gap-3 px-3 py-3 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-orange-500 mt-0.5 flex-shrink-0"><LockIcon /></span>
              <div>
                <p className="text-sm font-semibold text-orange-800 mb-1">
                  Cannot add child — leaf has events
                </p>
                <p className="text-xs text-orange-700 leading-snug">
                  <span className="font-semibold">{contextPath}</span> has{' '}
                  <span className="font-semibold">{parentNode.eventCount} {parentNode.eventCount === 1 ? 'event' : 'events'}</span>.
                  Adding a child would make it a non-leaf, causing those events to
                  disappear from the activity view.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">

            {/* Context line */}
            <div className={cn('text-sm px-3 py-2 rounded-lg', t.light, t.lightText)}>
              <span>Under: </span>
              <span className="font-semibold">{contextPath}</span>
              <span className="text-gray-500"> → Level {newLevel}</span>
            </div>

            {/* Name input */}
            <div>
              <label className={cn('block text-sm font-medium mb-1', t.lightText)}>
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                disabled={creating}
                placeholder="e.g. Cardio"
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors',
                  t.ring,
                  'border-amber-300 focus:border-amber-400',
                  creating && 'opacity-50',
                )}
              />
              {/* Slug preview */}
              <p className="mt-1 text-xs text-gray-400">
                Slug: <span className="font-mono text-gray-500">{slug || '—'}</span>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Error: {error}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          {isLeafWithEvents ? (
            <button
              onClick={onClose}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', t.cancelBtn)}
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={creating}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  t.cancelBtn,
                  creating && 'opacity-50 cursor-not-allowed',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-amber-700 hover:bg-amber-800 text-white',
                  (!name.trim() || creating) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {creating && <Spinner />}
                {creating ? 'Creating…' : 'Create'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
