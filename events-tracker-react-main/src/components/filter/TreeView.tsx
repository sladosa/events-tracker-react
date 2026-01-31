import { useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import type { TreeNode, UUID } from '@/types';

// --------------------------------------------
// Icons
// --------------------------------------------

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={cn(
      'w-4 h-4 transition-transform duration-200',
      expanded && 'rotate-90'
    )} 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FolderIcon = ({ open }: { open: boolean }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {open ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" 
      />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
      />
    )}
  </svg>
);

// --------------------------------------------
// Tree Item Component
// --------------------------------------------

interface TreeItemProps {
  node: TreeNode;
  level: number;
  selectedId: UUID | null;
  expandedIds: Set<UUID>;
  onSelect: (node: TreeNode) => void;
  onToggle: (id: UUID) => void;
  showEventCount?: boolean;
}

function TreeItem({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  showEventCount = false
}: TreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isArea = node.type === 'area';

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer',
          'transition-colors duration-150',
          isSelected 
            ? 'bg-indigo-100 text-indigo-900' 
            : 'hover:bg-gray-100 text-gray-700',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          className={cn(
            'p-0.5 rounded hover:bg-gray-200 transition-colors',
            !hasChildren && 'invisible'
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronIcon expanded={isExpanded} />
        </button>

        {/* Icon */}
        {isArea ? (
          <span 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.color || '#6366f1' }}
          />
        ) : (
          <span className="text-gray-400">
            <FolderIcon open={isExpanded && hasChildren} />
          </span>
        )}

        {/* Name */}
        <span className={cn(
          'flex-1 truncate text-sm',
          isArea && 'font-medium'
        )}>
          {node.name}
        </span>

        {/* Optional event count badge */}
        {showEventCount && node.eventCount !== undefined && node.eventCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
            {node.eventCount}
          </span>
        )}

        {/* Has attributes indicator */}
        {node.hasAttributes && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Has attributes" />
        )}
      </div>

      {/* Children (animated) */}
      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {node.children.map(child => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              showEventCount={showEventCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// Main TreeView Component
// --------------------------------------------

interface TreeViewProps {
  nodes: TreeNode[];
  selectedId?: UUID | null;
  onSelect: (node: TreeNode) => void;
  className?: string;
  defaultExpanded?: UUID[];
  showEventCount?: boolean;
  expandAll?: boolean;
}

export function TreeView({
  nodes,
  selectedId = null,
  onSelect,
  className,
  defaultExpanded = [],
  showEventCount = false,
  expandAll = false
}: TreeViewProps) {
  // Track expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(() => {
    if (expandAll) {
      // Collect all node IDs
      const allIds = new Set<UUID>();
      const collectIds = (items: TreeNode[]) => {
        items.forEach(item => {
          allIds.add(item.id);
          if (item.children.length > 0) collectIds(item.children);
        });
      };
      collectIds(nodes);
      return allIds;
    }
    return new Set(defaultExpanded);
  });

  const handleToggle = useCallback((id: UUID) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand all / collapse all
  const expandAllNodes = useCallback(() => {
    const allIds = new Set<UUID>();
    const collectIds = (items: TreeNode[]) => {
      items.forEach(item => {
        allIds.add(item.id);
        if (item.children.length > 0) collectIds(item.children);
      });
    };
    collectIds(nodes);
    setExpandedIds(allIds);
  }, [nodes]);

  const collapseAllNodes = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  if (nodes.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        No items to display
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      {/* Optional expand/collapse all buttons */}
      {nodes.length > 3 && (
        <div className="flex gap-2 mb-2 text-xs">
          <button 
            onClick={expandAllNodes}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button 
            onClick={collapseAllNodes}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Tree nodes */}
      <div className="space-y-0.5">
        {nodes.map(node => (
          <TreeItem
            key={node.id}
            node={node}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={handleToggle}
            showEventCount={showEventCount}
          />
        ))}
      </div>
    </div>
  );
}
