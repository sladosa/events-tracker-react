// ============================================================
// StructureSunburstView.tsx
// ============================================================
// Plotly sunburst visualization for the Structure tab.
// Desktop only (hidden on mobile — see AppHome).
//
// Data: useStructureData() → transforms to Plotly format
// Filter sync (bidirectional):
//   - Dropdown → Sunburst: `level` prop focuses the selected subtree
//   - Sunburst → Dropdown: onClick updates FilterContext
//
// Event counts:
//   - Encoded in tooltip (customdata) — NOT in node size
//   - values: Math.max(eventCount, 1) so zero-event nodes remain visible
//
// ⚠️  Requires: npm install react-plotly.js @types/react-plotly.js
//    After installation delete src/types/react-plotly.d.ts stub.
// ============================================================

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useFilter } from '@/context/FilterContext';
import { useStructureData } from '@/hooks/useStructureData';
import type { PlotMouseEvent } from 'plotly.js';
import type { StructureNode } from '@/types/structure';

// --------------------------------------------------------
// Local type: SunburstTrace
// @types/react-plotly.js does not export SunburstTrace directly.
// We define a minimal local version based on Plotly's runtime API.
// --------------------------------------------------------
type SunburstTrace = {
  type: 'sunburst';
  ids: string[];
  labels: string[];
  parents: string[];
  values: number[];
  customdata: string[];
  hovertemplate: string;
  branchvalues: 'remainder' | 'total';  // literal union, not string
  level?: string;
  marker?: { line?: { width: number } };
  textfont?: { size: number };
  insidetextfont?: { size: number };
};


// --------------------------------------------------------
// Helper: build category ID path array from a StructureNode
// Needed by selectAreaAndCategory for ProgressiveCategorySelector.
// e.g. 'Fitness > Activity > Gym > Cardio' → [activityId, gymId, cardioId]
// --------------------------------------------------------
function buildCategoryIdPath(node: StructureNode, allNodes: StructureNode[]): string[] {
  if (node.nodeType === 'area') return [];
  const parts = node.fullPath.split(' > ');
  const path: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).join(' > ');
    const found = allNodes.find(n => n.fullPath === prefix && n.nodeType === 'category');
    if (found) path.push(found.id);
  }
  return path;
}

// --------------------------------------------------------
// Constants
// --------------------------------------------------------

// Indigo-based palette for Plotly (sunburstcolorway)
const SUNBURST_COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
];

// Synthetic root node id
const ROOT_ID = '__root__';

// --------------------------------------------------------
// Transform: StructureNode[] → Plotly sunburst data
// --------------------------------------------------------

function buildSunburstTrace(nodes: StructureNode[]): SunburstTrace {
  const ids: string[] = [];
  const labels: string[] = [];
  const parents: string[] = [];
  const values: number[] = [];
  const customdata: string[] = [];

  // Synthetic root (required so all areas have a common parent)
  ids.push(ROOT_ID);
  labels.push('All');
  parents.push('');
  values.push(1);
  customdata.push('');

  for (const node of nodes) {
    if (node.nodeType === 'area') {
      ids.push(node.id);
      labels.push(node.name);
      parents.push(ROOT_ID);
      // Area value = sum of all leaf events under it (or 1 minimum)
      values.push(Math.max(node.eventCount, 1));
      customdata.push(`${node.name}`);
    } else {
      // Category node
      // L1 categories: parent is the area node
      // L2+ categories: parent is the category's direct parent
      const parentId =
        node.level === 1
          ? node.areaId
          : (node.parentCategoryId ?? node.areaId);

      ids.push(node.id);
      labels.push(node.name);
      parents.push(parentId);
      values.push(Math.max(node.eventCount, 1));
      customdata.push(
        `${node.name} — ${node.attrCount} attr${node.attrCount !== 1 ? 's' : ''}, ${node.eventCount} event${node.eventCount !== 1 ? 's' : ''}`,
      );
    }
  }

  return {
    type: 'sunburst',
    ids,
    labels,
    parents,
    values,
    customdata,
    hovertemplate: '<b>%{customdata}</b><extra></extra>',
    branchvalues: 'remainder',
    marker: {
      line: { width: 1 },
    },
    textfont: { size: 12 },
    insidetextfont: { size: 11 },
  };
}

// --------------------------------------------------------
// Determine the focus level for the Plotly sunburst
// --------------------------------------------------------

