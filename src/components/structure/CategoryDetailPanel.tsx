// ============================================================
// CategoryDetailPanel.tsx
// ============================================================
// Read-only "View" panel opened from Actions ⋮ → 👁 View.
//
// S19 additions:
//   - Sticky header: level badge + path + event count,
//     Prev/Next navigation, Edit button, Delete placeholder, X close
//   - No footer Close button (all controls in sticky header)
//   - onEdit callback → opens StructureNodeEditPanel
//   - filteredNodes + currentIndex for Prev/Next
//
// For Category / Leaf node:
//   - Full chain path header + event count
//   - For each level in chain (Area → L1 → ... → selected):
//     - Level heading + attribute_definitions for that level
//     - Attr: name, data_type, unit, is_required, validation summary
//     - "(no attributes)" when none
//
// For Area node:
//   - Area name + description
//   - List of direct L1 children (names only)
//   - Totals: X categories, Y leaf events
// ============================================================

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import { useTouchSwipe } from '@/hooks/useTouchSwipe';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

interface CategoryDetailPanelProps {
  node: StructureNode;
  allNodes: StructureNode[];
  /** Ordered list of nodes the user can Prev/Next through (filtered table rows) */
  filteredNodes: StructureNode[];
  /** Index of node within filteredNodes */
  currentIndex: number;
  onClose: () => void;
  /** Navigate to another node by index within filteredNodes */
  onNavigate: (index: number) => void;
  /** Open edit panel for this node */
  onEdit: (node: StructureNode) => void;
  /** Open delete modal — only wired when isEditMode is true */
  onDelete?: (node: StructureNode) => void;
  /** Whether Edit Mode is active — controls Delete button state */
  isEditMode?: boolean;
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

function buildChain(node: StructureNode, allNodes: StructureNode[]): StructureNode[] {
  if (node.nodeType === 'area') return [node];
  const parts = node.fullPath.split(' > ');
  const chain: StructureNode[] = [];
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join(' > ');
    const found = allNodes.find(n => n.fullPath === prefix);
    if (found) chain.push(found);
  }
  return chain;
}

function describeValidation(attr: AttributeDefinition): {
  label: string;
  options: string[] | null;
  dependsOnSlug: string | null;
  dependsOnMap: Record<string, string[]> | null;
} {
  const parsed = parseValidationRules(attr.validation_rules);
  if (parsed.dependsOn) {
    return {
      label: 'depends_on',
      options: null,
      dependsOnSlug: parsed.dependsOn.attributeSlug,
      dependsOnMap: parsed.dependsOn.optionsMap ?? null,
    };
  }
  if (parsed.type === 'suggest' || parsed.type === 'enum') {
    return {
      label: 'suggest',
      options: parsed.options.length > 0 ? parsed.options : null,
      dependsOnSlug: null,
      dependsOnMap: null,
    };
  }
  return { label: 'free text', options: null, dependsOnSlug: null, dependsOnMap: null };
}

function levelLabel(level: number, nodeType: 'area' | 'category'): string {
  if (nodeType === 'area') return 'Area';
  return `L${level}`;
}

// --------------------------------------------------------
// Icons
// --------------------------------------------------------

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// --------------------------------------------------------
// AttrRow
// --------------------------------------------------------

