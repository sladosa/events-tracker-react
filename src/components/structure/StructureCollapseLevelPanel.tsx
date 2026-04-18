// ============================================================
// StructureCollapseLevelPanel.tsx
// ============================================================
// Removes an intermediate non-leaf category and moves ALL of
// its direct children up to the grandparent (Scenario D).
// This is the inverse of StructureAddBetweenPanel.
//
// Example:
//   BEFORE: Gym (L2) > Upper Body (L3) > [Strength (L4), Cardio (L4)]
//   AFTER:  Gym (L2) > [Strength (L3), Cardio (L3)]
//
// Two code paths:
//
//   Path 1 — 0 attr defs on the node:
//     - Delete empty parent events + re-parent children + delete node.
//
//   Path 2 — has attr defs (merge-down):
//     - Copy attr defs from node to each direct child (skip slug conflicts).
//     - For each parent event on the node, find the corresponding child event
//       and copy the attribute values there.
//     - Then delete events / attr defs / node and re-parent children.
//
// Key invariant: chain_key on parent events = UUID of the LEAF category.
// To find which direct child "owns" a given parent event, we walk up the
// parent_category_id chain from that leaf until we hit a direct child.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureCollapseLevelPanelProps {
  node: StructureNode;         // the non-leaf intermediate category to remove
  allNodes: StructureNode[];   // full unfiltered node list
  userId: string;
  onClose: () => void;
  onCollapsed: () => void;
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

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

/** Check whether ancestorId is an ancestor of descendantId via parent_category_id chain. */
function isAncestorOf(
  ancestorId: string,
  descendantId: string,
  allNodes: StructureNode[],
): boolean {
  let current = allNodes.find(n => n.id === descendantId);
  while (current?.category?.parent_category_id) {
    if (current.category.parent_category_id === ancestorId) return true;
    const parentId = current.category.parent_category_id;
    current = allNodes.find(n => n.id === parentId);
  }
  return false;
}

/**
 * Find which direct child of the collapsing node "owns" the event chain
 * identified by chainKey (= UUID of the leaf category).
 */
