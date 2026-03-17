// ============================================================
// CategoryDetailPanel.tsx
// ============================================================
// Read-only "View" panel opened from Actions ⋮ → 👁 View.
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
//
// Close button. Pure read-only — no edit controls.
// ============================================================

import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import type { StructureNode } from '@/types/structure';
import type { AttributeDefinition } from '@/types/database';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';

// --------------------------------------------------------
// Types
// --------------------------------------------------------

interface CategoryDetailPanelProps {
  node: StructureNode;
  allNodes: StructureNode[];
  onClose: () => void;
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

/** Reconstruct the ancestor chain from Area down to (and including) the given node. */
function buildChain(node: StructureNode, allNodes: StructureNode[]): StructureNode[] {
  if (node.nodeType === 'area') return [node];

  const parts = node.fullPath.split(' > ');
  const chain: StructureNode[] = [];

  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join(' > ');
    const found = allNodes.find(n => n.fullPath === prefix);
    if (found) chain.push(found);
  }

  return chain; // [AreaNode, L1Node, ..., selectedNode]
}

/** Convert validation_rules to display object — delegates to shared parseValidationRules
 * which handles both V3 format { type:'suggest', suggest:[...] }
 * and legacy format { dropdown: { type:'static', options:[...] } }
 */
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

// Level label: Area → "Area", L1 → "L1", L2 → "L2", etc.
function levelLabel(level: number, nodeType: 'area' | 'category'): string {
  if (nodeType === 'area') return 'Area';
  return `L${level}`;
}

// --------------------------------------------------------
// Sub-components
// --------------------------------------------------------

/** Attribute definition row in the panel */
function AttrRow({ attr }: { attr: AttributeDefinition }) {
  const t = THEME.structure;
  const validation = describeValidation(attr);

  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      {/* Name + type badges row */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">
          {attr.name}
          {attr.is_required && (
            <span className="ml-1 text-red-500 text-xs" title="Required">*</span>
          )}
        </span>

        {/* data_type badge */}
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded font-mono',
          t.badgeAttrs,
        )}>
          {attr.data_type}
        </span>

        {/* unit (if set) */}
        {attr.unit && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            {attr.unit}
          </span>
        )}

        {/* validation type badge */}
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded',
          validation.label === 'free text'
            ? 'bg-gray-100 text-gray-500'
            : 'bg-amber-100 text-amber-700',
        )}>
          {validation.label}
        </span>
      </div>

      {/* Simple suggest options list */}
      {validation.options && validation.options.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {validation.options.map(opt => (
            <span key={opt} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {opt}
            </span>
          ))}
        </div>
      )}

      {/* DependsOn: parent attr slug + per-value option lists */}
      {validation.dependsOnSlug && (
        <div className="mt-1.5 space-y-1">
          <p className="text-xs text-gray-500">
            depends on: <span className="font-mono text-indigo-600">{validation.dependsOnSlug}</span>
          </p>
          {validation.dependsOnMap && Object.entries(validation.dependsOnMap).map(([key, opts]) => (
            <div key={key} className="flex items-start gap-1.5 pl-2">
              <span className="text-xs text-gray-500 font-mono shrink-0 pt-0.5">
                {key} →
              </span>
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

      {/* Description */}
      {attr.description && (
        <p className="mt-1 text-xs text-gray-400">{attr.description}</p>
      )}
    </div>
  );
}

/** One level section in the chain: heading + attrs */
function LevelSection({ chainNode }: { chainNode: StructureNode }) {
  const t = THEME.structure;
  const isArea = chainNode.nodeType === 'area';

  // Area nodes have no attribute_definitions in current schema
  const attrs = isArea ? [] : chainNode.attributeDefinitions;

  return (
    <div className={cn(
      'mb-4 rounded-lg border overflow-hidden',
      t.lightBorder,
    )}>
      {/* Level heading */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2',
        t.light,
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-bold px-1.5 py-0.5 rounded',
            t.lightText,
          )}>
            {levelLabel(chainNode.level, chainNode.nodeType)}
          </span>
          <span className={cn('text-sm font-semibold', t.lightText)}>
            {chainNode.name}
          </span>
        </div>

        {/* Attr count badge */}
        {!isArea && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            attrs.length > 0 ? t.badgeAttrs : 'bg-gray-100 text-gray-400',
          )}>
            {attrs.length > 0 ? `${attrs.length} attr${attrs.length !== 1 ? 's' : ''}` : 'no attrs'}
          </span>
        )}
      </div>

      {/* Attr list */}
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

  // Direct L1 children
  const l1Children = allNodes.filter(
    n => n.nodeType === 'category' && n.level === 1 && n.areaId === node.id,
  );

  // All categories under this area
  const allCats = allNodes.filter(
    n => n.nodeType === 'category' && n.areaId === node.id,
  );

  // Leaf event count: sum only leaf nodes to avoid double-counting parent events
  const totalLeafEvents = allNodes
    .filter(n => n.isLeaf && n.areaId === node.id)
    .reduce((sum, n) => sum + n.eventCount, 0);

  return (
    <div>
      {/* Description */}
      {node.description && (
        <p className="mb-4 text-sm text-gray-600 italic">{node.description}</p>
      )}

      {/* Totals row */}
      <div className="flex gap-4 mb-4">
        <div className={cn('flex-1 rounded-lg px-3 py-2 text-center', t.light)}>
          <div className={cn('text-lg font-bold', t.lightText)}>{allCats.length}</div>
          <div className="text-xs text-gray-500">categories</div>
        </div>
        <div className={cn('flex-1 rounded-lg px-3 py-2 text-center', t.light)}>
          <div className={cn('text-lg font-bold', t.lightText)}>{totalLeafEvents}</div>
          <div className="text-xs text-gray-500">leaf events</div>
        </div>
      </div>

      {/* L1 children list */}
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
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full', t.badgeLeaf)}>
                    leaf
                  </span>
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

  return (
    <div>
      {/* Event count */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-600">
          {node.isLeaf
            ? `${node.eventCount} event${node.eventCount !== 1 ? 's' : ''} recorded`
            : `${node.eventCount} events at this level`}
        </span>
        {node.isLeaf && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full', THEME.structure.badgeLeaf)}>
            leaf
          </span>
        )}
      </div>

      {/* Per-level sections */}
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

export function CategoryDetailPanel({ node, allNodes, onClose }: CategoryDetailPanelProps) {
  const t = THEME.structure;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* ---- Header ---- */}
        <div className={cn('flex items-start justify-between gap-3 px-5 py-4 border-b', t.lightBorder)}>
          <div className="min-w-0">
            {/* Node type label */}
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded',
                node.nodeType === 'area'
                  ? 'bg-indigo-100 text-indigo-700'
                  : node.isLeaf
                  ? cn(t.badgeLeaf)
                  : cn(t.badgeAttrs),
              )}>
                {node.nodeType === 'area' ? 'Area' : node.isLeaf ? 'Leaf' : `L${node.level}`}
              </span>
            </div>

            {/* Full path */}
            <h2 className="text-base font-semibold text-gray-900 break-words leading-snug">
              {node.fullPath}
            </h2>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ---- Body (scrollable) ---- */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {node.nodeType === 'area' ? (
            <AreaContent node={node} allNodes={allNodes} />
          ) : (
            <CategoryContent node={node} allNodes={allNodes} />
          )}
        </div>

        {/* ---- Footer ---- */}
        <div className="flex justify-end px-5 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              t.cancelBtn,
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
