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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useFilter } from '@/context/FilterContext';
import { useStructureData, filterStructureNodes } from '@/hooks/useStructureData';

export type NodeFilter = 'mine' | 'all' | 'templates';
import { TEMPLATE_USER_ID } from '@/lib/constants';
export { TEMPLATE_USER_ID };
import { CategoryChainRow } from './CategoryChainRow';
import { CategoryDetailPanel } from './CategoryDetailPanel';
import { StructureNodeEditPanel } from './StructureNodeEditPanel';
import { StructureDeleteModal } from './StructureDeleteModal';
import { StructureAddChildPanel } from './StructureAddChildPanel';
import { StructureAddAreaPanel } from './StructureAddAreaPanel';
import { StructureAddBetweenPanel } from './StructureAddBetweenPanel';
import { StructureCollapseLevelPanel } from './StructureCollapseLevelPanel';
import { supabase } from '@/lib/supabaseClient';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface StructureTableViewProps {
  isEditMode: boolean;
  /** Increment to force a full data refetch and close any open panel */
  refreshKey?: number;
  /** Owner only: open Share Management modal for an area node (Faza 7) */
  onManageAccess?: (areaId: string, areaName: string) => void;
  /** Mine / All / Templates — controlled from parent (StructureTabContent) */
  nodeFilter: NodeFilter;
}

// --------------------------------------------------------
// Panel mode — which panel is open (if any)
// --------------------------------------------------------
type PanelMode = 'view' | 'edit' | null;

// (AddBetweenModal placeholder removed — replaced by StructureAddBetweenPanel)

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

