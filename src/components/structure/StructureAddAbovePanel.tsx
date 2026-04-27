// ============================================================
// StructureAddAbovePanel.tsx
// ============================================================
// Inserts a new intermediate category ABOVE a leaf node —
// between the leaf and its current parent (Scenario E).
//
// Example:
//   BEFORE: Health (Area) > Sleep (L1, leaf)
//   AFTER:  Health (Area) > Recovery (L1) > Sleep (L2, leaf)
//
//   BEFORE: Fitness > Gym (L1) > Bench Press (L2, leaf)
//   AFTER:  Fitness > Gym (L1) > Push (L2) > Bench Press (L3, leaf)
//
// Existing events on the leaf are unaffected — they still
// reference the same leaf category_id and chain_key.
// buildParentChainIds() picks up the new parent automatically.
//
// DB operations:
//   1. INSERT new category Y at leaf's current level (same parent as leaf)
//   2. UPDATE leaf: parent_category_id = Y.id, level = leaf.level + 1
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

interface StructureAddAbovePanelProps {
  leafNode: StructureNode;
  allNodes: StructureNode[];
  userId: string;
  onClose: () => void;
  onCreated: (newNodeId: string) => void;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

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

export function StructureAddAbovePanel({
  leafNode,
  allNodes,
  userId,
  onClose,
  onCreated,
}: StructureAddAbovePanelProps) {
  const t = THEME.structureEdit;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [saving, onClose]);

  const slug = generateSlug(name);

  // Find the parent's display name for the info box
  const isL1Leaf = leafNode.level === 1;
  const parentName = isL1Leaf
    ? (allNodes.find(n => n.nodeType === 'area' && n.id === leafNode.areaId)?.name ?? 'Area')
    : (allNodes.find(n => n.id === leafNode.category?.parent_category_id)?.name ?? '—');

  // New category Y gets the leaf's current level; leaf gets level + 1
  const newLevel = leafNode.level;
  const levelLimitExceeded = leafNode.level + 1 > 10;

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || levelLimitExceeded) return;

    setSaving(true);
    setError(null);

    try {
      const newId = crypto.randomUUID();

      // 1. INSERT new category Y at leaf's current level, same parent as leaf
      const { error: insertErr } = await supabase
        .from('categories')
        .insert({
          id: newId,
          user_id: userId,
          area_id: leafNode.areaId,
          parent_category_id: leafNode.category?.parent_category_id ?? null,
          name: trimmedName,
          slug: slug || generateSlug(trimmedName),
          level: newLevel,
          sort_order: 10,
        });
      if (insertErr) throw insertErr;

      // 2. UPDATE leaf: new parent = Y, level++
      const { error: updateErr } = await supabase
        .from('categories')
        .update({ parent_category_id: newId, level: leafNode.level + 1 })
        .eq('id', leafNode.id)
        .eq('user_id', userId);
      if (updateErr) throw updateErr;

      onCreated(newId);
    } catch (err) {
      console.error('StructureAddAbovePanel: save failed', err);
      setError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  }, [name, slug, leafNode, userId, levelLimitExceeded, newLevel, onCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && !saving && !levelLimitExceeded) handleSave();
  };

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
            ⬆️ Add Category Above
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className={cn('p-1.5 rounded-lg transition-colors', t.accent, saving && 'opacity-50 cursor-not-allowed')}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4">

          {levelLimitExceeded && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Cannot insert — leaf is already at level {leafNode.level} and would exceed max depth (10).
            </div>
          )}

          {/* Scope info box */}
          <div className={cn('text-sm px-3 py-2.5 rounded-lg space-y-1', t.light, t.lightText)}>
            <div>
              Inserting{' '}
              <span className="font-semibold">{name.trim() || '[name]'}</span>
              {' '}between{' '}
              <span className="font-semibold">{parentName}</span>
              {' '}and{' '}
              <span className="font-semibold">{leafNode.name}</span>
              {' '}→ Level {newLevel}
            </div>
            <div className="text-xs text-gray-500">
              Only <span className="font-medium">{leafNode.name}</span> moves — siblings are not affected.
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
                placeholder="e.g. Recovery"
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

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Error: {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          {levelLimitExceeded ? (
            <button onClick={onClose} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', t.cancelBtn)}>
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={saving}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', t.cancelBtn, saving && 'opacity-50 cursor-not-allowed')}
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
