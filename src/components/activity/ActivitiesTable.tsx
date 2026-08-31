import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useFilter } from '@/context/FilterContext';
import { supabase } from '@/lib/supabaseClient';
import { useActivities, formatTime, formatDate, formatDateCompact, type ActivityGroup } from '@/hooks/useActivities';
import { useAreaDashboard } from '@/hooks/useAreaDashboard';
import { useRunningBalance } from '@/hooks/useRunningBalance';
import { formatAmount, formatDateHr } from '@/lib/amountFormat';
import { resolveColumns, type ResolvedColumn } from '@/lib/listColumns';
import { useListColumnValues, type RowValues } from '@/hooks/useListColumnValues';
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
  isOrphan?: boolean;
}

function UserAvatar({ userId, displayName, isOwn, isOrphan }: UserAvatarProps) {
  const color = hashAvatarColor(userId);
  const initials = getInitials(displayName);
  return (
    <div
      className="flex items-center gap-1.5 min-w-0"
      title={isOrphan ? `${displayName} no longer has access to this area` : undefined}
    >
      <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center flex-shrink-0 ${isOrphan ? 'ring-2 ring-amber-400' : ''}`}>
        <span className="text-white text-[10px] font-bold">{initials}</span>
      </div>
      {isOrphan && (
        <span className="text-amber-500 text-xs leading-none flex-shrink-0">⚠</span>
      )}
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
  orphanedUserIds?: Set<string>;
  /** "userId:areaId" keys — area-level orphan check */
  orphanedPairKeys?: Set<string>;
  filterOrphans?: boolean;
  onClearOrphanFilter?: () => void;
  onManageOrphan?: () => void;
}

export function ActivitiesTable({ className = '', onEditActivity, onViewDetails, onDeleteActivity, onExport, onImport, orphanedPairKeys, filterOrphans, onClearOrphanFilter, onManageOrphan }: ActivitiesTableProps) {
  const { filter, sharedContext, areaHasActiveShares, clearCommentSearch, clearAttrFilter } = useFilter();
  const PAGE_SIZE = 20;
  const location = useLocation();

  // Current user id — needed for "You" badge and D4 own-event check
  const [currentUserId, setCurrentUserId] = useState<string>('');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''));
  }, []);

  // Show User column when: grantee (sharedContext != null) OR owner with active shares
  const showUserColumn = sharedContext !== null || areaHasActiveShares;

  // Read-only grantee cannot write events — Import writes new events, so hide the entry points
  const isReadOnlyGrantee = sharedContext?.permission === 'read';

  // How long the returned-to row stays marked, measured from the moment it is
  // rendered. Bump this one number if it still reads as too quick.
  const HIGHLIGHT_MS = 5000;
  // Hard ceiling from the moment the key arrives, whatever happens to the list.
  const HIGHLIGHT_CEILING_MS = 60_000;

  // Highlight key from navigation state (after returning from Edit/View)
  const [highlightKey, setHighlightKey] = useState<string | null>(
    (location.state as { highlightKey?: string } | null)?.highlightKey ?? null
  );
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);


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
    commentSearch: filter.commentSearch,
    attrFilter: filter.attrFilter,
    pageSize: PAGE_SIZE
  });

  // Apply orphan filter client-side — area-level: "userId:areaId" pair check
  const displayedActivities = filterOrphans && orphanedPairKeys && orphanedPairKeys.size > 0
    ? activities.filter(g => orphanedPairKeys.has(`${g.user_id}:${g.area_id}`))
    : activities;

  // Running balance column (OVERVIEW_TAB_SPEC §2.12). Appears only when the list
  // is one account, newest-first — the hook decides and hides itself otherwise.
  const { config: dashboardConfig, listColumns: listColumnsConfig } = useAreaDashboard(filter.areaId);
  const running = useRunningBalance({
    areaId: filter.areaId,
    config: dashboardConfig,
    activities: displayedActivities,
    attrFilter: filter.attrFilter,
    sortOrder: filter.sortOrder,
    dateTo: filter.dateTo,
  });

  // Columns for this Area (Backlog — kolone po Arei). No config = today's list.
  // `user` and `balance` are dropped here rather than inside the row, so header
  // and cells can never disagree about how many columns there are.
  const columns = useMemo(() => {
    const all = resolveColumns(listColumnsConfig);
    return all.filter(c =>
      (c.role !== 'user' || showUserColumn) &&
      (c.role !== 'balance' || running.enabled));
  }, [listColumnsConfig, showUserColumn, running.enabled]);

  const colValues = useListColumnValues({
    areaId: filter.areaId,
    columns,
    activities: displayedActivities,
  });

  // HLT fix: react to loading→false + activities present (ref.current is not reactive)
  const hasHighlightRow = highlightKey
    ? displayedActivities.some(g => g.sessionKey === highlightKey)
    : false;

  // Auto-clear the highlight — but only once the row is actually ON SCREEN.
  //
  // ⚠ The countdown used to start the moment `highlightKey` arrived from
  //   navigation state, which is BEFORE the list has fetched anything. The
  //   5 seconds were therefore spent mostly on the loading state, and what the
  //   user saw was whatever was left after the rows rendered — sometimes almost
  //   nothing. Reported as "the blue mark is too short"; the duration was never
  //   the problem, the starting point was. Gating on the same condition the
  //   scroll effect uses makes the 5 seconds five seconds OF VISIBILITY.
  useEffect(() => {
    if (!highlightKey || loading || !hasHighlightRow) return;
    const timer = setTimeout(() => setHighlightKey(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightKey, loading, hasHighlightRow]);

  // Safety net: the effect above only fires once the row is ON the current page,
  // so a row that is filtered out or sits on a later page would leave the key set
  // for the life of the component. Nothing is visible while no row matches — but
  // load more, or widen the filter, and it would light up minutes later, with no
  // idea why. The old code could not do that: it always cleared after 5s.
  useEffect(() => {
    if (!highlightKey) return;
    const timer = setTimeout(() => setHighlightKey(null), HIGHLIGHT_CEILING_MS);
    return () => clearTimeout(timer);
  }, [highlightKey]);

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

  // Skeleton loading state — keeps table structure visible, prevents layout shift
  if (loading) {
    return (
      <div className={className}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900">Activities</h3>
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 hidden sm:table-header-group">
                <tr>
                  <th className="px-3 py-3 w-8" />
                  {/* Same headers the loaded table will show — a skeleton with
                      different columns is a layout shift, which is the one
                      thing a skeleton exists to prevent. */}
                  {columns.map(c => (
                    <th
                      key={c.key}
                      className={[
                        'px-3 py-3 font-medium text-gray-700',
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.width ?? '',
                        c.desktopHide ?? '',
                        c.role === 'actions' ? 'sticky right-0 bg-gray-50' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {c.role === 'actions' ? '' : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {/* Desktop row */}
                    <td className="hidden sm:table-cell px-3 py-3 w-8">
                      <div className="w-4 h-4 bg-gray-200 rounded" />
                    </td>
                    {columns.map(c => (
                      <td
                        key={c.key}
                        className={[
                          'hidden sm:table-cell px-3 py-3',
                          c.desktopHide ?? '',
                          c.role === 'actions' ? 'sticky right-0 bg-white' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {c.role === 'actions'
                          ? <div className="h-6 w-6 bg-gray-200 rounded ml-auto" />
                          : <div className="h-4 bg-gray-200 rounded" style={{ width: `${50 + ((i * 13) % 35)}%` }} />}
                      </td>
                    ))}
                    {/* Mobile row */}
                    <td className="sm:hidden px-3 py-3" colSpan={columns.length}>
                      <div className="h-4 bg-gray-200 rounded mb-1.5" style={{ width: `${55 + (i * 11) % 30}%` }} />
                      <div className="h-3 bg-gray-100 rounded" style={{ width: `${35 + (i * 19) % 40}%` }} />
                    </td>
                    <td className="sm:hidden px-3 py-3 w-10 sticky right-0 bg-white">
                      <div className="h-6 w-6 bg-gray-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        {onImport && !isReadOnlyGrantee && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              📤 Import
            </button>
          </div>
        )}
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

  const loadedCount = displayedActivities.length;

  return (
    <div className={className}>
      {/* Header with count + load more + Export/Import + bulk delete */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-medium text-gray-900">
            Activities
          </h3>
          {/* Orphan filter chip */}
          {filterOrphans && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-medium rounded-full">
              ⚠ Orphan events only
              <button
                onClick={onClearOrphanFilter}
                className="ml-0.5 text-amber-600 hover:text-amber-900 leading-none"
                title="Clear filter"
              >
                ×
              </button>
            </span>
          )}
          {/* Comment search chip */}
          {filter.commentSearch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 border border-indigo-300 text-indigo-800 text-xs font-medium rounded-full">
              comment: &ldquo;{filter.commentSearch}&rdquo;
              <button
                onClick={clearCommentSearch}
                className="ml-0.5 text-indigo-600 hover:text-indigo-900 leading-none"
                title="Clear comment filter"
              >
                ×
              </button>
            </span>
          )}
          {/* Attr filter chip */}
          {filter.attrFilter?.value && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 border border-indigo-300 text-indigo-800 text-xs font-medium rounded-full">
              {filter.attrFilter.value}
              <button
                onClick={clearAttrFilter}
                className="ml-0.5 text-indigo-600 hover:text-indigo-900 leading-none"
                title="Clear attribute filter"
              >
                ×
              </button>
            </span>
          )}
          <span className="text-sm text-gray-500">
            {filterOrphans
              ? `${loadedCount} orphan ${loadedCount === 1 ? 'activity' : 'activities'}`
              : hasMore
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

        {/* Export/Import — hidden on mobile (accessible via mobile strip above table) */}
        <div className="hidden sm:flex items-center gap-2">
          {!isReadOnlyGrantee && (
            <button
              onClick={onImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              📤 Import
            </button>
          )}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            📥 Export
          </button>
        </div>

        {/* Bulk delete controls — hidden for grantees */}
        {selectedKeys.size > 0 && !sharedContext && (
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
        <div ref={scrollContainerRef} className="overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 hidden sm:table-header-group">
            <tr>
              <th className="px-3 py-3 text-left w-8">
                {!sharedContext && (
                  <input
                    type="checkbox"
                    checked={selectedKeys.size === activities.length && activities.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                )}
              </th>
              {columns.map(c => (
                <th
                  key={c.key}
                  className={[
                    'px-3 py-3 font-medium text-gray-700',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.width ?? '',
                    c.desktopHide ?? '',
                    c.role === 'category' ? 'max-w-[180px]' : '',
                    c.role === 'comment' ? 'max-w-[140px]' : '',
                    c.role === 'date' || c.role === 'time' || c.role === 'balance' || c.role === 'pair' ? 'whitespace-nowrap' : '',
                    c.role === 'actions' ? 'sticky right-0 bg-gray-50 z-[2]' : '',
                  ].filter(Boolean).join(' ')}
                  title={c.role === 'balance'
                    ? `Izračunato stanje za "${running.groupValue}" nakon svakog retka.` +
                      (running.anchorOn
                        ? ` Računa se od potvrde ${formatDateHr(running.anchorOn)} — stariji retci nemaju definirano stanje.`
                        : ' Nema potvrđenog stanja, pa se računa od početka podataka.')
                    : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedActivities.map((group) => (
              <ActivityRow
                key={group.sessionKey}
                group={group}
                runningBalance={running.enabled ? { value: running.byKey.get(group.sessionKey) ?? null, unit: running.unit } : undefined}
                isSelected={selectedKeys.has(group.sessionKey)}
                onToggleSelect={() => toggleSelect(group.sessionKey)}
                onEdit={onEditActivity}
                onViewDetails={onViewDetails}
                onDelete={onDeleteActivity}
                isHighlighted={group.sessionKey === highlightKey}
                highlightRef={group.sessionKey === highlightKey ? highlightRowRef : undefined}
                currentUserId={currentUserId}
                canEditForeign={sharedContext === null}
                canSelect={!sharedContext}
                isOrphan={orphanedPairKeys?.has(`${group.user_id}:${group.area_id}`) ?? false}
                onManageOrphan={onManageOrphan}
                showCategoryOnMobile={!filter.categoryId}
                columns={columns}
                values={colValues.byKey.get(group.sessionKey)}
                valuesLoaded={colValues.loaded}
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
// Configured cells (Backlog — kolone po Arei)
// --------------------------------------------

/**
 * `pair` — direction and amount in ONE column.
 *
 * Both sides can be non-empty on the same row and that is NOT an error: the
 * ZABA row "Anja 73/96" (25.08.2025.) carries an uplata of 450,00 and an
 * isplata of 0,70, a faithful join of two real statement lines (CLAUDE.md).
 * A cell that showed only one of them would quietly hide half the transaction,
 * so both are printed side by side.
 *
 * An absent amount renders as an em dash, never as `0`. For money, zero is a
 * claim about the row; blank is the absence of one.
 */
/** Placeholder for a cell whose values are still in flight.
 *
 *  ⚠ Without it, a loading cell renders `—` — the same thing an EMPTY cell
 *  renders. For money that is not a cosmetic difference: `—` is an assertion
 *  ("this row has no amount"), and for the second or two the query takes, the
 *  list quietly asserts it about every row. Seen on a phone against PROD on
 *  2026-08-26: a whole screen of rows with `—` where amounts belong.
 *  `useListColumnValues` already knew — "a missing key means not loaded yet,
 *  not empty" — the flag just never reached the cells. */
function LoadingCell({ w = 'w-10' }: { w?: string }) {
  return <span className={`inline-block h-3 ${w} rounded bg-gray-200 animate-pulse align-middle`} />;
}

function PairCell({ col, values, stack, loaded }: { col: ResolvedColumn; values?: RowValues; stack?: boolean; loaded?: boolean }) {
  const plus = col.plus ? values?.num.get(col.plus) : undefined;
  const minus = col.minus ? values?.num.get(col.minus) : undefined;
  const hasPlus = plus != null && plus !== 0;
  const hasMinus = minus != null && minus !== 0;

  if (!hasPlus && !hasMinus) {
    if (!loaded) return <LoadingCell w="w-14" />;
    return <span className="text-gray-300">—</span>;
  }

  // Both sides filled is a real row, not an error — ZABA `Anja 73/96` carries an
  // inbound 450,00 and an outbound 0,70 in one event. Side by side it is the
  // widest thing on a narrow line (measured: 145 px, the row's whole budget at
  // 320 px), so on narrow screens it stacks. Stacking, never dropping one side:
  // a cell that shows one half hides half the transaction.
  if (stack && hasPlus && hasMinus) {
    return (
      <span className="tabular-nums whitespace-nowrap inline-flex flex-col items-end leading-tight">
        <span className="text-emerald-700">+{formatAmount(plus!, col.unit)}</span>
        <span className="text-rose-700">−{formatAmount(minus!, col.unit)}</span>
      </span>
    );
  }

  return (
    <span className="tabular-nums whitespace-nowrap">
      {hasPlus && <span className="text-emerald-700">+{formatAmount(plus!, col.unit)}</span>}
      {hasPlus && hasMinus && <span className="text-gray-300 mx-1">·</span>}
      {hasMinus && <span className="text-rose-700">−{formatAmount(minus!, col.unit)}</span>}
    </span>
  );
}

/** Where a cell is being rendered. The narrow screen has TWO lines and they
 *  are not the same place: line 1 carries the date and the amount, line 2 wraps. */
type CellVariant = 'desktop' | 'line1' | 'line2';

/** `attr` — one or more slugs joined into a single cell (e.g. `Tip / Podtip`). */
function AttrCell({ col, values, plain, loaded }: { col: ResolvedColumn; values?: RowValues; plain?: boolean; loaded?: boolean }) {
  const parts = (col.slugs ?? [])
    .map(sl => values?.text.get(sl))
    .filter((v): v is string => !!v)
    // `map` shortens a value for display (`Kokin tekući ZABA` -> `ZABA`). A value
    // that is not in the dictionary keeps its full text — see the type comment.
    .map(v => col.map?.[v] ?? v)
    // The same value twice says nothing the once does not: `Tip/Podtip` on an
    // unclassified row read `N/A/N/A` and ate half of the narrow line. Repeats
    // are dropped, not `N/A` specifically — the column has no idea what its
    // values mean, and a rule about one value would be domain knowledge in code.
    // (Hiding a value outright would be the `map` dictionary's job, but import
    // drops entries with an empty value — `structureImport.ts` `if (k && v)`.)
    .filter((v, i, all) => all.indexOf(v) === i);
  if (parts.length === 0) {
    if (!loaded) return <LoadingCell />;
    return <span className="text-gray-400 italic">—</span>;
  }
  // Default is tight on purpose: `Sep` survives the Structure roundtrip only
  // if trimming cannot change it (structureImport trims every config cell).
  const txt = parts.join(col.sep ?? '/');
  // `plain` = the narrow-screen line, which wraps. `truncate` would put
  // `white-space: nowrap` back and take the wrapping with it.
  if (plain) return <span title={txt}>{txt}</span>;
  return <span className="text-gray-700 truncate block" title={txt}>{txt}</span>;
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
  currentUserId?: string;
  /**
   * Smije li ovaj korisnik ispraviti TUDJI redak. True za vlasnika Aree (043).
   * ⚠ Vrijedi samo za Edit — brisanje tudjeg retka ostaje zatvoreno.
   */
  canEditForeign?: boolean;
  canSelect?: boolean;
  isOrphan?: boolean;
  onManageOrphan?: () => void;
  showCategoryOnMobile?: boolean;
  /** §2.12 — undefined = column is off; { value: null } = defined but not applicable to this row. */
  runningBalance?: { value: number | null; unit?: string };
  /** Resolved columns for this Area, already filtered to what is renderable. */
  columns: ResolvedColumn[];
  /** Attribute values for this row; undefined while the query is in flight. */
  values?: RowValues;
  /** Has the values query finished? Without it a loading cell and an empty cell
   *  are the same `—`, and for money that is a claim, not a wait. */
  valuesLoaded?: boolean;
}

function ActivityRow({ group, isSelected, onToggleSelect, onEdit, onViewDetails, onDelete, isHighlighted, highlightRef, currentUserId, canEditForeign = false, canSelect = true, isOrphan = false, onManageOrphan, showCategoryOnMobile = false, runningBalance, columns, values, valuesLoaded }: ActivityRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });

  const firstEvent = group.events[0];
  const isOwnEvent = !currentUserId || group.user_id === currentUserId;

  // Build path display (without area for brevity)
  const pathDisplay = group.category_path.slice(1).join(' > '); // Skip area name


  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const MENU_HEIGHT = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const right = Math.max(window.innerWidth - rect.right, 4);
    if (spaceBelow < MENU_HEIGHT + 8) {
      setMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
    } else {
      setMenuPos({ top: rect.bottom + 4, right });
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

  /**
   * Oznaka „netko drugi je ispravio ovaj redak" (043).
   * ⚠ Stoji UZ `⋮`, dakle na oba rasporeda (desktop i uski) i uvijek vidljiva —
   *   ide u sticky celiju, pa je vodoravni scroll ne odnese. Bez nje je ispravak
   *   vlasnice Aree potpuno nevidljiv autoru retka.
   */
  const editedMark = group.edited_by_other ? (
    <span
      title={`Izmijenio/la: ${group.edited_by_other.name} · ${new Date(group.edited_by_other.at).toLocaleString('hr-HR')}`}
      className="text-amber-600 text-xs leading-none cursor-help"
    >
      ✎
    </span>
  ) : null;

  const menuButton = (
    <button
      onClick={handleMenuOpen}
      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );

  /**
   * One cell's content, by role. Written once and used by BOTH the desktop
   * table and the narrow-screen two-line layout — the two can drift apart in
   * how they look, but never in WHAT they show. `compact` is the narrow-screen
   * variant of the same value, not a different value.
   */
  const cellContent = (c: ResolvedColumn, variant: CellVariant = 'desktop'): React.ReactNode => {
    const compact = variant !== 'desktop';
    switch (c.role) {
      case 'date':
        return (
          <span className={compact ? 'font-medium text-gray-900 text-sm' : 'text-gray-900 text-sm'}>
            {compact ? formatDateCompact(group.event_date) : formatDate(group.event_date)}
          </span>
        );
      case 'time':
        return (
          <span className={compact ? 'text-xs text-gray-400' : 'text-gray-700'}>
            {formatTime(group.session_start)}
          </span>
        );
      case 'category':
        return compact ? (
          <span className="text-indigo-500">
            {group.area_icon ? `${group.area_icon} ${pathDisplay}` : pathDisplay}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {group.area_icon && <span className="text-base flex-shrink-0">{group.area_icon}</span>}
            <div className="text-gray-900 truncate text-sm" title={group.category_path.join(' > ')}>
              {pathDisplay}
            </div>
          </div>
        );
      case 'events':
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm text-gray-700">{group.eventCount}</span>
            {group.has_photos && <span title="Has photos" className="text-xs">📷</span>}
          </div>
        );
      case 'user':
        return compact ? (
          <div
            className={`w-5 h-5 rounded-full ${hashAvatarColor(group.user_id)} flex items-center justify-center flex-shrink-0 ${isOrphan ? 'ring-2 ring-amber-400' : ''}`}
            title={group.user_display_name || group.user_id}
          >
            <span className="text-white text-[8px] font-bold">
              {getInitials(group.user_display_name || group.user_id)}
            </span>
          </div>
        ) : (
          <UserAvatar
            userId={group.user_id}
            displayName={group.user_display_name || group.user_id}
            isOwn={isOwnEvent}
            isOrphan={isOrphan}
          />
        );
      case 'pair':
        return <PairCell col={c} values={values} stack={compact} loaded={valuesLoaded} />;
      case 'attr':
        // On `line1` the attribute is a marker beside the date — the account a
        // row belongs to — so it is set small and grey, the same weight as
        // line 2. On `line1` the amount owns the emphasis.
        return variant === 'line1'
          ? <span className="text-xs text-gray-500"><AttrCell col={c} values={values} plain loaded={valuesLoaded} /></span>
          : <AttrCell col={c} values={values} plain={compact} loaded={valuesLoaded} />;
      case 'comment':
        return compact ? (
          <span title={firstEvent.comment || undefined}>
            {firstEvent.comment || <span className="text-gray-400 italic">—</span>}
          </span>
        ) : (
          <span className="text-gray-600 truncate block" title={firstEvent.comment || undefined}>
            {firstEvent.comment || <span className="text-gray-400 italic">—</span>}
          </span>
        );
      case 'balance':
        // The parent already dropped this column when the hook is off, so
        // `runningBalance` is present here; `value: null` still means the row
        // has no defined balance (before the anchor, or it does not move it).
        return runningBalance?.value == null ? (
          <span
            className="text-gray-300"
            title="Ovaj redak ne miče stanje — ili je prije potvrđenog stanja, ili ne ulazi u saldo (npr. kartično plaćanje koje tereti račun tek skupnom naplatom)."
          >
            —
          </span>
        ) : (
          <span className={`tabular-nums ${runningBalance.value < 0 ? 'text-rose-700' : 'text-gray-900'}`}>
            {formatAmount(runningBalance.value, runningBalance.unit)}
          </span>
        );
      case 'actions':
        return menuButton;
      default:
        return null;
    }
  };

  // Narrow screens render two lines instead of a table. `actions` stays in its
  // own sticky cell on both, so it is excluded from either line.
  const mobileLine = (which: 'line1' | 'line2') =>
    columns.filter(c =>
      c.mobile === which &&
      c.role !== 'actions' &&
      (c.role !== 'category' || showCategoryOnMobile));

  const highlightClass = isHighlighted
    ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400'
    : isSelected
      ? 'bg-indigo-50 hover:bg-indigo-50'
      : 'hover:bg-gray-50';

  return (
    <>
      {/* Desktop row — hidden below sm (640px) */}
      <tr
        ref={highlightRef}
        className={`transition-colors hidden sm:table-row ${highlightClass}`}
      >
        {/* Checkbox — hidden for grantees */}
        <td className="px-3 py-2.5">
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          )}
        </td>

        {columns.map(c => (
          <td
            key={c.key}
            className={[
              c.role === 'actions' ? 'px-2 py-2.5 sticky right-0 bg-white z-[1]' : 'px-3 py-2.5',
              c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '',
              c.desktopHide ?? '',
              c.role === 'category' ? 'max-w-[180px]' : '',
              c.role === 'comment' ? 'max-w-[140px]' : '',
              c.role === 'date' || c.role === 'time' || c.role === 'balance' || c.role === 'pair' ? 'whitespace-nowrap' : '',
              c.role === 'attr' ? 'max-w-[200px]' : '',
            ].filter(Boolean).join(' ')}
          >
            {cellContent(c)}
          </td>
        ))}
      </tr>

      {/* Narrow-screen row — two lines, driven by the same column config */}
      <tr className={`sm:hidden transition-colors ${highlightClass}`}>
        {/*
          `w-full max-w-0` is the whole fix for S119, and it is not cosmetic.
          Measured at 360 px: this cell used to make the table 490 px wide, so
          the row scrolled sideways and the AMOUNT — the thing the row exists
          for — sat 132 px off-screen. Cause: an auto-layout table grows to its
          content's min-content width, and `truncate` sets `white-space: nowrap`,
          so the "truncated" text was never truncated; it stretched the table
          instead. The desktop cells never showed it because they carry
          `max-w-[140px]`/`max-w-[180px]`; this one carried nothing.
          `max-w-0` puts the cell's width back under the table's control, and
          then wrapping/clipping inside it finally applies.
        */}
        <td className="px-3 py-2 min-w-0 w-full max-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {mobileLine('line1').map(c => (
              <span
                key={c.key}
                className={
                  c.align === 'right'
                    ? 'ml-auto flex-shrink-0 text-sm'   // amounts sit at the right edge
                    : 'flex-shrink-0 min-w-0'
                }
              >
                {cellContent(c, 'line1')}
              </span>
            ))}
          </div>
          {/*
            Line 2 WRAPS (up to two lines) instead of truncating. Sideways
            scrolling used to be the only way to read the end of a description
            on a phone; capping the width above would have taken that away and
            given back an ellipsis. Wrapping gives the whole text with no
            gesture at all — and `line-clamp-2` still bounds the row height.
          */}
          {mobileLine('line2').length > 0 && (
            <div className="mt-0.5 min-w-0 text-xs text-gray-500">
              <span className="line-clamp-2">
                {mobileLine('line2').map((c, i) => (
                  <span key={c.key}>
                    {i > 0 && <span className="text-gray-300"> · </span>}
                    {cellContent(c, 'line2')}
                  </span>
                ))}
              </span>
            </div>
          )}
        </td>
        {/* Sticky Actions — always visible on right edge */}
        <td className="py-2 pr-2 sticky right-0 bg-white z-[1] align-top">
          <div className="flex items-center gap-1">{editedMark}{menuButton}</div>
        </td>
      </tr>

      {/* Dropdown menu portal — shared between desktop and mobile rows */}
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
            {/* Orphan management — shown when user is orphaned */}
            {isOrphan && onManageOrphan && (
              <>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => { onManageOrphan(); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
                >
                  ⚠ Manage orphan events
                </button>
              </>
            )}
            {/* D4 + 043: Edit smije i vlasnik Aree (Koka mora moci ispraviti
                Sasin redak), Delete NE — brisanje tudjeg retka nema povratka. */}
            {(isOwnEvent || canEditForeign) && (
              <button
                onClick={() => {
                  onEdit?.(group.session_start, group.category_id, firstEvent.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {isOwnEvent ? '✏️ Edit' : '✏️ Edit (tuđi zapis)'}
              </button>
            )}
            {isOwnEvent && (
              <>
                <hr className="my-1 border-gray-100" />
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
    </>
  );
}
