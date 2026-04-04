// ============================================================
// StructureTableView.tsx
// ============================================================
// Main table component for the Structure tab.
// Renders a hierarchical node list — one CategoryChainRow per
// StructureNode (Area + every category level) in DFS order.
//
// S19 additions:
//   - Index-based panel state (activePanelIndex)
//   - highlightedNodeId: 3-second auto-clear + scroll-to-row
//   - StructureNodeEditPanel wired
//   - Edit Mode functional (isEditMode prop from AppHome)
//
// S22 additions:
//   - StructureDeleteModal: cascade delete with blocked/allowed states
//   - StructureAddChildPanel: unified "+ Add Child" on all node types
//   - CategoryChainRow uses unified onAddChild callback
//   - CategoryDetailPanel receives onDelete + isEditMode
//
// S23 fixes:
//   - After delete/add: dispatch 'areas-changed' CustomEvent so
//     ProgressiveCategorySelector refetches the Area dropdown.
//   - After area delete: if deleted area was selected in filter,
//     call filter.reset() to avoid stale area in dropdown.
//
// S24 additions:
//   - StructureAddAreaPanel: "+ Add Area" button in Edit Mode toolbar.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useFilter } from '@/context/FilterContext';
import { useStructureData, filterStructureNodes } from '@/hooks/useStructureData';
import { CategoryChainRow } from './CategoryChainRow';
import { CategoryDetailPanel } from './CategoryDetailPanel';
import { StructureNodeEditPanel } from './StructureNodeEditPanel';
import { StructureDeleteModal } from './StructureDeleteModal';
import { StructureAddChildPanel } from './StructureAddChildPanel';
import { StructureAddAreaPanel } from './StructureAddAreaPanel';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureTableViewProps {
  isEditMode: boolean;
  /** Increment to force a full data refetch and close any open panel */
  refreshKey?: number;
}

// --------------------------------------------------------
// Panel mode — which panel is open (if any)
// --------------------------------------------------------
type PanelMode = 'view' | 'edit' | null;

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
          To restructure your hierarchy, please use the Export function to back up your data first.
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
      <div className="flex-shrink-0 w-8" />
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

