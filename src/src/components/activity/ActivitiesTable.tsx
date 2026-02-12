import { useState } from 'react';
import { useFilter } from '@/context/FilterContext';
import { useActivities, formatTime, formatDate, type ActivityGroup } from '@/hooks/useActivities';

interface ActivitiesTableProps {
  className?: string;
  onEditActivity?: (activityId: string) => void;
}

export function ActivitiesTable({ className = '', onEditActivity }: ActivitiesTableProps) {
  const { filter } = useFilter();
  
  const { 
    activities, 
    loading, 
    loadingMore, 
    error, 
    hasMore, 
    totalCount,
    loadMore 
  } = useActivities({
    areaId: filter.areaId,
    categoryId: filter.categoryId,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    pageSize: 20
  });

  // Track which rows have expanded details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (sessionKey: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(sessionKey)) {
        next.delete(sessionKey);
      } else {
        next.add(sessionKey);
      }
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading activities...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-red-500 mb-2">⚠️ Error loading activities</div>
          <p className="text-sm text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">No activities found</p>
          <p className="text-sm text-gray-400">
            {filter.areaId || filter.categoryId 
              ? 'Try adjusting your filters or date range'
              : 'Start by adding your first activity'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with count */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Activities
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({totalCount} total)
          </span>
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-32 whitespace-nowrap">Date</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-16">Time</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700">Category</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden md:table-cell">Comment</th>
              <th className="px-3 py-3 text-right font-medium text-gray-700 w-14">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activities.map((group) => (
              <ActivityRow 
                key={group.sessionKey}
                group={group}
                isExpanded={expandedRows.has(group.sessionKey)}
                onToggleExpand={() => toggleExpand(group.sessionKey)}
                onEdit={onEditActivity}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="px-4 py-4 border-t border-gray-100 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                Loading...
              </span>
            ) : (
              'Load more...'
            )}
          </button>
        </div>
      )}

      {/* End of list */}
      {!hasMore && activities.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 text-center text-xs text-gray-400">
          End of list • {totalCount} activities
        </div>
      )}
    </div>
  );
}

// --------------------------------------------
// Activity Row Component
// --------------------------------------------

interface ActivityRowProps {
  group: ActivityGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit?: (activityId: string) => void;
}

function ActivityRow({ group, isExpanded, onToggleExpand, onEdit }: ActivityRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  
  const hasMultipleEvents = group.eventCount > 1;
  const firstEvent = group.events[0];
  
  // Build path display (without area for brevity)
  const pathDisplay = group.category_path.slice(1).join(' > '); // Skip area name

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* Date - compact single line */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="text-gray-900 text-sm">{formatDate(group.event_date)}</span>
        </td>
        
        {/* Time */}
        <td className="px-3 py-2.5">
          <span className="text-gray-700">{formatTime(group.session_start)}</span>
        </td>
        
        {/* Category Path */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {/* Area icon */}
            {group.area_icon && (
              <span className="text-base flex-shrink-0">{group.area_icon}</span>
            )}
            
            <div className="min-w-0">
              {/* Path */}
              <div className="text-gray-900 truncate" title={group.category_path.join(' > ')}>
                {pathDisplay}
              </div>
              
              {/* Event count badge */}
              {hasMultipleEvents && (
                <button
                  onClick={onToggleExpand}
                  className="mt-0.5 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  {isExpanded ? '▼' : '▶'} {group.eventCount} events in session
                </button>
              )}
            </div>
          </div>
        </td>
        
        {/* Comment */}
        <td className="px-3 py-2.5 hidden md:table-cell">
          <span className="text-gray-600 truncate block max-w-xs" title={firstEvent.comment || undefined}>
            {firstEvent.comment || (
              <span className="text-gray-400 italic">No comment</span>
            )}
          </span>
        </td>
        
        {/* Actions */}
        <td className="px-3 py-2.5 text-right">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => {
                      onEdit?.(firstEvent.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Implement view details
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    👁️ View Details
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => {
                      // TODO: Implement delete
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </td>
      </tr>
      
      {/* Expanded events in session */}
      {isExpanded && hasMultipleEvents && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-4 py-2">
            <div className="ml-8 space-y-1">
              {group.events.map((event, idx) => (
                <div 
                  key={event.id}
                  className="flex items-center gap-4 text-sm py-1 px-3 bg-white rounded border border-gray-100"
                >
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span className="text-gray-700 w-16">{formatTime(event.session_start)}</span>
                  <span className="text-gray-600 flex-1 truncate">
                    {event.comment || <span className="text-gray-400 italic">No comment</span>}
                  </span>
                  <button
                    onClick={() => onEdit?.(event.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
