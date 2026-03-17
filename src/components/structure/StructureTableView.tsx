// ============================================================
// StructureTableView.tsx
// ============================================================
// Main table component for the Structure tab.
// Renders a hierarchical node list — one CategoryChainRow per
// StructureNode (Area + every category level) in DFS order.
//
// Data: useStructureData() → filtered by FilterContext selection
// States managed here:
//   - detailNode: CategoryDetailPanel open/close
//   - addBetweenNode: "Add Between" placeholder modal
//   - S18/S19 edit stubs: passed through from props
// ============================================================

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useFilter } from '@/context/FilterContext';
import { useStructureData, filterStructureNodes } from '@/hooks/useStructureData';
import { CategoryChainRow } from './CategoryChainRow';
import { CategoryDetailPanel } from './CategoryDetailPanel';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureTableViewProps {
  /** True when Edit Mode is active (S18 stub — no edit ops implemented yet) */
  isEditMode: boolean;
}

// --------------------------------------------------------
// "Add Between" placeholder modal
// --------------------------------------------------------

function AddBetweenModal({ node, onClose }: { node: StructureNode; onClose: () => void }) {
  const t = THEME.structure;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className={cn('text-base font-semibold mb-3', t.lightText)}>
          Add Category Between
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{node.fullPath}</span>
        </p>
        <p className="text-sm text-gray-500 mb-5">
          Inserting a category between existing levels is planned for a future version.
          To restructure your hierarchy, please use the Export function to back up your
          data first.
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', t.cancelBtn)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Header row (desktop only)
// --------------------------------------------------------

function TableHeader() {
  return (
    <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
      <div className="flex-1">Category Path</div>
      <div className="w-20 text-right">Attrs</div>
      <div className="flex-shrink-0 w-8" /> {/* Actions column spacer */}
    </div>
  );
}

// --------------------------------------------------------
// Loading skeleton
// --------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-12 bg-gray-100 rounded-lg animate-pulse"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function StructureTableView({ isEditMode }: StructureTableViewProps) {
  const t = THEME.structure;
  const { filter } = useFilter();
  const { nodes, loading, error } = useStructureData();

  // Detail panel state
  const [detailNode, setDetailNode] = useState<StructureNode | null>(null);

  // "Add Between" placeholder modal state
  const [addBetweenNode, setAddBetweenNode] = useState<StructureNode | null>(null);

  // --------------------------------------------------------
  // Filter nodes based on FilterContext selection
  // --------------------------------------------------------
  const filtered = filterStructureNodes(
    nodes,
    filter.areaId ?? null,
    filter.categoryId ?? null,
  );

  // --------------------------------------------------------
  // Loading state
  // --------------------------------------------------------
  if (loading) {
    return (
      <div>
        <TableHeader />
        <LoadingSkeleton />
      </div>
    );
  }

  // --------------------------------------------------------
  // Error state
  // --------------------------------------------------------
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-600 mb-2">Failed to load structure data</p>
        <p className="text-xs text-gray-400">{error.message}</p>
      </div>
    );
  }

  // --------------------------------------------------------
  // Empty state
  // --------------------------------------------------------
  if (filtered.length === 0) {
    return (
      <div>
        <TableHeader />
        <div className="py-16 text-center text-gray-400">
          <div className={cn('w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center', t.light)}>
            <svg className={cn('w-6 h-6', t.lightText)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-sm">No categories found</p>
          <p className="text-xs mt-1 text-gray-300">
            {nodes.length === 0
              ? 'No categories have been created yet'
              : 'No categories match the current filter'}
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------
  return (
    <div>
      <TableHeader />

      {/* Node rows */}
      <div>
        {filtered.map(node => (
          <CategoryChainRow
            key={node.id}
            node={node}
            isEditMode={isEditMode}
            onView={setDetailNode}
            // S18 stubs — callbacks passed but no-op until S18
            onEdit={(_n) => { /* S18 */ }}
            onDelete={(_n) => { /* S19 */ }}
            onAddCategory={(_n) => { /* S18 */ }}
            onAddLeaf={(_n) => { /* S18 */ }}
            onAddBetween={setAddBetweenNode}
          />
        ))}
      </div>

      {/* Row count footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {filtered.length} node{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== nodes.length && (
            <span className="ml-1">(filtered from {nodes.length})</span>
          )}
        </span>
        {isEditMode && (
          <span className={cn('text-xs px-2 py-0.5 rounded font-medium', t.badgeAttrs)}>
            Edit Mode — operations coming in S18
          </span>
        )}
      </div>

      {/* ---- Detail Panel Modal ---- */}
      {detailNode && (
        <CategoryDetailPanel
          node={detailNode}
          allNodes={nodes}
          onClose={() => setDetailNode(null)}
        />
      )}

      {/* ---- Add Between Placeholder Modal ---- */}
      {addBetweenNode && (
        <AddBetweenModal
          node={addBetweenNode}
          onClose={() => setAddBetweenNode(null)}
        />
      )}
    </div>
  );
}