export function StructureTableView({ isEditMode, refreshKey, onManageAccess, nodeFilter }: StructureTableViewProps) {
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

  // ---- Add Between panel state ----
  const [addBetweenNode, setAddBetweenNode] = useState<StructureNode | null>(null);

  // ---- Collapse Level panel state ----
  const [collapseLevelNode, setCollapseLevelNode] = useState<StructureNode | null>(null);

  // ---- Add Area panel state ----
  const [showAddArea, setShowAddArea] = useState(false);

  // ---- Area collapse state ----
  const [collapsedAreaIds, setCollapsedAreaIds] = useState<Set<string>>(new Set());

  const toggleCollapseArea = useCallback((areaId: string) => {
    setCollapsedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }, []);

  // nodeFilter is controlled by parent; in edit mode parent passes 'mine'

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
  // Slugs of areas the user already owns (used to exclude copied templates)
  const userAreaSlugs = useMemo(
    () => new Set(
      nodes
        .filter(n => n.nodeType === 'area' && n.area.user_id !== TEMPLATE_USER_ID)
        .map(n => n.area.slug),
    ),
    [nodes],
  );

  // Step 1: apply template visibility filter
  const visibleNodes = useMemo(() => {
    if (nodeFilter === 'mine') return nodes.filter(n => n.area.user_id !== TEMPLATE_USER_ID);
    const ownNodes = nodes.filter(n => n.area.user_id !== TEMPLATE_USER_ID);
    // Template areas already copied by this user (matched by slug)
    const copiedTemplateAreaIds = new Set(
      nodes
        .filter(n => n.nodeType === 'area' && n.area.user_id === TEMPLATE_USER_ID && userAreaSlugs.has(n.area.slug))
        .map(n => n.id),
    );
    // Exclude both the area node AND all its category children for copied templates
    const availableTemplateNodes = nodes.filter(
      n => n.area.user_id === TEMPLATE_USER_ID && !copiedTemplateAreaIds.has(n.areaId),
    );
    if (nodeFilter === 'templates') return availableTemplateNodes;
    return [...ownNodes, ...availableTemplateNodes];
  }, [nodes, nodeFilter, userAreaSlugs]);

  // Step 2: apply area/category filter
  const filtered = filterStructureNodes(
    visibleNodes,
    filter.areaId ?? null,
    filter.categoryId ?? null,
  );

  const showTemplateBanner = nodeFilter !== 'mine' &&
    visibleNodes.some(n => n.area.user_id === TEMPLATE_USER_ID);

  // ---- Collapse helpers ----
  // Count how many category rows each area has (used for "N hidden" badge)
  const areaChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of filtered) {
      if (node.nodeType === 'category') {
        counts.set(node.areaId, (counts.get(node.areaId) ?? 0) + 1);
      }
    }
    return counts;
  }, [filtered]);

  // Rows actually rendered — area children hidden when area is collapsed
  const visibleRows = useMemo(
    () => filtered.filter(
      node => node.nodeType === 'area' || !collapsedAreaIds.has(node.areaId),
    ),
    [filtered, collapsedAreaIds],
  );

  const areaNodes = useMemo(() => filtered.filter(n => n.nodeType === 'area'), [filtered]);
  const allCollapsed = areaNodes.length > 0 && areaNodes.every(n => collapsedAreaIds.has(n.id));

  const toggleCollapseAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsedAreaIds(new Set());
    } else {
      setCollapsedAreaIds(new Set(areaNodes.map(n => n.id)));
    }
  }, [allCollapsed, areaNodes]);

  // ---- Panel helpers ----
  const activeNode = activePanelIndex !== null ? visibleRows[activePanelIndex] ?? null : null;

  const openView = useCallback((node: StructureNode) => {
    const idx = visibleRows.findIndex(n => n.id === node.id);
    if (idx >= 0) { setActivePanelIndex(idx); setPanelMode('view'); }
  }, [visibleRows]);

  const openEdit = useCallback((node: StructureNode) => {
    const idx = visibleRows.findIndex(n => n.id === node.id);
    if (idx >= 0) { setActivePanelIndex(idx); setPanelMode('edit'); }
  }, [visibleRows]);

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
  const handleBetweenCreated = useCallback(async (newNodeId: string) => {
    setAddBetweenNode(null);
    window.dispatchEvent(new CustomEvent('areas-changed'));
    await refetch();
    setHighlightedNodeId(newNodeId);
  }, [refetch]);

  const handleCollapsed = useCallback(async () => {
    const parentId = collapseLevelNode?.category?.parent_category_id ?? null;
    setCollapseLevelNode(null);
    window.dispatchEvent(new CustomEvent('areas-changed'));
    await refetch();
    // Highlight the grandparent so user can see where children landed
    if (parentId) setHighlightedNodeId(parentId);
  }, [refetch, collapseLevelNode]);

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

      {/* ── Template banner ── */}
      {showTemplateBanner && (
        <div className="flex items-start gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Template areas are read-only starter templates.
            To use one, enter <strong className="font-semibold">Edit Mode → Add Area → &quot;From template&quot;</strong>.
          </span>
        </div>
      )}

      {/* ── Collapse-all toolbar (only when 2+ areas visible) ── */}
      {areaNodes.length > 1 && (
        <div className="flex items-center justify-end px-4 py-1 border-b border-gray-100 bg-gray-50/60">
          <button
            onClick={toggleCollapseAll}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            title={allCollapsed ? 'Expand all areas' : 'Collapse all areas'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {allCollapsed
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              }
            </svg>
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}

      <TableHeader />

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {visibleRows.map((node) => {
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
                isTemplate={node.area.user_id === TEMPLATE_USER_ID}
                onView={openView}
                onEdit={openEdit}
                onDelete={isEditMode ? setDeleteNode : undefined}
                onAddChild={isEditMode ? setAddChildParent : undefined}
                onAddBetween={isEditMode ? setAddBetweenNode : undefined}
                onCollapseLevel={isEditMode ? setCollapseLevelNode : undefined}
                sharedContext={sharedContext}
                onManageAccess={onManageAccess ? (n) => onManageAccess(n.id, n.name) : undefined}
                isCollapsed={node.nodeType === 'area' ? collapsedAreaIds.has(node.id) : undefined}
                onToggleCollapse={node.nodeType === 'area' ? () => toggleCollapseArea(node.id) : undefined}
                hiddenCount={node.nodeType === 'area' ? (areaChildCounts.get(node.id) ?? 0) : undefined}
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
          filteredNodes={visibleRows}
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

      {/* ---- Add Between Panel ---- */}
      {addBetweenNode && userId && (
        <StructureAddBetweenPanel
          parentNode={addBetweenNode}
          allNodes={nodes}
          userId={userId}
          onClose={() => setAddBetweenNode(null)}
          onCreated={handleBetweenCreated}
        />
      )}

      {/* ---- Collapse Level Panel ---- */}
      {collapseLevelNode && userId && (
        <StructureCollapseLevelPanel
          node={collapseLevelNode}
          allNodes={nodes}
          userId={userId}
          onClose={() => setCollapseLevelNode(null)}
          onCollapsed={handleCollapsed}
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

