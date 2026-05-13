/**
 * OrphanManagementModal.tsx (S75)
 *
 * Shows orphaned users (former grantees who left without data) and lets the
 * owner decide what to do with their remaining events:
 *
 *  [Re-invite]   — opens ShareManagementModal pre-scoped to the area
 *  [Claim all]   — UPDATE events SET user_id = currentUser; same for event_attributes
 *  [Delete all]  — DELETE events (+ attributes + storage attachments)
 *
 * Receives enriched OrphanUserInfo[] from useOrphanUsers hook (no extra fetches
 * needed for display — all data comes from the already-loaded activities list).
 */

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import type { OrphanUserInfo } from '@/hooks/useOrphanUsers';
import type { UUID } from '@/types';

// ── Constants ────────────────────────────────────────────────
const CHUNK = 200; // event IDs per Supabase query

// ── Helpers ──────────────────────────────────────────────────

async function chunkArray<T>(arr: T[], size: number): Promise<T[][]> {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Props ─────────────────────────────────────────────────────

interface OrphanManagementModalProps {
  orphanUsers: OrphanUserInfo[];
  currentUserId: string;
  onClose: () => void;
  /** Open ShareManagementModal for a specific area (Re-invite flow) */
  onOpenShareModal: (areaId: UUID, areaName: string, inviteEmail?: string) => void;
  /** Called after claim/delete so parent can refresh activities */
  onRefresh: () => void;
}

// ── Per-user action state ────────────────────────────────────

type UserAction = 'claim' | 'delete' | null;

interface UserActionState {
  action: UserAction;
  loading: boolean;
  /** Which area to use for Re-invite (only when user has multiple areas, shown as dropdown) */
  reInviteAreaId: UUID | null;
}

// ── Main component ────────────────────────────────────────────

export function OrphanManagementModal({
  orphanUsers,
  currentUserId,
  onClose,
  onOpenShareModal,
  onRefresh,
}: OrphanManagementModalProps) {
  const [actionStates, setActionStates] = useState<Record<string, UserActionState>>({});

  const getState = (userId: string): UserActionState =>
    actionStates[userId] ?? { action: null, loading: false, reInviteAreaId: null };

  const setState = (userId: string, patch: Partial<UserActionState>) =>
    setActionStates(prev => ({
      ...prev,
      [userId]: { ...getState(userId), ...patch },
    }));

  // ── Claim all events for one orphan user ──────────────────

  const handleClaim = async (info: OrphanUserInfo) => {
    setState(info.userId, { loading: true });
    try {
      const eventIds = info.groups.flatMap(g => g.events.map(e => e.id));
      if (eventIds.length === 0) { toast.error('No events found'); return; }

      // UPDATE event_attributes first (while we can still identify them by event_id)
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        const { error } = await supabase
          .from('event_attributes')
          .update({ user_id: currentUserId })
          .in('event_id', chunk);
        if (error) throw error;
      }

      // UPDATE events
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        const { error } = await supabase
          .from('events')
          .update({ user_id: currentUserId })
          .in('id', chunk);
        if (error) throw error;
      }

      toast.success(`Claimed ${eventIds.length} events from ${info.displayName}`);
      setState(info.userId, { action: null, loading: false });
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed');
      setState(info.userId, { loading: false });
    }
  };

  // ── Delete all events for one orphan user ─────────────────

  const handleDelete = async (info: OrphanUserInfo) => {
    setState(info.userId, { loading: true });
    try {
      const eventIds = info.groups.flatMap(g => g.events.map(e => e.id));
      if (eventIds.length === 0) { toast.error('No events found'); return; }

      // Fetch attachment URLs for storage cleanup
      const attachmentPaths: string[] = [];
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        const { data: attachments } = await supabase
          .from('event_attachments')
          .select('url')
          .in('event_id', chunk);
        for (const a of attachments ?? []) {
          const parts = (a as { url: string }).url.split('/activity-attachments/');
          if (parts.length > 1) attachmentPaths.push(parts[1]);
        }
      }

      // Delete storage files (non-fatal)
      if (attachmentPaths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('activity-attachments')
          .remove(attachmentPaths);
        if (storageErr) console.error('Storage cleanup error (non-fatal):', storageErr);
      }

      // Delete event_attachments
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        await supabase.from('event_attachments').delete().in('event_id', chunk);
      }

      // Delete event_attributes
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        await supabase.from('event_attributes').delete().in('event_id', chunk);
      }

      // Delete events
      for (const chunk of await chunkArray(eventIds, CHUNK)) {
        const { error } = await supabase.from('events').delete().in('id', chunk);
        if (error) throw error;
      }

      toast.success(`Deleted ${eventIds.length} events from ${info.displayName}`);
      setState(info.userId, { action: null, loading: false });
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setState(info.userId, { loading: false });
    }
  };

  // ── Re-invite helper ──────────────────────────────────────

  const handleReInvite = (info: OrphanUserInfo, areaId: UUID) => {
    const areaName = info.areaNames.get(areaId) ?? 'Area';
    onClose(); // close orphan modal before opening share modal
    onOpenShareModal(areaId, areaName, info.userEmail || undefined);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Orphan Events</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              These users left your area without taking their data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {orphanUsers.map(info => {
            const state = getState(info.userId);
            const totalEvents = info.groups.reduce((s, g) => s + g.eventCount, 0);
            const areaEntries = [...info.areaNames.entries()];

            return (
              <div key={info.userId} className="px-5 py-4">
                {/* User identity */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{info.displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {info.groups.length} {info.groups.length === 1 ? 'activity' : 'activities'}
                      {' '}· {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
                    </p>
                    {/* Area breakdown */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {areaEntries.map(([areaId, areaName]) => (
                        <span
                          key={areaId}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {areaName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confirm panels */}
                {state.action === 'claim' && !state.loading && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 font-medium mb-2">
                      Claim {totalEvents} events? They will appear as yours.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleClaim(info)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Yes, claim
                      </button>
                      <button
                        onClick={() => setState(info.userId, { action: null })}
                        className="px-3 py-1 text-xs bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {state.action === 'delete' && !state.loading && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-800 font-medium mb-1">
                      Permanently delete {totalEvents} events and all their data?
                    </p>
                    <p className="text-xs text-red-600 mb-2">This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(info)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setState(info.userId, { action: null })}
                        className="px-3 py-1 text-xs bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {state.loading && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                    Working…
                  </div>
                )}

                {/* Action buttons */}
                {!state.loading && (
                  <div className="flex flex-wrap gap-2">
                    {/* Re-invite — one button per area if multiple, single if one */}
                    {areaEntries.length === 1 ? (
                      <button
                        onClick={() => handleReInvite(info, areaEntries[0][0])}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                      >
                        Re-invite to {areaEntries[0][1]}
                      </button>
                    ) : (
                      areaEntries.map(([areaId, areaName]) => (
                        <button
                          key={areaId}
                          onClick={() => handleReInvite(info, areaId)}
                          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                        >
                          Re-invite to {areaName}
                        </button>
                      ))
                    )}

                    <button
                      onClick={() => setState(info.userId, { action: 'claim' })}
                      disabled={state.action !== null}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors disabled:opacity-40"
                    >
                      Claim events
                    </button>

                    <button
                      onClick={() => setState(info.userId, { action: 'delete' })}
                      disabled={state.action !== null}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-40"
                    >
                      Delete events
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
