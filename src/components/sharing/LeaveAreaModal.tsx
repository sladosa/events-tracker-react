/**
 * LeaveAreaModal.tsx
 *
 * Allows a grantee to remove their own access to a shared area.
 *
 * Two paths:
 *   A) Write grantee with own events → "Detach with data" (copies structure +
 *      reassigns events/attrs) OR "Leave without data" (events become inaccessible).
 *   B) Any grantee with 0 events → simple confirm "Leave".
 *
 * After success: dispatches 'areas-changed' (FilterContext auto-resets stale areaId).
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import {
  countGranteeEventsInArea,
  leaveAreaOnly,
  detachAreaWithData,
  type DetachProgress,
} from '@/lib/leaveArea';

// ── Props ─────────────────────────────────────────────────

interface LeaveAreaModalProps {
  areaId: string;
  areaName: string;
  permission: 'read' | 'write';
  onClose: () => void;
  onDone: () => void;
}

// ── State machine ─────────────────────────────────────────

type Phase =
  | { type: 'loading' }
  | { type: 'confirm_simple'; eventCount: number }
  | { type: 'choose'; eventCount: number; selected: 'detach' | 'leave_only' }
  | { type: 'running'; progress: DetachProgress }
  | { type: 'done'; newAreaName?: string }
  | { type: 'error'; message: string };

// ── Step label helper ─────────────────────────────────────

function stepLabel(p: DetachProgress): string {
  switch (p.step) {
    case 'loading': return 'Checking…';
    case 'copying_structure': return p.detail ?? 'Copying structure…';
    case 'moving_attrs': return p.detail ?? 'Migrating attributes…';
    case 'moving_events': return p.detail ?? 'Moving events…';
    case 'leaving': return 'Removing shared access…';
    case 'done': return 'Done!';
  }
}

// ── Component ─────────────────────────────────────────────

export function LeaveAreaModal({
  areaId,
  areaName,
  permission,
  onClose,
  onDone,
}: LeaveAreaModalProps) {

  const [phase, setPhase] = useState<Phase>({ type: 'loading' });

  // Count events on mount
  useEffect(() => {
    countGranteeEventsInArea(areaId).then(count => {
      if (count > 0 && permission === 'write') {
        setPhase({ type: 'choose', eventCount: count, selected: 'detach' });
      } else {
        setPhase({ type: 'confirm_simple', eventCount: count });
      }
    });
  }, [areaId, permission]);

  const handleLeaveOnly = async () => {
    setPhase({ type: 'running', progress: { step: 'leaving', detail: 'Removing shared access…' } });
    const result = await leaveAreaOnly(areaId);
    if (result.error) {
      setPhase({ type: 'error', message: result.error });
    } else {
      window.dispatchEvent(new CustomEvent('areas-changed'));
      setPhase({ type: 'done' });
      setTimeout(onDone, 1500);
    }
  };

  const handleDetach = async () => {
    setPhase({ type: 'running', progress: { step: 'loading' } });
    const result = await detachAreaWithData(
      areaId,
      areaName,
      (p) => setPhase({ type: 'running', progress: p }),
    );
    if (result.error) {
      setPhase({ type: 'error', message: result.error });
    } else {
      window.dispatchEvent(new CustomEvent('areas-changed'));
      setPhase({ type: 'done', newAreaName: areaName });
      setTimeout(onDone, 2500);
    }
  };

  const handlePrimary = () => {
    if (phase.type === 'confirm_simple') return handleLeaveOnly();
    if (phase.type === 'choose') {
      return phase.selected === 'detach' ? handleDetach() : handleLeaveOnly();
    }
  };

  const isRunning = phase.type === 'running';
  const canClose = !isRunning;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && canClose) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-50 border-b border-red-100">
          <h3 className="text-base font-semibold text-red-900">
            Leave shared area
          </h3>
          {canClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-red-100 text-red-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Area name */}
          <div className="text-sm text-gray-700">
            Area: <span className="font-semibold text-gray-900">{areaName}</span>
          </div>

          {/* Loading */}
          {phase.type === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking your data…
            </div>
          )}

          {/* Simple confirm — 0 events or read grantee */}
          {phase.type === 'confirm_simple' && (
            <div className="space-y-3">
              {phase.eventCount === 0 ? (
                <p className="text-sm text-gray-600">
                  You have no events in this area. You will lose access immediately.
                </p>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                  You have <strong>{phase.eventCount}</strong> events in this area. As a read-only
                  grantee you cannot migrate them — they will remain in the database but become
                  inaccessible until the owner re-invites you.
                </div>
              )}
              <p className="text-sm text-gray-500">
                The owner will need to re-invite you if you want access again.
              </p>
            </div>
          )}

          {/* Choose path — write grantee with events */}
          {phase.type === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                You have <strong>{phase.eventCount} events</strong> in this area. What would you like to do?
              </p>

              {/* Option A: Detach with data */}
              <label className={cn(
                'flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                phase.selected === 'detach'
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-200',
              )}>
                <input
                  type="radio"
                  name="leaveMode"
                  checked={phase.selected === 'detach'}
                  onChange={() => setPhase({ ...phase, selected: 'detach' })}
                  className="mt-0.5 accent-indigo-600 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Create my own copy and keep my data
                    <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">recommended</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Copies the area structure to your account and moves your events there.
                    The owner's events stay in the original area.
                  </p>
                </div>
              </label>

              {/* Option B: Leave without data */}
              <label className={cn(
                'flex gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                phase.selected === 'leave_only'
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 hover:border-red-200',
              )}>
                <input
                  type="radio"
                  name="leaveMode"
                  checked={phase.selected === 'leave_only'}
                  onChange={() => setPhase({ ...phase, selected: 'leave_only' })}
                  className="mt-0.5 accent-red-600 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Leave without my data
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your {phase.eventCount} events remain in the database but become inaccessible
                    until the owner re-invites you.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Running */}
          {phase.type === 'running' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 animate-spin text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-gray-700">{stepLabel(phase.progress)}</span>
              </div>
              <p className="text-xs text-gray-400">Please keep this window open…</p>
            </div>
          )}

          {/* Done */}
          {phase.type === 'done' && (
            <div className="flex items-center gap-3 py-2">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-medium text-gray-800">Done!</p>
                {phase.newAreaName && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your data is now in your own area "{phase.newAreaName}".
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {phase.type === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-red-800">Something went wrong</p>
              <p className="text-xs text-red-600 mt-1">{phase.message}</p>
              <p className="text-xs text-gray-500 mt-2">
                Your data is still accessible via the shared area. You can retry or close.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        {(phase.type === 'confirm_simple' || phase.type === 'choose' || phase.type === 'error') && (
          <div className="flex justify-end gap-2 px-5 pb-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>

            {(phase.type === 'confirm_simple' || phase.type === 'choose') && (
              <button
                onClick={handlePrimary}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                  phase.type === 'choose' && phase.selected === 'detach'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-red-600 hover:bg-red-700',
                )}
              >
                {phase.type === 'choose' && phase.selected === 'detach'
                  ? 'Create copy & leave'
                  : 'Leave area'}
              </button>
            )}

            {phase.type === 'error' && (
              <button
                onClick={() => {
                  // Reset to the choose/confirm phase to allow retry
                  countGranteeEventsInArea(areaId).then(count => {
                    if (count > 0 && permission === 'write') {
                      setPhase({ type: 'choose', eventCount: count, selected: 'detach' });
                    } else {
                      setPhase({ type: 'confirm_simple', eventCount: count });
                    }
                  });
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-900 text-white transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
