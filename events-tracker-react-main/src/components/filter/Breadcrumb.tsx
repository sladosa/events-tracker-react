import { cn } from '@/lib/cn';
import type { BreadcrumbItem } from '@/types';

// --------------------------------------------
// Icons
// --------------------------------------------

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
    />
  </svg>
);

const ChevronIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
    />
  </svg>
);

// --------------------------------------------
// Component
// --------------------------------------------

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
  className?: string;
  maxItems?: number; // Collapse if more than this
}

export function Breadcrumb({ 
  path, 
  onNavigate, 
  className,
  maxItems = 4 
}: BreadcrumbProps) {
  // Collapse middle items if too many
  const shouldCollapse = path.length > maxItems;
  const displayPath = shouldCollapse
    ? [
        path[0], // Root
        { id: null, name: '...', type: 'root' as const }, // Ellipsis
        ...path.slice(-2) // Last 2 items
      ]
    : path;

  return (
    <nav 
      className={cn('flex items-center flex-wrap gap-1', className)}
      aria-label="Breadcrumb"
    >
      {displayPath.map((item, index) => {
        const isLast = index === displayPath.length - 1;
        const isEllipsis = item.name === '...';
        const originalIndex = shouldCollapse && index > 1 
          ? path.length - (displayPath.length - index)
          : index;

        return (
          <div key={`${item.id}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronIcon />}
            
            {isEllipsis ? (
              <span className="px-2 py-1 text-gray-400">...</span>
            ) : (
              <button
                onClick={() => onNavigate(item, originalIndex)}
                disabled={isLast}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
                  'transition-colors duration-150',
                  isLast
                    ? 'text-gray-900 font-medium cursor-default'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                )}
              >
                {item.type === 'root' && <HomeIcon />}
                {item.type === 'area' && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
                {item.type === 'category' && <FolderIcon />}
                <span className="max-w-[120px] truncate">{item.name}</span>
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// --------------------------------------------
// Compact version for mobile
// --------------------------------------------

interface BreadcrumbCompactProps {
  path: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
  onBack?: () => void;
  className?: string;
}

export function BreadcrumbCompact({ 
  path, 
  onNavigate, 
  onBack,
  className 
}: BreadcrumbCompactProps) {
  const currentItem = path[path.length - 1];
  const canGoBack = path.length > 1;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {canGoBack && (
        <button
          onClick={onBack || (() => onNavigate(path[path.length - 2], path.length - 2))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      <div className="flex items-center gap-1.5 min-w-0">
        {currentItem?.type === 'root' && <HomeIcon />}
        {currentItem?.type === 'area' && (
          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
        )}
        {currentItem?.type === 'category' && <FolderIcon />}
        <span className="font-medium text-gray-900 truncate">
          {currentItem?.name || 'All'}
        </span>
      </div>

      {path.length > 1 && (
        <button
          onClick={() => onNavigate(path[0], 0)}
          className="text-xs text-gray-500 hover:text-indigo-600"
        >
          ({path.length - 1} levels)
        </button>
      )}
    </div>
  );
}
