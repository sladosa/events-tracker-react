import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useFilter } from '@/context/FilterContext';
import { supabase } from '@/lib/supabaseClient';
import { useActivities, formatTime, formatDate, type ActivityGroup } from '@/hooks/useActivities';
import type { UUID } from '@/types';

// --------------------------------------------
// Avatar helpers
// --------------------------------------------

function hashAvatarColor(userId: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

interface UserAvatarProps {
  userId: string;
  displayName: string;
  isOwn: boolean;
}

function UserAvatar({ userId, displayName, isOwn }: UserAvatarProps) {
  const color = hashAvatarColor(userId);
  const initials = getInitials(displayName);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-[10px] font-bold">{initials}</span>
      </div>
      {isOwn ? (
        <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">You</span>
      ) : (
        <span className="text-xs text-gray-600 truncate">{displayName}</span>
      )}
    </div>
  );
}

interface ActivitiesTableProps {
  className?: string;
  onEditActivity?: (sessionStart: string | null, categoryId: UUID, eventId: UUID) => void;
  onViewDetails?: (sessionStart: string | null, categoryId: UUID, eventId: UUID, userId: string) => void;
  onDeleteActivity?: (sessionStart: string, categoryId: UUID) => Promise<void>;
  onExport?: () => void;
  onImport?: () => void;
}

export function ActivitiesTable({ className = '', onEditActivity, onViewDetails, onDeleteActivity, onExport, onImport }: ActivitiesTableProps) {
  const { filter, sharedContext, areaHasActiveShares } = useFilter();
  const PAGE_SIZE = 20;
  const location = useLocation();

  // Current user id — needed for "You" badge and D4 own-event check
  const [currentUserId, setCurrentUserId] = useState<string>('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''));
  }, []);

  // Show User column when: grantee (sharedContext != null) OR owner with active shares
  const showUserColumn = sharedContext !== null || areaHasActiveShares;

  // Highlight key from navigation state (after returning from Edit/View)
  const [highlightKey, setHighlightKey] = useState<string | null>(
    (location.state as { highlightKey?: string } | null)?.highlightKey ?? null
  );
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-clear highlight after 3s, scroll to row when activities load
  useEffect(() => {
    if (!highlightKey) return;
    const timer = setTimeout(() => setHighlightKey(null), 5000);
    return () => clearTimeout(timer);
  }, [highlightKey]);

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
    sortOrder: filter.sortOrder,
    pageSize: PAGE_SIZE
  });

  // HLT fix: react to loading→false + activities present (ref.current is not reactive)
  const hasHighlightRow = highlightKey
    ? activities.some(g => g.sessionKey === highlightKey)
    : false;

  useEffect(() => {
    if (!highlightKey || loading || !hasHighlightRow) return;
    const timer = setTimeout(() => {
      const row = highlightRowRef.current;
      const container = scrollContainerRef.current;
      if (!row || !container) return;
      // Scroll inner overflow-y container da red dođe na sredinu vidljivog dijela
      const rowTop = row.offsetTop;
      const rowHeight = row.offsetHeight;
      const containerHeight = container.clientHeight;
      const scrollTo = rowTop - (containerHeight / 2) + (rowHeight / 2);
      container.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightKey, loading, hasHighlightRow]);

  // Multi-select state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const toggleSelect = (sessionKey: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(sessionKey)) next.delete(sessionKey);
      else next.add(sessionKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === activities.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(activities.map(g => g.sessionKey)));
    }
  };

  const handleBulkDelete = async () => {
    if (!onDeleteActivity || selectedKeys.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const key of selectedKeys) {
        const group = activities.find(g => g.sessionKey === key);
        if (group?.session_start) {
          await onDeleteActivity(group.session_start, group.category_id);
        }
      }
      setSelectedKeys(new Set());
    } finally {
      setBulkDeleting(false);
      setShowBulkConfirm(false);
    }
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

  const loadedCount = activities.length;

  return (
    <div className={className}>
      {/* Header with count + load more + Export/Import + bulk delete */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-900">
            Activities
          </h3>
          <span className="text-sm text-gray-500">
            {hasMore 
              ? `${loadedCount} loaded, more available`
              : `All ${loadedCount} loaded · ${totalCount} events`
            }
          </span>
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {loadingMore ? (
                <>
                  <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                  Loading...
                </>
              ) : (
                `Load next ${PAGE_SIZE}`
              )}
            </button>
          )}
        </div>

        {/* Export/Import + Bulk delete controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            📤 Import
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            📥 Export
          </button>
        </div>

        {/* Bulk delete controls */}
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedKeys.size} selected</span>
            {!showBulkConfirm ? (
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                🗑️ Delete selected
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                <span className="text-xs text-red-700 font-medium">Delete {selectedKeys.size} activities?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-2 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkDeleting ? '...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setShowBulkConfirm(false)}
                  disabled={bulkDeleting}
                  className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table – outer div: horizontal scroll; inner div: vertical scroll with sticky header */}
      <div className="overflow-x-auto">
        <div ref={scrollContainerRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={selectedKeys.size === activities.length && activities.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-28 whitespace-nowrap">Date</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 w-14 whitespace-nowrap">Time</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 max-w-[180px]">Category</th>
              <th className="px-3 py-3 text-center font-medium text-gray-700 w-16">Events</th>
              {showUserColumn && (
                <th className="px-3 py-3 text-left font-medium text-gray-700 hidden lg:table-cell w-32">User</th>
              )}
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden lg:table-cell max-w-[140px]">Comment</th>
              <th className="px-3 py-3 text-right font-medium text-gray-700 w-12 sticky right-0 bg-gray-50 z-[2]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activities.map((group) => (
              <ActivityRow
                key={group.sessionKey}
                group={group}
                isSelected={selectedKeys.has(group.sessionKey)}
                onToggleSelect={() => toggleSelect(group.sessionKey)}
                onEdit={onEditActivity}
                onViewDetails={onViewDetails}
                onDelete={onDeleteActivity}
                isHighlighted={group.sessionKey === highlightKey}
                highlightRef={group.sessionKey === highlightKey ? highlightRowRef : undefined}
                showUserColumn={showUserColumn}
                currentUserId={currentUserId}
              />
            ))}
          </tbody>
        </table>
        </div>
      </div>

    </div>
  );
}

