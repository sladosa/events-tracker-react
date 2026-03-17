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
import type { PlotMouseEvent, SunburstTrace } from 'react-plotly.js';
import type { StructureNode } from '@/types/structure';

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
        `${node.name} — ${node.eventCount} event${node.eventCount !== 1 ? 's' : ''}, ${node.attrCount} attr${node.attrCount !== 1 ? 's' : ''}`,
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
  const { filter, selectArea, selectCategory } = useFilter();
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
    const point = event.points[0];
    if (!point || !point.id || point.id === ROOT_ID) {
      // Clicking root = clear filters
      selectArea(null);
      selectCategory(null);
      return;
    }

    const clickedNode = nodes.find(n => n.id === point.id);
    if (!clickedNode) return;

    if (clickedNode.nodeType === 'area') {
      selectArea(clickedNode.id);
      selectCategory(null);
    } else {
      selectArea(clickedNode.areaId);
      selectCategory(clickedNode.id);
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
  return (
    <div className="hidden md:block w-full">
      <Plot
        data={[traceWithLevel]}
        layout={{
          margin: { t: 16, b: 16, l: 16, r: 16 },
          height: 520,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          sunburstcolorway: SUNBURST_COLORS,
          showlegend: false,
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        onClick={handleClick}
        useResizeHandler={true}
        style={{ width: '100%' }}
        className="w-full"
      />

      {/* Helper text */}
      <p className="text-center text-xs text-gray-400 pb-2">
        Click a segment to filter · Double-click center to zoom out
      </p>
    </div>
  );
}
