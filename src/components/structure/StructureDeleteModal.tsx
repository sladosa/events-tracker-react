// ============================================================
// StructureDeleteModal.tsx
// ============================================================
// Delete confirmation modal for Structure tab (S22).
//
// Two states based on node.eventCount:
//
//  BLOCKED (eventCount > 0):
//    Orange header + lock icon.
//    "N events exist. Full backup required — coming in next version."
//    Only "OK" button, no Delete.
//
//  ALLOWED (eventCount = 0):
//    Red header + trash icon.
//    Shows node name, sub-category count, attribute count.
//    "Cancel" + "Delete" buttons.
//    Cascade delete order (leaf-first):
//      1. DELETE attribute_definitions WHERE category_id IN subtreeIds
//      2. DELETE categories grouped by level DESC
//      3. If Area: DELETE areas WHERE id = areaId
//
//  Subtree IDs: BFS from root node through allNodes array
//  (no extra DB query needed).
//
// After successful delete:
//   onDeleted(deletedId) is called → StructureTableView refetches.
// ============================================================

import { useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabaseClient';
import { exportFullBackup, fullBackupFilename } from '@/lib/excelBackup';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureDeleteModalProps {
  node: StructureNode;
  allNodes: StructureNode[];
  onClose: () => void;
  onDeleted: (deletedId: string) => void;
}

// --------------------------------------------------------
// BFS helper — collect node + all descendants
// --------------------------------------------------------

function collectSubtreeIds(root: StructureNode, allNodes: StructureNode[]): string[] {
  const ids: string[] = [];
  const queue: string[] = [root.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.push(current);

    // Find children: categories whose parentCategoryId === current
    const children = allNodes.filter(
      n => n.nodeType === 'category' && n.parentCategoryId === current,
    );
    for (const child of children) queue.push(child.id);

    // If current is an Area node, also collect its L1 categories
    if (root.nodeType === 'area' && current === root.id) {
      const l1s = allNodes.filter(
        n => n.nodeType === 'category' && n.areaId === root.id && n.parentCategoryId === null,
      );
      for (const l1 of l1s) {
        if (!queue.includes(l1.id) && !ids.includes(l1.id)) {
          queue.push(l1.id);
        }
      }
    }
  }

  return ids;
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// --------------------------------------------------------
// Spinner
// --------------------------------------------------------

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

export function StructureDeleteModal({
  node,
  allNodes,
  onClose,
  onDeleted,
}: StructureDeleteModalProps) {
  const t = THEME.structureEdit;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBlocked = node.eventCount > 0;

  // ── Phase label for UX feedback ────────────────────────────────────────────
  type Phase = 'idle' | 'backup' | 'deleting';
  const [phase, setPhase] = useState<Phase>('idle');

  // Compute subtree info for display
  const subtreeIds = collectSubtreeIds(node, allNodes);
  // Exclude the root node itself from "sub-category" count
  const subCategoryIds = subtreeIds.filter(id => id !== node.id);
  const subCategoryCount = node.nodeType === 'area'
    ? subCategoryIds.length  // all descendants under area
    : subCategoryIds.length; // sub-categories under this category

  // Count attribute definitions in the whole subtree
  const attrCount = allNodes
    .filter(n => subtreeIds.includes(n.id))
    .reduce((sum, n) => sum + n.attrCount, 0);

  /** Cascade delete structure + (optionally) events under the subtree. */
  const cascadeDelete = useCallback(async (includeEvents: boolean) => {
    const categoryIds = allNodes
      .filter(n => subtreeIds.includes(n.id) && n.nodeType === 'category')
      .map(n => n.id);

    if (categoryIds.length > 0) {
      if (includeEvents) {
        // ── Delete events and their dependent rows ─────────────────────────
        const { data: events } = await supabase
          .from('events')
          .select('id')
          .in('category_id', categoryIds);

        if (events && events.length > 0) {
          const eventIds = (events as { id: string }[]).map(e => e.id);

          // Delete storage attachments
          const { data: attachments } = await supabase
            .from('event_attachments')
            .select('url')
            .in('event_id', eventIds);

          if (attachments && attachments.length > 0) {
            const paths = (attachments as { url: string }[])
              .map(a => { const p = a.url.split('/activity-attachments/'); return p.length > 1 ? p[1] : null; })
              .filter((p): p is string => p !== null);
            if (paths.length > 0) {
              await supabase.storage.from('activity-attachments').remove(paths);
            }
          }

          await supabase.from('event_attachments').delete().in('event_id', eventIds);
          await supabase.from('event_attributes').delete().in('event_id', eventIds);

          const { error: evErr } = await supabase.from('events').delete().in('id', eventIds);
          if (evErr) throw evErr;
        }
      }

      // ── Delete attribute_definitions ──────────────────────────────────────
      const { error: attrErr } = await supabase
        .from('attribute_definitions')
        .delete()
        .in('category_id', categoryIds);
      if (attrErr) throw attrErr;

      // ── Delete categories: deepest level first ────────────────────────────
      const byLevel = new Map<number, string[]>();
      for (const n of allNodes.filter(n => categoryIds.includes(n.id))) {
        const existing = byLevel.get(n.level) ?? [];
        existing.push(n.id);
        byLevel.set(n.level, existing);
      }
      const levels = [...byLevel.keys()].sort((a, b) => b - a);
      for (const level of levels) {
        const ids = byLevel.get(level)!;
        const { error: catErr } = await supabase.from('categories').delete().in('id', ids);
        if (catErr) throw catErr;
      }
    }

    // ── Delete area if root is an area ────────────────────────────────────────
    if (node.nodeType === 'area') {
      const { error: areaErr } = await supabase.from('areas').delete().eq('id', node.id);
      if (areaErr) throw areaErr;
    }
  }, [node, allNodes, subtreeIds]);

  /** ALLOWED path — no events, straight delete. */
  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await cascadeDelete(false);
      onDeleted(node.id);
    } catch (err) {
      console.error('StructureDeleteModal: delete failed', err);
      setError(err instanceof Error ? err.message : 'Delete failed. Please try again.');
      setDeleting(false);
    }
  }, [cascadeDelete, node.id, onDeleted]);

  /** BLOCKED path — backup first, then full cascade delete including events. */
  const handleDeleteWithBackup = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      // 1. Full backup download
      setPhase('backup');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const buffer = await exportFullBackup(user.id);
      saveAs(new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }), fullBackupFilename());

      // 2. Cascade delete (events + structure)
      setPhase('deleting');
      await cascadeDelete(true);
      onDeleted(node.id);
    } catch (err) {
      console.error('StructureDeleteModal: delete-with-backup failed', err);
      setError(err instanceof Error ? err.message : 'Operation failed. Please try again.');
      setDeleting(false);
      setPhase('idle');
    }
  }, [cascadeDelete, node.id, onDeleted]);

  const headerBg = isBlocked ? 'bg-amber-600' : 'bg-red-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className={cn('flex items-center gap-3 px-5 py-4 text-white', headerBg)}>
          {isBlocked ? <LockIcon /> : <TrashIcon />}
          <div>
            <h3 className="text-base font-semibold">
              {'Delete ' + (node.nodeType === 'area' ? 'Area' : 'Category')}
            </h3>
            <p className="text-sm opacity-90 truncate max-w-xs">{node.name}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4">

          {isBlocked ? (
            /* ── BLOCKED → backup-then-delete state ── */
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-amber-700">
                  {node.eventCount} {node.eventCount === 1 ? 'event exists' : 'events exist'}
                </span>{' '}
                under this {node.nodeType === 'area' ? 'area' : 'category'}.
              </p>
              <p className="text-sm text-gray-600">
                A <span className="font-medium">full backup</span> (all events + structure) will be
                downloaded automatically before everything is permanently deleted.
              </p>
              <ul className="text-sm text-gray-600 space-y-1 pl-4">
                <li>• All events under <span className="font-medium">{node.name}</span></li>
                {subCategoryCount > 0 && (
                  <li>• {subCategoryCount} sub-{subCategoryCount === 1 ? 'category' : 'categories'}</li>
                )}
                {attrCount > 0 && (
                  <li>• {attrCount} attribute {attrCount === 1 ? 'definition' : 'definitions'}</li>
                )}
              </ul>
              <p className="text-sm text-red-600 font-medium">
                This action cannot be undone.
              </p>
              {deleting && (
                <p className="text-sm text-amber-700 font-medium">
                  {phase === 'backup' ? '⏳ Generating backup…' : '🗑 Deleting…'}
                </p>
              )}
              {error && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* ── ALLOWED state ── */
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                The following will be permanently deleted:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 pl-4">
                <li>• <span className="font-medium">{node.name}</span></li>
                {subCategoryCount > 0 && (
                  <li>• {subCategoryCount} sub-{subCategoryCount === 1 ? 'category' : 'categories'}</li>
                )}
                {attrCount > 0 && (
                  <li>• {attrCount} attribute {attrCount === 1 ? 'definition' : 'definitions'}</li>
                )}
              </ul>
              <p className="text-sm text-red-600 font-medium">
                This action cannot be undone.
              </p>

              {error && (
                <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          {isBlocked ? (
            <>
              <button
                onClick={onClose}
                disabled={deleting}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  t.cancelBtn,
                  deleting && 'opacity-50 cursor-not-allowed',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWithBackup}
                disabled={deleting}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-amber-600 text-white hover:bg-amber-700',
                  deleting && 'opacity-60 cursor-not-allowed',
                )}
              >
                {deleting && <Spinner />}
                {deleting
                  ? (phase === 'backup' ? 'Backing up…' : 'Deleting…')
                  : 'Download Backup & Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={deleting}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  t.cancelBtn,
                  deleting && 'opacity-50 cursor-not-allowed',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  t.deleteBtn,
                  deleting && 'opacity-60 cursor-not-allowed',
                )}
              >
                {deleting && <Spinner />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