function findOwnerChild(
  chainKey: string,
  directChildren: StructureNode[],
  allNodes: StructureNode[],
): StructureNode | null {
  for (const child of directChildren) {
    if (child.id === chainKey) return child;                       // child IS the leaf
    if (isAncestorOf(child.id, chainKey, allNodes)) return child; // child is ancestor of leaf
  }
  return null;
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

export function StructureCollapseLevelPanel({
  node,
  allNodes,
  userId,
  onClose,
  onCollapsed,
}: StructureCollapseLevelPanelProps) {
  const [collapsing, setCollapsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedSlugs, setSkippedSlugs] = useState<string[]>([]);

  // Direct children and deeper descendants
  const directChildren = allNodes.filter(
    n => n.nodeType === 'category' && n.category?.parent_category_id === node.id,
  );
  const deeperDescendants = collectDeeperDescendants(directChildren, allNodes);

  // Grandparent (where children will be re-parented)
  const grandparentId = node.category?.parent_category_id ?? null;
  const grandparentNode = grandparentId
    ? allNodes.find(n => n.id === grandparentId)
    : allNodes.find(n => n.nodeType === 'area' && n.id === node.areaId);
  const grandparentName = grandparentNode?.name ?? '(area root)';

  const hasAttrDefs = node.attributeDefinitions.length > 0;

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !collapsing) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [collapsing, onClose]);

  // ── Collapse handler ──────────────────────────────────
  const handleCollapse = useCallback(async () => {
    setCollapsing(true);
    setError(null);
    setSkippedSlugs([]);

    try {
      const skipped: string[] = [];

      if (hasAttrDefs) {
        // ── PATH 2: merge attr defs + event_attributes down ──────────

        // Fetch attr defs on this node
        const { data: attrDefs, error: adErr } = await supabase
          .from('attribute_definitions')
          .select('*')
          .eq('category_id', node.id)
          .eq('user_id', userId);
        if (adErr) throw adErr;

        // Fetch parent events on this node WITH their event_attributes
        const { data: ubEvents, error: evErr } = await supabase
          .from('events')
          .select('id, chain_key, session_start, event_attributes(*)')
          .eq('category_id', node.id)
          .eq('user_id', userId);
        if (evErr) throw evErr;

        // Step 1: Copy attr defs to each direct child
        // Three cases per (attr def, child) pair:
        //   a) No slug conflict → INSERT new attr def on child, map old id → new id
        //   b) Slug exists, same data_type → skip INSERT (already there), map old id → existing id
        //      so Step 2 still transfers the values to the existing attr def
        //   c) Slug exists, different data_type → incompatible, skip both def and values
        // attrDefIdMap[childId][oldId] = targetId (new or existing)
        const attrDefIdMap = new Map<string, Map<string, string>>();

        for (const child of directChildren) {
          const childMap = new Map<string, string>();
          for (const ad of (attrDefs ?? [])) {
            const existingOnChild = child.attributeDefinitions.find(a => a.slug === ad.slug);
            if (existingOnChild) {
              if (existingOnChild.data_type === ad.data_type) {
                // Compatible: reuse existing attr def for value transfer
                childMap.set(ad.id, existingOnChild.id);
              } else {
                // Incompatible type: skip attr def and values, surface as warning
                if (!skipped.includes(ad.slug)) skipped.push(ad.slug);
              }
              continue;
            }
            // No conflict: create new attr def on child
            const newAttrDefId = crypto.randomUUID();
            const { error: insertAdErr } = await supabase
              .from('attribute_definitions')
              .insert({
                id: newAttrDefId,
                category_id: child.id,
                user_id: userId,
                name: ad.name,
                slug: ad.slug,
                data_type: ad.data_type,
                sort_order: ad.sort_order,
                validation_rules: ad.validation_rules ?? null,
              });
            if (insertAdErr) throw insertAdErr;
            childMap.set(ad.id, newAttrDefId);
          }
          attrDefIdMap.set(child.id, childMap);
        }

        // Step 2: Copy event_attributes to target events
        for (const ubEvent of (ubEvents ?? [])) {
          const eventAttrs = (ubEvent as { event_attributes?: unknown[] }).event_attributes ?? [];
          if (!ubEvent.chain_key || !eventAttrs.length) continue;

          const ownerChild = findOwnerChild(ubEvent.chain_key, directChildren, allNodes);
          if (!ownerChild) continue;

          // Find target event(s) on owner child.
          // Leaf: N events per session allowed — transfer value to ALL of them.
          // Non-leaf: normally 1 parent event per session (P2), but use array
          // instead of maybeSingle() so a silent DB error never skips the transfer.
          // Both branches: filter by chain_key to scope to this leaf's session chain.
          const targetEventIds: string[] = [];
          if (ownerChild.isLeaf) {
            const { data: leafEvts } = await supabase
              .from('events')
              .select('id')
              .eq('category_id', ownerChild.id)
              .eq('session_start', ubEvent.session_start)
              .eq('user_id', userId);
            for (const e of (leafEvts ?? [])) targetEventIds.push((e as { id: string }).id);
          } else {
            const { data: nonLeafEvts } = await supabase
              .from('events')
              .select('id')
              .eq('category_id', ownerChild.id)
              .eq('chain_key', ubEvent.chain_key)
              .eq('session_start', ubEvent.session_start)
              .eq('user_id', userId);
            for (const e of (nonLeafEvts ?? [])) targetEventIds.push((e as { id: string }).id);
          }
          if (targetEventIds.length === 0) continue;

          const childMap = attrDefIdMap.get(ownerChild.id);
          if (!childMap) continue;

          for (const targetEventId of targetEventIds) {
            for (const ea of eventAttrs as Array<{
              attribute_definition_id: string;
              value_text: string | null;
              value_number: number | null;
              value_datetime: string | null;
              value_boolean: boolean | null;
            }>) {
              const newAttrDefId = childMap.get(ea.attribute_definition_id);
              if (!newAttrDefId) continue; // incompatible type skip
              const { error: insertEaErr } = await supabase.from('event_attributes').insert({
                event_id: targetEventId,
                attribute_definition_id: newAttrDefId,
                user_id: userId,
                value_text: ea.value_text ?? null,
                value_number: ea.value_number ?? null,
                value_datetime: ea.value_datetime ?? null,
                value_boolean: ea.value_boolean ?? null,
              });
              if (insertEaErr) throw insertEaErr;
            }
          }
        }

        // Step 3: Delete event_attributes on node's events, then events, then attr defs
        const ubEventIds = (ubEvents ?? []).map((e: { id: string }) => e.id);
        if (ubEventIds.length > 0) {
          await supabase.from('event_attributes').delete().in('event_id', ubEventIds);
          await supabase.from('events')
            .delete().eq('category_id', node.id).eq('user_id', userId);
        }
        await supabase.from('attribute_definitions')
          .delete().eq('category_id', node.id).eq('user_id', userId);

      } else {
        // ── PATH 1: no attr defs — just delete empty parent events ──

        const { data: ubEvents } = await supabase
          .from('events')
          .select('id')
          .eq('category_id', node.id)
          .eq('user_id', userId);

        const ubEventIds = (ubEvents ?? []).map((e: { id: string }) => e.id);
        if (ubEventIds.length > 0) {
          await supabase.from('event_attributes').delete().in('event_id', ubEventIds);
          await supabase.from('events')
            .delete().eq('category_id', node.id).eq('user_id', userId);
        }
      }

      // Step 4: Re-parent direct children (new parent = grandparent, level--)
      for (const child of directChildren) {
        const { error: reparentErr } = await supabase
          .from('categories')
          .update({
            parent_category_id: grandparentId,
            level: child.level - 1,
          })
          .eq('id', child.id)
          .eq('user_id', userId);
        if (reparentErr) throw reparentErr;
      }

      // Step 5: level-- for deeper descendants
      for (const desc of deeperDescendants) {
        const { error: descErr } = await supabase
          .from('categories')
          .update({ level: desc.level - 1 })
          .eq('id', desc.id)
          .eq('user_id', userId);
        if (descErr) throw descErr;
      }

      // Step 6: Delete the node itself
      const { error: deleteErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', node.id)
        .eq('user_id', userId);
      if (deleteErr) throw deleteErr;

      // Surface any slug warnings, then callback
      setSkippedSlugs(skipped);
      if (skipped.length === 0) {
        onCollapsed();
      } else {
        // Stay open briefly to show warnings, then dismiss
        setCollapsing(false);
        // onCollapsed called after user reads warning via OK button
      }
    } catch (err) {
      console.error('StructureCollapseLevelPanel: collapse failed', err);
      setError(err instanceof Error ? err.message : 'Collapse failed. Please try again.');
      setCollapsing(false);
    }
  }, [node, allNodes, userId, directChildren, deeperDescendants, grandparentId, hasAttrDefs, onCollapsed]);

  // ── Determine what to show ────────────────────────────
  const collapsed = skippedSlugs.length > 0 && !collapsing && !error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !collapsing) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-700">
          <h3 className="text-base font-semibold text-white">
            ↑ Collapse Level
          </h3>
          <button
            onClick={onClose}
            disabled={collapsing}
            className={cn(
              'p-1.5 rounded-lg text-red-200 hover:text-white hover:bg-red-600 transition-colors',
              collapsing && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4">

          {collapsed ? (
            /* Post-collapse warning state — only shown when incompatible-type slugs were skipped */
            <div className="space-y-3">
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-semibold mb-1">Level collapsed with warnings</p>
                <p>
                  The following attribute{skippedSlugs.length > 1 ? 's' : ''} could not be
                  reassigned — incompatible data type on some children:
                </p>
                <ul className="mt-1 list-disc list-inside font-mono text-xs">
                  {skippedSlugs.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Scope description */}
              <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <p>
                  Removing <span className="font-semibold">{node.name}</span> —{' '}
                  {directChildren.length === 1
                    ? <><span className="font-semibold">{directChildren[0]?.name}</span> will become a direct child of <span className="font-semibold">{grandparentName}</span>.</>
                    : <>{directChildren.length} children ({directChildren.map(c => c.name).join(', ')}) will become direct children of <span className="font-semibold">{grandparentName}</span>.</>
                  }
                </p>
              </div>

              {/* Attr def reassign notice */}
              {hasAttrDefs && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span className="font-semibold">
                    {node.attributeDefinitions.length} attribute definition
                    {node.attributeDefinitions.length > 1 ? 's' : ''}
                  </span>{' '}
                  will be reassigned down to{' '}
                  <span className="font-semibold">{directChildren.map(c => c.name).join(', ')}</span>.
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  Error: {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-5 pb-4">
          {collapsed ? (
            <button
              onClick={onCollapsed}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={collapsing}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors',
                  collapsing && 'opacity-50 cursor-not-allowed',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleCollapse}
                disabled={collapsing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-red-600 hover:bg-red-700 text-white',
                  collapsing && 'opacity-50 cursor-not-allowed',
                )}
              >
                {collapsing && <Spinner />}
                {collapsing ? 'Collapsing…' : 'Collapse Level'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
