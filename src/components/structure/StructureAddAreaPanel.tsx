// ============================================================
// StructureAddAreaPanel.tsx
// ============================================================
// Amber modal for creating a new top-level Area (S24).
//
// Accessible via "+ Add Area" button in Structure Edit Mode toolbar.
// Inserts into `areas` table with user_id, name, slug, sort_order.
// sort_order = max existing area sort_order + 10.
//
// After create: onCreated(newAreaId) → StructureTableView refetches
// + dispatches 'areas-changed' to refresh Activity Area dropdown.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureAddAreaPanelProps {
  allNodes: StructureNode[];
  userId: string;
  onClose: () => void;
  onCreated: (newAreaId: string) => void;
}

// --------------------------------------------------------
// Slug generation
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

export function StructureAddAreaPanel({
  allNodes,
  userId,
  onClose,
  onCreated,
}: StructureAddAreaPanelProps) {
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

  // ── Compute sort_order: max area sort_order + 10 ──────────
  const computeSortOrder = useCallback((): number => {
    const areas = allNodes.filter(n => n.nodeType === 'area');
    const maxSort = areas.reduce((max, n) => Math.max(max, n.sortOrder), 0);
    return maxSort + 10;
  }, [allNodes]);

  // ── Create handler ────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    setError(null);

    try {
      const newId = crypto.randomUUID();
      const sortOrder = computeSortOrder();
      const areaSlug = slug || generateSlug(trimmedName);

      const { error: insertErr } = await supabase.from('areas').insert({
        id: newId,
        user_id: userId,
        name: trimmedName,
        slug: areaSlug,
        sort_order: sortOrder,
      });

      if (insertErr) throw insertErr;

      onCreated(newId);
    } catch (err) {
      console.error('StructureAddAreaPanel: create failed', err);
      setError(err instanceof Error ? err.message : 'Create failed. Please try again.');
      setCreating(false);
    }
  }, [name, slug, userId, computeSortOrder, onCreated]);

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
            + Add New Area
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
        <div className="px-5 py-4 space-y-4">

          {/* Info line */}
          <div className={cn('text-sm px-3 py-2 rounded-lg', t.light, t.lightText)}>
            Creates a new top-level Area (root of a hierarchy).
          </div>

          {/* Name input */}
          <div>
            <label className={cn('block text-sm font-medium mb-1', t.lightText)}>
              Area Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              disabled={creating}
              placeholder="e.g. Health"
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

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
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
        </div>

      </div>
    </div>
  );
}
