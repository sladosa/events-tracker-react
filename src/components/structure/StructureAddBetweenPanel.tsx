// ============================================================
// StructureAddBetweenPanel.tsx
// ============================================================
// Inserts a new intermediate category level between a selected
// non-leaf category and ALL of its direct children (Scenario A).
//
// Example:
//   BEFORE: Gym (L2) > [Strength (L3), Cardio (L3)]
//   AFTER:  Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
//
// Events are NOT touched — leaf events keep category_id and chain_key.
// New sessions pick up the new parent via buildParentChainIds().
// Old sessions simply lack the new parent event (acceptable).
//
// DB operations:
//   1. INSERT new category (level = parent.level + 1)
//   2. UPDATE direct children (new parent + level++)
//   3. UPDATE deeper descendants (level++ only)
//
// Replaces the AddBetweenModal placeholder in StructureTableView.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureAddBetweenPanelProps {
  parentNode: StructureNode;   // the non-leaf category to insert below
  allNodes: StructureNode[];   // full unfiltered node list
  userId: string;
  onClose: () => void;
  onCreated: (newNodeId: string) => void;
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

/** BFS: collect all descendants of directChildren (not including them). */
function collectDeeperDescendants(
  directChildren: StructureNode[],
  allNodes: StructureNode[],
): StructureNode[] {
  const queue = [...directChildren];
  const result: StructureNode[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    const children = allNodes.filter(
      n => n.nodeType === 'category' && n.category?.parent_category_id === current.id,
    );
    for (const child of children) {
      result.push(child);
      queue.push(child);
    }
  }
  return result;
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

export function StructureAddBetweenPanel({
  parentNode,
  allNodes,
  userId,
  onClose,
  onCreated,
}: StructureAddBetweenPanelProps) {
  const t = THEME.structureEdit;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [saving, onClose]);

  const slug = generateSlug(name);

  // Direct children of parentNode
  const directChildren = allNodes.filter(
    n => n.nodeType === 'category' && n.category?.parent_category_id === parentNode.id,
  );

  // Max descendant level (for level limit check)
  const deeperDescendants = collectDeeperDescendants(directChildren, allNodes);
  const allDescendants = [...directChildren, ...deeperDescendants];
  const maxDescendantLevel = allDescendants.reduce((max, n) => Math.max(max, n.level), 0);
  const levelLimitExceeded = maxDescendantLevel + 1 > 10;

  // ── Save handler ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || levelLimitExceeded) return;

    setSaving(true);
    setError(null);

    try {
      const newId = crypto.randomUUID();
      const newLevel = parentNode.level + 1;

      // 1. INSERT new category
      const { error: insertErr } = await supabase
        .from('categories')
        .insert({
          id: newId,
          user_id: userId,
          area_id: parentNode.areaId,
          parent_category_id: parentNode.id,
          name: trimmedName,
          slug: slug || generateSlug(trimmedName),
          level: newLevel,
          sort_order: 10,
        });
      if (insertErr) throw insertErr;

      // 2. UPDATE direct children (re-parent + level++)
      for (const child of directChildren) {
        const { error: childErr } = await supabase
          .from('categories')
          .update({ parent_category_id: newId, level: child.level + 1 })
          .eq('id', child.id)
          .eq('user_id', userId);
        if (childErr) throw childErr;
      }

      // 3. UPDATE deeper descendants (level++ only)
      for (const desc of deeperDescendants) {
        const { error: descErr } = await supabase
          .from('categories')
          .update({ level: desc.level + 1 })
          .eq('id', desc.id)
          .eq('user_id', userId);
        if (descErr) throw descErr;
      }

      onCreated(newId);
    } catch (err) {
      console.error('StructureAddBetweenPanel: save failed', err);
      setError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  }, [name, slug, parentNode, userId, directChildren, deeperDescendants, levelLimitExceeded, onCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !saving && !levelLimitExceeded) {
      handleSave();
    }
  };

  const childrenSummary = directChildren.map(c => c.name).join(', ') || '—';
  const newLevel = parentNode.level + 1;
  const canSave = name.trim().length > 0 && !levelLimitExceeded && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className={cn('flex items-center justify-between px-5 py-4', t.headerBg)}>
          <h3 className={cn('text-base font-semibold', t.headerText)}>
            ↕️ Add Category Between
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              t.accent,
              saving && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4">

          {/* Level limit error */}
          {levelLimitExceeded && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Cannot insert — hierarchy would exceed max depth (10).
              The deepest child is already at level {maxDescendantLevel}.
            </div>
          )}

          {/* Scope info box */}
          <div className={cn('text-sm px-3 py-2.5 rounded-lg space-y-1', t.light, t.lightText)}>
            <div>
              Inserting{' '}
              <span className="font-semibold">{name.trim() || '[name]'}</span>
              {' '}between{' '}
              <span className="font-semibold">{parentNode.name}</span>
              {' '}(L{parentNode.level}) and its {directChildren.length}{' '}
              {directChildren.length === 1 ? 'child' : 'children'} → Level {newLevel}
            </div>
            <div className="text-xs text-gray-500">
              Children that will move: {childrenSummary}
            </div>
          </div>

          {/* Name input */}
          {!levelLimitExceeded && (
            <div>
              <label className={cn('block text-sm font-medium mb-1', t.lightText)}>
                New Category Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                disabled={saving}
                placeholder="e.g. Upper Body"
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors',
                  t.ring,
                  'border-amber-300 focus:border-amber-400',
                  saving && 'opacity-50',
                )}
              />
              <p className="mt-1 text-xs text-gray-400">
                Slug: <span className="font-mono text-gray-500">{slug || '—'}</span>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Error: {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          {levelLimitExceeded ? (
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
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-amber-700 hover:bg-amber-800 text-white',
                  !canSave && 'opacity-50 cursor-not-allowed',
                )}
              >
                {saving && <Spinner />}
                {saving ? 'Saving…' : 'Insert Level'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
