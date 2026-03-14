/**
 * ActivityHeader Component
 *
 * Shared sticky header for Add Activity and Edit Activity pages.
 * - Category chain (locked, read-only)
 * - Timers (Add mode) or Duration (Edit mode)
 * - Action buttons (Cancel, Save+, Finish/Save)
 * - Delete Session button (Edit mode only)
 *
 * forwardRef: EditActivityPage i AddActivityPage koriste ref za
 * ResizeObserver koji mjeri visinu headera (DA1 fix).
 */

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { EditorMode } from '@/types/activity';
import { messages } from '@/types/activity';

// ============================================
// Helpers
// ============================================

/** Format date as YYYY/MM/DD (P2.2) */
function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/** Format time as HH:MM */
function formatTimeHM(date: Date): string {
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// Timer / Duration formatting
// ============================================

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ============================================
// Types
// ============================================

interface ActivityHeaderProps {
  mode: EditorMode;
  categoryPath: string[];

  // Add mode: timers
  sessionElapsed?: number;
  lapElapsed?: number;

  // Edit mode: editable date/time
  dateTime?: Date;
  onDateTimeChange?: (date: Date) => void;
  totalDuration?: number;

  /** Navigate to View Details mode (Edit mode only) */
  onViewMode?: () => void;

  // Actions
  onCancel: () => void;
  onSave: () => void;
  onSaveContinue?: () => void;

  /** Delete entire session + photos (Edit mode only) */
  onDeleteSession?: () => void;

  // State
  canSave: boolean;
  saving: boolean;
  pendingEventCount?: number;
}

// ============================================
// Main Component - forwardRef za DA1 ResizeObserver
// ============================================

export const ActivityHeader = forwardRef<HTMLElement, ActivityHeaderProps>(
  function ActivityHeader(
    {
      mode,
      categoryPath,
      sessionElapsed = 0,
      lapElapsed = 0,
      dateTime,
      onDateTimeChange,
      totalDuration,
      onCancel,
      onSave,
      onSaveContinue,
      onDeleteSession,
      onViewMode,
      canSave,
      saving,
      pendingEventCount = 0,
    },
    ref
  ) {
    const isAddMode = mode === 'add';
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const headerBg = isAddMode ? 'bg-blue-500' : 'bg-amber-500';

    return (
      <header ref={ref} className={cn('fixed top-0 left-0 right-0 z-30', headerBg, 'shadow-md')}>

        {/* Row 1: Title + Category Path */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white">
              {isAddMode ? messages.addActivity : messages.editActivity}
            </h1>
            {isAddMode && pendingEventCount > 0 && (
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingEventCount} saved
              </span>
            )}
          </div>
          <p className="text-base font-medium mt-1 opacity-90 text-white">
            {categoryPath.join(' > ')}
          </p>
        </div>

        {/* Row 2: Timers (Add) or Date/Duration (Edit) */}
        <div className="px-4 py-2 bg-black/10">
          {isAddMode ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs">SESSION</span>
                <span className="font-mono text-xl font-bold text-white">
                  {formatTimer(sessionElapsed)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-200/70 text-xs">LAP</span>
                <span className="font-mono text-lg font-semibold text-amber-200">
                  {formatTimer(lapElapsed)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white/70 text-xs">📅</span>
                {dateTime && onDateTimeChange ? (
                  <div className="flex gap-2 items-center">
                    {/* B4: Show YYYY-MM-DD text always (browser may render date input differently) */}
                    <span className="text-white font-medium text-sm tabular-nums">
                      {dateTime.toISOString().split('T')[0]}
                    </span>
                    <input
                      type="date"
                      lang="sv"
                      value={dateTime.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(dateTime);
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        newDate.setFullYear(year, month - 1, day);
                        onDateTimeChange(newDate);
                      }}
                      className="bg-white/20 text-white border-0 rounded px-1 py-1 text-sm focus:ring-2 focus:ring-white/50 opacity-60 hover:opacity-100 focus:opacity-100 cursor-pointer"
                      title="Click to change date"
                    />
                    <input
                      type="time"
                      value={dateTime.toTimeString().slice(0, 5)}
                      onChange={(e) => {
                        const newDate = new Date(dateTime);
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        newDate.setHours(hours, minutes, 0, 0); // reset sekundi i ms → kolizija na razini minute
                        onDateTimeChange(newDate);
                      }}
                      className="bg-white/20 text-white border-0 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                ) : (
                  <span className="text-white font-medium">
                    {dateTime ? `${formatDateYMD(dateTime)} ${formatTimeHM(dateTime)}` : ''}
                  </span>
                )}
              </div>
              {totalDuration !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-xs">Duration</span>
                  <span className="font-mono text-white font-semibold">
                    {formatDuration(totalDuration)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 3: Action buttons */}
        <div className="px-4 py-2 flex items-center justify-between gap-2">

          {/* Left: Cancel + View/No-Save-View (Edit) + Delete Session (Edit only) */}
          <div className="flex items-center gap-2">

            {/* Cancel / No Save – Home */}
            {isAddMode ? (
              // Add mode: compact X icon button
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
                title={messages.cancel}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              // Edit mode: text button — makes "no save" consequence explicit
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
                title="Discard changes and go to Home"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden xs:inline">No Save</span>
                <span className="hidden sm:inline">&nbsp;– Home</span>
              </button>
            )}

            {/* No Save – View (Edit mode only) */}
            {!isAddMode && onViewMode && (
              <button
                type="button"
                onClick={onViewMode}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
                title="Discard changes and switch to View mode"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden xs:inline">No Save</span>
                <span className="hidden sm:inline">&nbsp;– View</span>
              </button>
            )}

            {/* Delete Session (Edit mode only) */}
            {!isAddMode && onDeleteSession && (
              !showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600/80 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                  title="Delete entire activity + all events + all photos"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">Delete Activity</span>
                </button>
              ) : (
                // Stronger confirm — makes irreversible consequence unmistakable
                <div className="flex items-center gap-1.5 bg-red-800 border border-red-400 rounded-lg px-2 py-1">
                  <span className="text-red-200 text-xs font-bold uppercase tracking-wide">
                    ALL EVENTS + PHOTOS DELETED!
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); onDeleteSession(); }}
                    className="px-2 py-0.5 bg-white text-red-800 text-xs font-bold rounded hover:bg-red-100"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-0.5 bg-white/20 text-white text-xs rounded hover:bg-white/30"
                  >
                    No
                  </button>
                </div>
              )
            )}
          </div>

          {/* Right: Save+Continue (Add) + Finish / Save→View (Edit) */}
          <div className="flex items-center gap-2">
            {isAddMode && onSaveContinue && (
              <button
                type="button"
                onClick={onSaveContinue}
                disabled={!canSave || saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{messages.saveContinue}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={!canSave || saving}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                isAddMode ? 'bg-teal-500 hover:bg-teal-600' : 'bg-amber-600 hover:bg-amber-700'
              )}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {/* Edit mode: explicit "Save → View" communicates where user lands after save */}
                  <span>{isAddMode ? messages.finish : 'Save \u2192 View'}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </header>
    );
  }
);

// ============================================
// Export timer formatting for use elsewhere
// ============================================

export { formatTimer, formatDuration };