function getFocusLevel(
  nodes: StructureNode[],
  areaId: string | null,
  categoryId: string | null,
): string {
  if (categoryId) {
    const node = nodes.find(n => n.id === categoryId);
    return node ? node.id : ROOT_ID;
  }
  if (areaId) {
    const node = nodes.find(n => n.id === areaId);
    return node ? node.id : ROOT_ID;
  }
  return ROOT_ID;
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function StructureSunburstView() {
  const t = THEME.structure;
  const {
    filter,
    selectAreaAndCategory,
    setSelectedShortcutId,
  } = useFilter();
  const { nodes, loading, error } = useStructureData();

  // Build Plotly trace — memoised, recomputes only when nodes change
  const trace = useMemo(() => buildSunburstTrace(nodes), [nodes]);

  // Focus level — which node is the "root" of the current sunburst view
  const focusLevel = useMemo(
    () => getFocusLevel(nodes, filter.areaId ?? null, filter.categoryId ?? null),
    [nodes, filter.areaId, filter.categoryId],
  );

  // The trace with the current focus level applied
  const traceWithLevel: SunburstTrace = useMemo(
    () => ({ ...trace, level: focusLevel }),
    [trace, focusLevel],
  );

  // --------------------------------------------------------
  // Sunburst → Dropdown sync: click handler
  // --------------------------------------------------------
  const handleClick = (event: PlotMouseEvent) => {
    // PlotDatum type doesn't include `id` (sunburst-specific field) — cast to access it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const point = event.points[0] as any;
    if (!point || !point.id || point.id === ROOT_ID) {
      // Clicking root = clear all filters; UX-7: reset shortcut
      selectAreaAndCategory(null, null, []);
      setSelectedShortcutId(null);
      return;
    }

    const clickedNode = nodes.find(n => n.id === point.id);
    if (!clickedNode) return;

    // UX-7: reset shortcut on any Sunburst navigation
    setSelectedShortcutId(null);

    if (clickedNode.nodeType === 'area') {
      // Area click — ProgressiveCategorySelector's areaId useEffect handles chain reset
      selectAreaAndCategory(clickedNode.id, null, []);
    } else {
      // Category click — selectAreaAndCategory updates filter.categoryId,
      // ProgressiveCategorySelector's categoryId useEffect rebuilds chain from DB
      const path = buildCategoryIdPath(clickedNode, nodes);
      selectAreaAndCategory(clickedNode.areaId, clickedNode.id, path);
    }
  };

  // --------------------------------------------------------
  // Loading state
  // --------------------------------------------------------
  if (loading) {
    return (
      <div className={cn(
        'hidden md:flex items-center justify-center h-80 rounded-xl',
        t.light,
      )}>
        <div className="flex flex-col items-center gap-3">
          <div className={cn('w-8 h-8 rounded-full border-2 border-t-transparent animate-spin', t.spinner)} />
          <span className={cn('text-sm', t.lightText)}>Loading structure...</span>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Error state
  // --------------------------------------------------------
  if (error) {
    return (
      <div className="hidden md:flex items-center justify-center h-80 rounded-xl bg-red-50">
        <div className="text-center">
          <p className="text-sm text-red-600 mb-1">Failed to load structure</p>
          <p className="text-xs text-gray-400">{error.message}</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // Empty state
  // --------------------------------------------------------
  if (nodes.length === 0) {
    return (
      <div className={cn(
        'hidden md:flex items-center justify-center h-80 rounded-xl',
        t.light,
      )}>
        <p className={cn('text-sm', t.lightText)}>No structure data available</p>
      </div>
    );
  }

  // --------------------------------------------------------
  // Sunburst chart
  // --------------------------------------------------------
  // Up button handler — sets filter one level up.
  // ProgressiveCategorySelector's categoryId useEffect rebuilds chain from DB.
  const handleUp = () => {
    const currentNode = nodes.find(n => n.id === filter.categoryId);
    setSelectedShortcutId(null);

    if (!currentNode) {
      selectAreaAndCategory(null, null, []);
      return;
    }
    if (!currentNode.parentCategoryId) {
      // L1 → go up to Area level; areaId useEffect in ProgressiveCategorySelector clears chain
      selectAreaAndCategory(currentNode.areaId, null, []);
    } else {
      const parentNode = nodes.find(n => n.id === currentNode.parentCategoryId);
      if (parentNode) {
        const path = buildCategoryIdPath(parentNode, nodes);
        selectAreaAndCategory(parentNode.areaId, parentNode.id, path);
        // categoryId useEffect in ProgressiveCategorySelector will rebuild chain from DB
      } else {
        selectAreaAndCategory(currentNode.areaId, null, []);
      }
    }
  };

  return (
    <div className="hidden md:block w-full">
      {/* Top bar: Up button (top-right) + helper text */}
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-xs text-gray-400">
          Click a segment to filter · Double-click center to zoom out
        </p>
        {filter.categoryId && (
          <button
            onClick={handleUp}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Go up one level"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Up
          </button>
        )}
      </div>

      <Plot
        // SunburstTrace is a valid Plotly runtime type but @types/plotly.js
        // doesn't include it in the PlotData union — cast to avoid TS2769
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={[traceWithLevel] as any}
        layout={({
          margin: { t: 8, b: 8, l: 16, r: 16 },
          height: 512,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          // sunburstcolorway is valid Plotly runtime API but missing from
          // @types/plotly.js — cast to avoid TS2769 until types catch up
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sunburstcolorway: SUNBURST_COLORS as any,
          showlegend: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        onClick={handleClick}
        useResizeHandler={true}
        style={{ width: '100%' }}
        className="w-full"
      />
    </div>
  );
}
