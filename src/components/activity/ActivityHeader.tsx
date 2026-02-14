/**
 * ActivityHeader Component
 * 
 * Shared sticky header for Add Activity and Edit Activity pages.
 * Displays:
 * - Category chain (locked, read-only)
 * - Timers (Add mode) or Duration (Edit mode)
 * - Action buttons (Cancel, Save+, Finish/Save)
 */

import { cn } from '@/lib/cn';
import type { EditorMode } from '@/types/activity';
import { messages } from '@/types/activity';

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
  
  // Actions
  onCancel: () => void;
  onSave: () => void;
  onSaveContinue?: () => void;
  
  // State
  canSave: boolean;
  saving: boolean;
  pendingEventCount?: number;
}

// ============================================
// Time Formatting
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
  
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

// ============================================
// Main Component
// ============================================

export function ActivityHeader({
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
  canSave,
  saving,
  pendingEventCount = 0,
}: ActivityHeaderProps) {
  const isAddMode = mode === 'add';
  
  // Theme colors based on mode
  const headerBg = isAddMode ? 'bg-blue-500' : 'bg-amber-500';
  const headerText = 'text-white';
  
  return (
    <header className={cn(
      'sticky top-0 z-20',
      headerBg,
      'shadow-md'
    )}>
      {/* Top row: Title + Category Path */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h1 className={cn('text-lg font-semibold', headerText)}>
            {isAddMode ? messages.addActivity : messages.editActivity}
          </h1>
          
          {/* Pending events badge (Add mode) */}
          {isAddMode && pendingEventCount > 0 && (
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingEventCount} saved
            </span>
          )}
        </div>
        
        {/* Category chain */}
        <p className={cn('text-sm mt-1 opacity-90', headerText)}>
          {categoryPath.join(' > ')}
        </p>
      </div>
      
      {/* Middle row: Timers (Add) or Date/Duration (Edit) */}
      <div className="px-4 py-2 bg-black/10">
        {isAddMode ? (
          // Add mode: Session + Lap timers
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
          // Edit mode: Date/Time picker + Duration
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-xs">📅</span>
              {dateTime && onDateTimeChange ? (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateTime.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(dateTime);
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      newDate.setFullYear(year, month - 1, day);
                      onDateTimeChange(newDate);
                    }}
                    className="bg-white/20 text-white border-0 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-white/50"
                  />
                  <input
                    type="time"
                    value={dateTime.toTimeString().slice(0, 5)}
                    onChange={(e) => {
                      const newDate = new Date(dateTime);
                      const [hours, minutes] = e.target.value.split(':').map(Number);
                      newDate.setHours(hours, minutes);
                      onDateTimeChange(newDate);
                    }}
                    className="bg-white/20 text-white border-0 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-white/50"
                  />
                </div>
              ) : (
                <span className="text-white font-medium">
                  {dateTime?.toLocaleDateString()} {dateTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      
      {/* Bottom row: Action buttons */}
      <div className="px-4 py-2 flex items-center justify-between gap-2">
        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-white/20 hover:bg-white/30',
            'text-white',
            'transition-colors',
            'disabled:opacity-50'
          )}
          title={messages.cancel}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          {/* Save + Continue (Add mode only) */}
          {isAddMode && onSaveContinue && (
            <button
              type="button"
              onClick={onSaveContinue}
              disabled={!canSave || saving}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium',
                'bg-green-500 hover:bg-green-600 text-white',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
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
          
          {/* Finish (Add) / Save (Edit) */}
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium',
              isAddMode 
                ? 'bg-teal-500 hover:bg-teal-600' 
                : 'bg-amber-600 hover:bg-amber-700',
              'text-white',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{isAddMode ? messages.finish : messages.save}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================
// Export timer formatting for use elsewhere
// ============================================

export { formatTimer, formatDuration };
