/**
 * OrphanBanner.tsx
 *
 * Amber banner shown above ActivitiesTable when there are orphan events
 * (events from users who no longer have an active share with the owner).
 *
 * [View events] — sets filterOrphans: true in FilterContext, highlighting
 *                 only orphan rows in the main Activities table.
 * [Manage]      — opens OrphanManagementModal for bulk Re-invite/Claim/Delete.
 */

interface OrphanBannerProps {
  orphanUserCount: number;
  orphanGroupCount: number;
  onViewEvents: () => void;
  onManage: () => void;
}

export function OrphanBanner({ orphanUserCount, orphanGroupCount, onViewEvents, onManage }: OrphanBannerProps) {
  const userLabel = orphanUserCount === 1 ? 'user' : 'users';
  const actLabel = orphanGroupCount === 1 ? 'activity' : 'activities';

  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-3 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-amber-600 flex-shrink-0">⚠</span>
        <span className="text-sm text-amber-800 truncate">
          <span className="font-medium">{orphanUserCount} {userLabel}</span> no longer have access
          {' '}· <span className="font-medium">{orphanGroupCount} {actLabel}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onViewEvents}
          className="text-xs font-medium text-amber-700 hover:text-amber-900 px-2.5 py-1 border border-amber-300 hover:border-amber-500 rounded-md transition-colors bg-white"
        >
          View events
        </button>
        <button
          onClick={onManage}
          className="text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-md transition-colors"
        >
          Manage
        </button>
      </div>
    </div>
  );
}