// --------------------------------------------
// Activity Row Component
// --------------------------------------------

interface ActivityRowProps {
  group: ActivityGroup;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit?: (sessionStart: string | null, categoryId: UUID, eventId: UUID) => void;
  onViewDetails?: (sessionStart: string | null, categoryId: UUID, eventId: UUID, userId: string) => void;
  onDelete?: (sessionStart: string, categoryId: UUID) => Promise<void>;
  isHighlighted?: boolean;
  highlightRef?: React.RefObject<HTMLTableRowElement | null>;
  showUserColumn?: boolean;
  currentUserId?: string;
}

function ActivityRow({ group, isSelected, onToggleSelect, onEdit, onViewDetails, onDelete, isHighlighted, highlightRef, showUserColumn, currentUserId }: ActivityRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const firstEvent = group.events[0];
  const isOwnEvent = !currentUserId || group.user_id === currentUserId;

  // Build path display (without area for brevity)
  const pathDisplay = group.category_path.slice(1).join(' > '); // Skip area name

  const handleMenuOpen = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const MENU_HEIGHT = 160; // approximate menu height
      const spaceBelow = window.innerHeight - rect.bottom;
      // D2: ensure min 4px from right edge so menu stays on screen
      const right = Math.max(window.innerWidth - rect.right, 4);

      if (spaceBelow < MENU_HEIGHT + 8) {
        // Not enough space below – show above the button
        setMenuPos({
          bottom: window.innerHeight - rect.top + 4,
          right,
        });
      } else {
        // Default: show below
        setMenuPos({
          top: rect.bottom + 4,
          right,
        });
      }
    }
    setShowMenu(true);
  }, []);

  // Close menu on scroll
  useEffect(() => {
    if (!showMenu) return;
    const handleScroll = () => { setShowMenu(false); setShowDeleteConfirm(false); };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showMenu]);

  const handleDeleteConfirm = async () => {
    if (!group.session_start || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(group.session_start, group.category_id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  };

  return (
    <>
      <tr
        ref={highlightRef}
        className={`transition-colors ${
          isHighlighted
            ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400'
            : isSelected
              ? 'bg-indigo-50 hover:bg-indigo-50'
              : 'hover:bg-gray-50'
        }`}
      >
        {/* Checkbox */}
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        </td>

        {/* Date */}
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
            {group.area_icon && (
              <span className="text-base flex-shrink-0">{group.area_icon}</span>
            )}
            <div className="text-gray-900 truncate text-sm" title={group.category_path.join(' > ')}>
              {pathDisplay}
            </div>
          </div>
        </td>

        {/* Events count + photo indicator */}
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm text-gray-700">{group.eventCount}</span>
            {group.has_photos && (
              <span title="Has photos" className="text-xs">📷</span>
            )}
          </div>
        </td>
        
        {/* User - hidden on small/medium screens; only when showUserColumn */}
        {showUserColumn && (
          <td className="px-3 py-2.5 hidden lg:table-cell w-32">
            <UserAvatar
              userId={group.user_id}
              displayName={group.user_display_name || group.user_id}
              isOwn={isOwnEvent}
            />
          </td>
        )}

        {/* Comment - hidden on small/medium screens */}
        <td className="px-3 py-2.5 hidden lg:table-cell max-w-[140px]">
          <span className="text-gray-600 truncate block" title={firstEvent.comment || undefined}>
            {firstEvent.comment || (
              <span className="text-gray-400 italic">—</span>
            )}
          </span>
        </td>
        
        {/* Actions - sticky right so always visible */}
        <td className="px-2 py-2.5 text-right sticky right-0 bg-white z-[1]">
          <button
            ref={buttonRef}
            onClick={handleMenuOpen}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {/* Dropdown Menu - fixed positioning to escape overflow:hidden parents */}
          {showMenu && createPortal(
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => { setShowMenu(false); setShowDeleteConfirm(false); }}
              />
              <div 
                className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] py-1"
                style={{ 
                  top: menuPos.top, 
                  bottom: menuPos.bottom, 
                  right: menuPos.right 
                }}
              >
                {/* View Details — uvijek dostupno */}
                <button
                  onClick={() => {
                    onViewDetails?.(group.session_start, group.category_id, firstEvent.id, group.user_id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  👁️ View Details
                </button>
                {/* D4: Edit + Delete samo za vlastite evente */}
                {isOwnEvent && (
                  <>
                    <button
                      onClick={() => {
                        onEdit?.(group.session_start, group.category_id, firstEvent.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      ✏️ Edit
                    </button>
                    <hr className="my-1 border-gray-100" />
                    {/* Delete with inline confirmation */}
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        🗑️ Delete Activity
                      </button>
                    ) : (
                      <div className="px-3 py-2 bg-red-50">
                        <p className="text-xs text-red-700 font-medium mb-2">
                          Delete {group.eventCount} event{group.eventCount !== 1 ? 's' : ''} + all photos?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {isDeleting ? '...' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setShowMenu(false);
                            }}
                            disabled={isDeleting}
                            className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>,
            document.body
          )}
        </td>
      </tr>
    </>
  );
}
