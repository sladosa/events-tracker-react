// ============================================================
// StructureTableView.tsx
// ============================================================
// Main table component for the Structure tab.
// Renders a hierarchical node list — one CategoryChainRow per
// StructureNode (Area + every category level) in DFS order.
//
// S19 additions:
//   - Index-based panel state (detailNodeIndex) instead of node ref
//     → enables Prev/Next navigation within CategoryDetailPanel
//   - highlightedNodeId: 3-second auto-clear, scroll-to-row
//     (same pattern as ActivitiesTable) — triggered after panel close or edit save
//   - StructureNodeEditPanel wired: onEdit opens it, onSaved triggers refetch + highlight
//   - onDelete → placeholder modal until S20 Excel-backup flow
//   - Edit Mode functional (isEditMode prop from AppHome)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useFilter } from '@/context/FilterContext';
import { useStructureData, filterStructureNodes } from '@/hooks/useStructureData';
import { CategoryChainRow } from './CategoryChainRow';
import { CategoryDetailPanel } from './CategoryDetailPanel';
import { StructureNodeEditPanel } from './StructureNodeEditPanel';
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
  const { filter } = useFilter();
  const { nodes, loading, error, refetch } = useStructureData();

  // ---- Panel state ----
  // Index into `filtered` array (not `nodes`) so Prev/Next stays within current filter
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activePanelIndex, setActivePanelIndex] = useState<number | null>(null);

  // When parent signals a data refresh (e.g. after import), refetch and close panel
  // so the user sees fresh data without stale detail panel
  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;
    setActivePanelIndex(null);
    setPanelMode(null);
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // "Add Between" placeholder modal
  const [addBetweenNode, setAddBetweenNode] = useState<StructureNode | null>(null);

  // ---- Highlight state (same pattern as ActivitiesTable) ----
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Auto-clear highlight after 3s
  useEffect(() => {
    if (!highlightedNodeId) return;
    const timer = setTimeout(() => setHighlightedNodeId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedNodeId]);

  // Scroll to highlighted row when it appears
  useEffect(() => {
    if (!highlightedNodeId || loading) return;
    const ref = highlightRef.current;
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    if (idx >= 0) {
      setActivePanelIndex(idx);
      setPanelMode('view');
    }
  }, [filtered]);

  const openEdit = useCallback((node: StructureNode) => {
    const idx = filtered.findIndex(n => n.id === node.id);
    if (idx >= 0) {
      setActivePanelIndex(idx);
      setPanelMode('edit');
    }
  }, [filtered]);

  const closePanel = useCallback((highlightId?: string) => {
    setPanelMode(null);
    // Highlight the row that was being viewed/edited
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

  // After edit save: refetch data, close panel, highlight row
  const handleEditSaved = useCallback(async (nodeId: string) => {
    await refetch();
    closePanel(nodeId);
  }, [refetch, closePanel]);

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
      <TableHeader />

      {/* Node rows — internal scroll so filter + controls stay visible */}
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
                onDelete={(_n) => {
                  alert(
                    'Delete functionality coming in a future version.\n' +
                    'An Excel backup will be created automatically before any deletion.'
                  );
                }}
                onAddCategory={(_n) => { /* S20 */ }}
                onAddLeaf={(_n) => { /* S20 */ }}
                onAddBetween={setAddBetweenNode}
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
        />
      )}

      {/* ---- Edit Panel Modal ---- */}
      {panelMode === 'edit' && activeNode && (
        <StructureNodeEditPanel
          node={activeNode}
          onClose={() => closePanel()}
          onSwitchToView={() => setPanelMode('view')}
          onSaved={handleEditSaved}
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
