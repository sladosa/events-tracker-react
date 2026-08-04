// ============================================================
// areaOccupants.ts
// ============================================================
// "Who owns this Area, and whose records are inside it?"
//
// Needed when a cascade delete fails on a foreign key: the rows that blocked it
// belong to somebody, and the raw error never says who. `event_attributes` are
// hidden from the owner by RLS, but the `events` they hang off are NOT (the
// owner-fallback policy in 020_orphan_rls.sql covers them), so the roster can
// be read from `events.user_id`.
//
// Anyone listed here who is NOT in the Area's share list is an "orphan" — a
// former grantee whose data stayed behind. That is the usual cause.
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

export interface AreaOccupant {
  userId: string;
  /** display_name ?? email ?? shortened uuid */
  label: string;
  eventCount: number;
  isOwner: boolean;
  isYou: boolean;
  /** true when they hold no active share on this Area (former grantee) */
  isOrphan: boolean;
}

export interface AreaRoster {
  ownerLabel: string | null;
  occupants: AreaOccupant[];
}

/** Resolve user ids to a human label via `profiles`. */
async function labelsFor(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', userIds);
  for (const p of data ?? []) {
    const row = p as { id: string; email?: string; display_name?: string | null };
    out.set(row.id, row.display_name || row.email || `${row.id.slice(0, 8)}…`);
  }
  return out;
}

/**
 * Roster of everyone holding events under `categoryIds`, plus the Area owner.
 * Best-effort: returns what it can and never throws — it runs on an error path,
 * where a second failure must not replace the message the user came for.
 */
export async function fetchAreaRoster(
  areaOwnerId: UUID | null,
  categoryIds: string[],
  currentUserId: string | null,
  areaId: UUID,
): Promise<AreaRoster> {
  try {
    if (categoryIds.length === 0) {
      const labels = await labelsFor(areaOwnerId ? [areaOwnerId] : []);
      return { ownerLabel: areaOwnerId ? labels.get(areaOwnerId) ?? null : null, occupants: [] };
    }

    const { data: events } = await supabase
      .from('events')
      .select('user_id')
      .in('category_id', categoryIds);

    const counts = new Map<string, number>();
    for (const e of (events ?? []) as { user_id: string | null }[]) {
      const uid = e.user_id ?? 'unknown';
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }

    // Active shares — anyone with events but no share row is an orphan.
    const { data: shares } = await supabase
      .from('data_shares')
      .select('grantee_id')
      .eq('target_id', areaId)
      .eq('share_type', 'area');
    const shared = new Set((shares ?? []).map(s => (s as { grantee_id: string }).grantee_id));

    const ids = [...counts.keys()].filter(id => id !== 'unknown');
    if (areaOwnerId && !ids.includes(areaOwnerId)) ids.push(areaOwnerId);
    const labels = await labelsFor(ids);

    const occupants: AreaOccupant[] = [...counts.entries()]
      .map(([userId, eventCount]) => ({
        userId,
        label: userId === 'unknown'
          ? 'record with no user'
          : labels.get(userId) ?? `${userId.slice(0, 8)}…`,
        eventCount,
        isOwner: userId === areaOwnerId,
        isYou: userId === currentUserId,
        isOrphan: userId !== areaOwnerId && userId !== 'unknown' && !shared.has(userId),
      }))
      .sort((a, b) => b.eventCount - a.eventCount);

    return {
      ownerLabel: areaOwnerId ? labels.get(areaOwnerId) ?? null : null,
      occupants,
    };
  } catch {
    return { ownerLabel: null, occupants: [] };
  }
}
