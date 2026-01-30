import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { useCategoryPath } from '@/hooks/useCategoryPath';
import { useFilter } from '@/context/FilterContext';
import { SearchInput } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Breadcrumb, BreadcrumbCompact } from './Breadcrumb';
import { TreeView } from './TreeView';
import type { TreeNode, BreadcrumbItem, UUID } from '@/types';

// --------------------------------------------
// Types
// --------------------------------------------

type ViewType = 'tree' | 'sunburst' | 'list';

interface UniversalFilterProps {
  mode?: 'browse' | 'select' | 'filter';
  showSearch?: boolean;
  showViewToggle?: boolean;
  showBreadcrumb?: boolean;
  onSelect?: (node: TreeNode) => void;
  className?: string;
  compact?: boolean; // Mobile-friendly compact mode
}

// --------------------------------------------
// View Type Icons
// --------------------------------------------

const ViewIcons: Record<ViewType, React.ReactNode> = {
  tree: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  sunburst: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <circle cx="12" cy="12" r="7" strokeWidth={2} />
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  ),
  list: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
};

// --------------------------------------------
// Main Component
// --------------------------------------------

export function UniversalFilter({
  mode = 'browse',
  showSearch = true,
  showViewToggle = true,
  showBreadcrumb = true,
  onSelect,
  className,
  compact = false
}: UniversalFilterProps) {
  // Filter context
  const { 
    filter, 
    selectArea, 
    selectCategory, 
    navigateToPath,
    navigateUp,
    setSearchQuery 
  } = useFilter();

  // Data hooks
  const { tree, loading, error } = useCategoryTree();
  const { path: breadcrumbPath } = useCategoryPath(filter.categoryId);

  // Local state
  const [viewType, setViewType] = useState<ViewType>('tree');
  const [localSearch, setLocalSearch] = useState(filter.searchQuery);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    // Debounce the actual filter update
    const timer = setTimeout(() => setSearchQuery(value), 300);
    return () => clearTimeout(timer);
  }, [setSearchQuery]);

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!localSearch.trim()) return tree;

    const searchLower = localSearch.toLowerCase();
    
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce<TreeNode[]>((acc, node) => {
        const nameMatch = node.name.toLowerCase().includes(searchLower);
        const filteredChildren = filterNodes(node.children);
        
        if (nameMatch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren
          });
        }
        return acc;
      }, []);
    };

    return filterNodes(tree);
  }, [tree, localSearch]);

  // Handle node selection
  const handleSelect = useCallback((node: TreeNode) => {
    if (node.type === 'area') {
      selectArea(node.id);
    } else {
      // Build path from root to this node
      const buildPath = (nodes: TreeNode[], targetId: UUID, path: UUID[] = []): UUID[] | null => {
        for (const n of nodes) {
          if (n.id === targetId) {
            return [...path, n.id];
          }
          if (n.children.length > 0) {
            const found = buildPath(n.children, targetId, [...path, n.id]);
            if (found) return found;
          }
        }
        return null;
      };

      const categoryPath = buildPath(tree, node.id) || [node.id];
      selectCategory(node.id, categoryPath);
    }

    onSelect?.(node);
  }, [tree, selectArea, selectCategory, onSelect]);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((item: BreadcrumbItem, _index: number) => {
    navigateToPath(breadcrumbPath.slice(0, breadcrumbPath.indexOf(item) + 1));
  }, [breadcrumbPath, navigateToPath]);

  // Get selected ID for highlighting
  const selectedId = filter.categoryId || filter.areaId;

  // --------------------------------------------
  // Render
  // --------------------------------------------

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8 text-red-600', className)}>
        <p>Error loading data</p>
        <p className="text-sm text-gray-500 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header: Breadcrumb + View Toggle */}
      {(showBreadcrumb || showViewToggle) && (
        <div className="flex items-center justify-between gap-4">
          {showBreadcrumb && (
            compact ? (
              <BreadcrumbCompact
                path={breadcrumbPath}
                onNavigate={handleBreadcrumbNavigate}
                onBack={navigateUp}
              />
            ) : (
              <Breadcrumb
                path={breadcrumbPath}
                onNavigate={handleBreadcrumbNavigate}
              />
            )
          )}

          {showViewToggle && !compact && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(Object.keys(ViewIcons) as ViewType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setViewType(type)}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewType === type
                      ? 'bg-white shadow-sm text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                  title={type.charAt(0).toUpperCase() + type.slice(1)}
                  disabled={type === 'sunburst'} // TODO: Enable when implemented
                >
                  {ViewIcons[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <SearchInput
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onClear={() => handleSearchChange('')}
          placeholder="Search areas and categories..."
        />
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {viewType === 'tree' && (
          <TreeView
            nodes={filteredTree}
            selectedId={selectedId}
            onSelect={handleSelect}
            defaultExpanded={filter.categoryPath}
          />
        )}

        {viewType === 'sunburst' && (
          <div className="text-center py-12 text-gray-500">
            <p>Sunburst view coming soon...</p>
            <p className="text-sm mt-1">Switch to Tree view for now</p>
          </div>
        )}

        {viewType === 'list' && (
          <FlatList
            nodes={filteredTree}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}
      </div>

      {/* Results count */}
      {localSearch && (
        <div className="text-xs text-gray-500 text-center">
          {filteredTree.length === 0 
            ? 'No results found' 
            : `Found ${countNodes(filteredTree)} items`
          }
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// Flat List View (simple alternative)
// --------------------------------------------

interface FlatListProps {
  nodes: TreeNode[];
  selectedId: UUID | null;
  onSelect: (node: TreeNode) => void;
}

function FlatList({ nodes, selectedId, onSelect }: FlatListProps) {
  // Flatten tree for list view
  const flatNodes = useMemo(() => {
    const result: Array<TreeNode & { depth: number }> = [];
    
    const flatten = (items: TreeNode[], depth = 0) => {
      items.forEach(item => {
        result.push({ ...item, depth });
        if (item.children.length > 0) {
          flatten(item.children, depth + 1);
        }
      });
    };
    
    flatten(nodes);
    return result;
  }, [nodes]);

  return (
    <div className="space-y-1">
      {flatNodes.map(node => (
        <button
          key={node.id}
          onClick={() => onSelect(node)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg flex items-center gap-2',
            'transition-colors duration-150',
            selectedId === node.id
              ? 'bg-indigo-100 text-indigo-900'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
        >
          {node.type === 'area' ? (
            <span 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: node.color || '#6366f1' }}
            />
          ) : (
            <span className="w-3 h-3 text-gray-400">•</span>
          )}
          <span className={cn('truncate', node.type === 'area' && 'font-medium')}>
            {node.name}
          </span>
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------
// Helper
// --------------------------------------------

function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((count, node) => {
    return count + 1 + countNodes(node.children);
  }, 0);
}

// --------------------------------------------
// Export filter components index
// --------------------------------------------

export { Breadcrumb, BreadcrumbCompact } from './Breadcrumb';
export { TreeView } from './TreeView';