function AttrRow({ attr }: { attr: AttributeDefinition }) {
  const t = THEME.structure;
  const validation = describeValidation(attr);

  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">
          {attr.name}
          {attr.is_required && (
            <span className="ml-1 text-red-500 text-xs" title="Required">*</span>
          )}
        </span>
        <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono', t.badgeAttrs)}>
          {attr.data_type}
        </span>
        {attr.unit && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {attr.unit}
          </span>
        )}
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded',
          validation.label === 'free text'
            ? 'bg-gray-100 text-gray-500'
            : 'bg-amber-100 text-amber-700',
        )}>
          {validation.label}
        </span>
      </div>

      {validation.options && validation.options.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {validation.options.map(opt => (
            <span key={opt} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {opt}
            </span>
          ))}
        </div>
      )}

      {validation.dependsOnSlug && (
        <div className="mt-1.5 space-y-1">
          <p className="text-xs text-gray-500">
            depends on: <span className="font-mono text-indigo-600">{validation.dependsOnSlug}</span>
          </p>
          {validation.dependsOnMap && Object.entries(validation.dependsOnMap).map(([key, opts]) => (
            <div key={key} className="flex items-start gap-1.5 pl-2">
              <span className="text-xs text-gray-500 font-mono shrink-0 pt-0.5">{key} →</span>
              <div className="flex flex-wrap gap-1">
                {opts.map(opt => (
                  <span key={opt} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {attr.description && (
        <p className="mt-1 text-xs text-gray-400">{attr.description}</p>
      )}
    </div>
  );
}

// --------------------------------------------------------
// LevelSection
// --------------------------------------------------------

function LevelSection({ chainNode }: { chainNode: StructureNode }) {
  const t = THEME.structure;
  const isArea = chainNode.nodeType === 'area';
  const attrs = isArea ? [] : chainNode.attributeDefinitions;

  return (
    <div className={cn('mb-4 rounded-lg border overflow-hidden', t.lightBorder)}>
      <div className={cn('flex items-center justify-between px-3 py-2', t.light)}>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', t.lightText)}>
            {levelLabel(chainNode.level, chainNode.nodeType)}
          </span>
          <span className={cn('text-sm font-semibold', t.lightText)}>{chainNode.name}</span>
        </div>
        {!isArea && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            attrs.length > 0 ? t.badgeAttrs : 'bg-gray-100 text-gray-400',
          )}>
            {attrs.length > 0 ? `${attrs.length} attr${attrs.length !== 1 ? 's' : ''}` : 'no attrs'}
          </span>
        )}
      </div>
      <div className="px-3 divide-y divide-gray-50">
        {attrs.length > 0 ? (
          attrs.map(attr => <AttrRow key={attr.id} attr={attr} />)
        ) : (
          <p className="py-3 text-sm text-gray-400 italic">(no attributes at this level)</p>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Area content
// --------------------------------------------------------

function AreaContent({ node, allNodes }: { node: StructureNode; allNodes: StructureNode[] }) {
  const t = THEME.structure;
  const l1Children = allNodes.filter(
    n => n.nodeType === 'category' && n.level === 1 && n.areaId === node.id,
  );
  const allCats = allNodes.filter(n => n.nodeType === 'category' && n.areaId === node.id);

  return (
    <div>
      {node.description && (
        <p className="mb-4 text-sm text-gray-600 italic">{node.description}</p>
      )}
      <div className="flex gap-4 mb-4">
        <div className={cn('flex-1 rounded-lg px-3 py-2 text-center', t.light)}>
          <div className={cn('text-lg font-bold', t.lightText)}>{allCats.length}</div>
          <div className="text-xs text-gray-500">categories</div>
        </div>
      </div>
      {l1Children.length > 0 && (
        <div>
          <h4 className={cn('text-xs font-semibold uppercase tracking-wide mb-2', t.lightText)}>
            Top-level categories
          </h4>
          <div className="space-y-1">
            {l1Children.map(child => (
              <div key={child.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-800">{child.name}</span>
                {child.isLeaf && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', t.badgeLeaf)}>leaf</span>
                )}
                {child.attrCount > 0 && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full ml-auto', t.badgeAttrs)}>
                    {child.attrCount} attrs
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------
// Category content
// --------------------------------------------------------

function CategoryContent({ node, allNodes }: { node: StructureNode; allNodes: StructureNode[] }) {
  const chain = buildChain(node, allNodes);
  const t = THEME.structure;

  return (
    <div>
      {node.isLeaf && (
        <div className="mb-4">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', t.badgeLeaf)}>leaf</span>
        </div>
      )}
      <div>
        {chain.map(chainNode => (
          <LevelSection key={chainNode.id} chainNode={chainNode} />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function CategoryDetailPanel({
  node,
  allNodes,
  filteredNodes,
  currentIndex,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
  isEditMode = false,
}: CategoryDetailPanelProps) {
  const t = THEME.structure;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < filteredNodes.length - 1;

  const handleSwipeLeft = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  const handleSwipeRight = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  useTouchSwipe(handleSwipeLeft, handleSwipeRight);

  const eventLabel = node.eventCount === 1 ? '1 event' : `${node.eventCount} events`;

  const typeBadge = node.nodeType === 'area' ? 'Area' : node.isLeaf ? 'Leaf' : `L${node.level}`;
  const typeBadgeClass =
    node.nodeType === 'area'
      ? 'bg-indigo-100 text-indigo-700'
      : node.isLeaf
      ? t.badgeLeaf
      : t.badgeAttrs;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* ---- Sticky Header ---- */}
        <div className={cn('flex-shrink-0 border-b', t.lightBorder)}>

          {/* Row 1: badge + event count + path + X */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded',
                  typeBadgeClass,
                )}>
                  {typeBadge}
                </span>
                {/* Event count — always visible so user sees context immediately */}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {eventLabel}
                </span>
              </div>
              <h2 className="text-base font-semibold text-gray-900 break-words leading-snug">
                {node.fullPath}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Row 2: Prev / position / Next | Edit | Delete */}
          <div className="flex items-center gap-1 px-4 pb-3">
            <button
              onClick={() => hasPrev && onNavigate(currentIndex - 1)}
              disabled={!hasPrev}
              title="Previous node"
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                hasPrev
                  ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  : 'text-gray-300 cursor-not-allowed',
              )}
            >
              <ChevronLeftIcon />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <span className="text-xs text-gray-400 px-1 tabular-nums">
              {currentIndex + 1} / {filteredNodes.length}
            </span>

            <button
              onClick={() => hasNext && onNavigate(currentIndex + 1)}
              disabled={!hasNext}
              title="Next node"
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                hasNext
                  ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  : 'text-gray-300 cursor-not-allowed',
              )}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />

            <button
              onClick={() => onEdit(node)}
              title="Edit this node"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <EditIcon />
              <span>Edit</span>
            </button>

            {/* Delete — active in Edit Mode, visually disabled outside */}
            <button
              onClick={() => { if (isEditMode && onDelete) onDelete(node); }}
              disabled={!isEditMode}
              title={isEditMode ? 'Delete this node' : 'Enable Edit Mode to delete'}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isEditMode
                  ? 'text-red-600 hover:bg-red-50 cursor-pointer'
                  : 'text-red-300 cursor-not-allowed',
              )}
            >
              <TrashIcon />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* ---- Body (scrollable) ---- */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {node.nodeType === 'area' ? (
            <AreaContent node={node} allNodes={allNodes} />
          ) : (
            <CategoryContent node={node} allNodes={allNodes} />
          )}
        </div>
      </div>
    </div>
  );
}
