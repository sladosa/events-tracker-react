import { useState } from 'react';
import { useFilter } from '@/context/FilterContext';
import { useActivities, formatTime, formatDate, type ActivityGroup } from '@/hooks/useActivities';

interface ActivitiesTableProps {
  className?: string;
  onEditActivity?: (sessionStart: string) => void;
  onDeleteActivity?: (sessionStart: string) => Promise<void>;
}

export function ActivitiesTable({ className = '', onEditActivity, onDeleteActivity }: ActivitiesTableProps) {
  const { filter } = useFilter();
  
  const { 
    activities, 
    loading, 
    loadingMore, 
    error, 
    hasMore, 
    totalCount,
    activityCount,
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
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-medium text-gray-900">
          Activities
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({totalCount} events in {activityCount} activities)
          </span>
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-28 whitespace-nowrap">Date</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-14 whitespace-nowrap">Time</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 max-w-[180px]">Category</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden lg:table-cell max-w-[140px]">Comment</th>
              <th className="px-3 py-3 text-right font-medium text-gray-700 w-12 sticky right-0 bg-gray-50">Actions</th>
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
                onDelete={onDeleteActivity}
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
          End of list • {totalCount} events in {activityCount} activities
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
  onEdit?: (sessionStart: string) => void;
  onDelete?: (sessionStart: string) => Promise<void>;
}

function ActivityRow({ group, isExpanded, onToggleExpand, onEdit, onDelete }: ActivityRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const hasMultipleEvents = group.eventCount > 1;
  const firstEvent = group.events[0];
  
  // Build path display (without area for brevity)
  const pathDisplay = group.category_path.slice(1).join(' > '); // Skip area name

  const handleDeleteConfirm = async () => {
    if (!group.session_start || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(group.session_start);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  };

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
        <td className="px-3 py-2.5 max-w-[180px]">
          <div className="flex items-center gap-1.5">
            {/* Area icon */}
            {group.area_icon && (
              <span className="text-base flex-shrink-0">{group.area_icon}</span>
            )}
            
            <div className="min-w-0">
              {/* Path - truncated with full path on hover */}
              <div className="text-gray-900 truncate text-sm" title={group.category_path.join(' > ')}>
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
        
        {/* Comment - hidden on small/medium screens */}
        <td className="px-3 py-2.5 hidden lg:table-cell max-w-[140px]">
          <span className="text-gray-600 truncate block" title={firstEvent.comment || undefined}>
            {firstEvent.comment || (
              <span className="text-gray-400 italic">No comment</span>
            )}
          </span>
        </td>
        
        {/* Actions - sticky right so always visible */}
        <td className="px-2 py-2.5 text-right sticky right-0 bg-white">
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
                  className="fixed inset-0 z-40" 
                  onClick={() => { setShowMenu(false); setShowDeleteConfirm(false); }}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                  <button
                    onClick={() => {
                      if (group.session_start) {
                        onEdit?.(group.session_start);
                      }
                      setShowMenu(false);
                    }}
                    disabled={!group.session_start}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {/* Delete - s inline confirmation */}
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      🗑️ Delete
                    </button>
                  ) : (
                    <div className="px-3 py-2 bg-red-50">
                      <p className="text-xs text-red-700 font-medium mb-2">
                        Obriši {group.eventCount} event{group.eventCount !== 1 ? 's' : ''} + sve fotografije?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteConfirm}
                          disabled={isDeleting}
                          className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {isDeleting ? '...' : 'Da, obriši'}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setShowMenu(false);
                          }}
                          disabled={isDeleting}
                          className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Odustani
                        </button>
                      </div>
                    </div>
                  )}
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
                  {group.session_start && (
                    <button
                      onClick={() => onEdit?.(group.session_start!)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