export function StructureTableView({ isEditMode, refreshKey }: StructureTableViewProps) {
  const t = THEME.structure;
  const { filter, reset: resetFilter, sharedContext } = useFilter();
  const { nodes, loading, error, refetch } = useStructureData();

  // ---- Panel state ----
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activePanelIndex, setActivePanelIndex] = useState<number | null>(null);

  // ---- Delete modal state ----
  const [deleteNode, setDeleteNode] = useState<StructureNode | null>(null);

  // ---- Add Child panel state ----
  const [addChildParent, setAddChildParent] = useState<StructureNode | null>(null);

  // ---- Add Between placeholder ----
  const [addBetweenNode, setAddBetweenNode] = useState<StructureNode | null>(null);

  // ---- Add Area panel state ----
  const [showAddArea, setShowAddArea] = useState(false);

  // ---- Current user ID (needed for Add Child insert) ----
  const [userId, setUserId] = useState<string>('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // When parent signals a data refresh (e.g. after import), refetch and close panel
  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;
    setActivePanelIndex(null);
    setPanelMode(null);
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ---- Highlight state ----
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightedNodeId) return;
    const timer = setTimeout(() => setHighlightedNodeId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedNodeId]);

  useEffect(() => {
    if (!highlightedNodeId || loading) return;
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightedNodeId, loading]);

  // ---- Filter nodes ----
  const filtered = filterStructureNodes(
    nodes,
    filter.areaId ?? null,
    filter.categoryId ?? null,
  );

  // ---- Panel helpers ----
  const activeNode = activePanelIndex !== null ? filtered[activePanelIndex] ?? null : null;

  const openView = useCallback((node: StructureNode) => {
    const idx = filtered.findIndex(n => n.id === node.id);
    if (idx >= 0) { setActivePanelIndex(idx); setPanelMode('view'); }
  }, [filtered]);

  const openEdit = useCallback((node: StructureNode) => {
    const idx = filtered.findIndex(n => n.id === node.id);
    if (idx >= 0) { setActivePanelIndex(idx); setPanelMode('edit'); }
  }, [filtered]);

  const closePanel = useCallback((highlightId?: string) => {
    setPanelMode(null);
    if (highlightId) {
      setHighlightedNodeId(highlightId);
    } else if (activeNode) {
      setHighlightedNodeId(activeNode.id);
    }
    setActivePanelIndex(null);
  }, [activeNode]);

  const handleNavigate = useCallback((newIndex: number) => {
    setActivePanelIndex(newIndex);
    setPanelMode('view');
  }, []);

  const handleEditSaved = useCallback(async (nodeId: string) => {
    await refetch();
    closePanel(nodeId);
  }, [refetch, closePanel]);

  // ---- Delete callbacks ----
  const handleDeleted = useCallback(async (deletedId: string) => {
    setDeleteNode(null);
    setPanelMode(null);
    setActivePanelIndex(null);

    // Notify Area dropdown to refresh
    window.dispatchEvent(new CustomEvent('areas-changed'));

    // If the deleted node was the currently filtered area, reset filter
    if (filter.areaId === deletedId) {
      resetFilter();
    }

    await refetch();
  }, [refetch, filter.areaId, resetFilter]);

  // ---- Add Child callbacks ----
  const handleChildCreated = useCallback(async (newNodeId: string) => {
    setAddChildParent(null);

    // Notify Area dropdown to refresh (new area child or category under new area)
    window.dispatchEvent(new CustomEvent('areas-changed'));

    await refetch();
    setHighlightedNodeId(newNodeId);
  }, [refetch]);

  // ---- Add Area callbacks ----
  const handleAreaCreated = useCallback(async (newAreaId: string) => {
    setShowAddArea(false);

    // Notify Area dropdown to refresh
    window.dispatchEvent(new CustomEvent('areas-changed'));

    await refetch();
    setHighlightedNodeId(newAreaId);
  }, [refetch]);

  // --------------------------------------------------------
  // Loading / error / empty states
  // --------------------------------------------------------

  if (loading) {
    return <div><TableHeader /><LoadingSkeleton /></div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-600 mb-2">Failed to load structure data</p>
        <p className="text-xs text-gray-400">{error.message}</p>
      </div>
    );
  }

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
      {/* ── Edit Mode toolbar ── */}
      {isEditMode && (
        <div className="flex items-center justify-end px-4 py-2 border-b border-amber-100 bg-amber-50/50">
          <button
            onClick={() => setShowAddArea(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              'bg-amber-700 hover:bg-amber-800 text-white',
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Area
          </button>
        </div>
      )}

      <TableHeader />

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {filtered.map((node) => {
          const isHighlighted = node.id === highlightedNodeId;
          return (
            <div
              key={node.id}
              ref={isHighlighted ? highlightRef : undefined}
            >
              <CategoryChainRow
                node={node}
                isEditMode={isEditMode}
                isHighlighted={isHighlighted}
                onView={openView}
                onEdit={openEdit}
                onDelete={isEditMode ? setDeleteNode : undefined}
                onAddChild={isEditMode ? setAddChildParent : undefined}
                onAddBetween={setAddBetweenNode}
                sharedContext={sharedContext}
              />
            </div>
          );
        })}
      </div>

      {/* ---- View Panel Modal ---- */}
      {panelMode === 'view' && activeNode && (
        <CategoryDetailPanel
          node={activeNode}
          allNodes={nodes}
          filteredNodes={filtered}
          currentIndex={activePanelIndex!}
          onClose={() => closePanel()}
          onNavigate={handleNavigate}
          onEdit={(n) => openEdit(n)}
          onDelete={isEditMode ? setDeleteNode : undefined}
          isEditMode={isEditMode}
        />
      )}

      {/* ---- Edit Panel Modal ---- */}
      {panelMode === 'edit' && activeNode && (
        <StructureNodeEditPanel
          node={activeNode}
          allNodes={nodes}
          onClose={() => closePanel()}
          onSwitchToView={() => setPanelMode('view')}
          onSaved={handleEditSaved}
        />
      )}

      {/* ---- Delete Modal ---- */}
      {deleteNode && (
        <StructureDeleteModal
          node={deleteNode}
          allNodes={nodes}
          onClose={() => setDeleteNode(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* ---- Add Child Panel ---- */}
      {addChildParent && userId && (
        <StructureAddChildPanel
          parentNode={addChildParent}
          allNodes={nodes}
          userId={userId}
          onClose={() => setAddChildParent(null)}
          onCreated={handleChildCreated}
        />
      )}

      {/* ---- Add Between Placeholder Modal ---- */}
      {addBetweenNode && (
        <AddBetweenModal
          node={addBetweenNode}
          onClose={() => setAddBetweenNode(null)}
        />
      )}

      {/* ---- Add Area Panel ---- */}
      {showAddArea && userId && (
        <StructureAddAreaPanel
          allNodes={nodes}
          userId={userId}
          onClose={() => setShowAddArea(false)}
          onCreated={handleAreaCreated}
        />
      )}
    </div>
  );
}

