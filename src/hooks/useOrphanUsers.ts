/**
 * useOrphanUsers.ts
 *
 * Detects "orphan" (user, area) pairs — events from users who no longer have
 * an active data_shares row for THAT SPECIFIC AREA (area-level detection).
 *
 * A user can still be an active grantee on area A while being orphaned on area B
 * (e.g. they were a grantee on both but only left B without data).
 * User-level detection would incorrectly skip them because of the A share.
 *
 * Detection key: `"${userId}:${areaId}"` — present in orphanedPairKeys when
 * the user has events in that area and NO active data_shares for that area.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ActivityGroup } from '@/hooks/useActivities';
import type { UUID } from '@/types';

export interface OrphanUserInfo {
  userId: string;
  displayName: string;
  userEmail: string;
  /** Activity groups belonging to this orphan user IN ORPHAN AREAS ONLY */
  groups: ActivityGroup[];
  /** Orphan area_ids (areas where user has events but no active share) */
  areaIds: UUID[];
  /** area_id → area_name for display and Re-invite */
  areaNames: Map<UUID, string>;
}

interface UseOrphanUsersResult {
  /** Users with at least one orphan (user, area) pair */
  orphanedUserIds: Set<string>;
  /** Set of "userId:areaId" keys where events are orphaned (for per-row check) */
  orphanedPairKeys: Set<string>;
  /** Enriched info per orphaned user (only orphan areas included) */
  orphanUsers: OrphanUserInfo[];
  /** Total orphan activity groups across all users and orphan areas */
  orphanGroupCount: number;
  loading: boolean;
}

interface DetectionResult {
  pairKeys: Set<string>;
  emailMap: Map<string, string>; // userId → raw email
}

export function useOrphanUsers(
  activities: ActivityGroup[],
  currentUserId: string,
): UseOrphanUsersResult {
  const [detection, setDetection] = useState<DetectionResult>({
    pairKeys: new Set(),
    emailMap: new Map(),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId || activities.length === 0) {
      setDetection({ pairKeys: new Set(), emailMap: new Map() });
      return;
    }

    // Collect distinct (userId, areaId) pairs for non-owner events
    const pairMap = new Map<string, { userId: string; areaId: UUID }>();
    for (const g of activities) {
      if (g.user_id === currentUserId || !g.area_id) continue;
      const key = `${g.user_id}:${g.area_id}`;
      if (!pairMap.has(key)) pairMap.set(key, { userId: g.user_id, areaId: g.area_id });
    }

    if (pairMap.size === 0) {
      setDetection({ pairKeys: new Set(), emailMap: new Map() });
      return;
    }

    let cancelled = false;
    setLoading(true);

    const detect = async () => {
      const nonOwnerUserIds = [...new Set([...pairMap.values()].map(p => p.userId))];

      // Parallel: check active shares + fetch emails for non-owner users
      const [shareResult, profileResult] = await Promise.all([
        supabase
          .from('data_shares')
          .select('grantee_id, target_id')
          .eq('owner_id', currentUserId)
          .eq('share_type', 'area')
          .in('grantee_id', nonOwnerUserIds),
        supabase
          .from('profiles')
          .select('id, email')
          .in('id', nonOwnerUserIds),
      ]);

      if (cancelled) return;

      // Build set of active (userId:areaId) pairs
      const activeKeys = new Set(
        (shareResult.data ?? []).map((r: { grantee_id: string; target_id: string }) =>
          `${r.grantee_id}:${r.target_id}`
        )
      );

      // Build email map: userId → email
      const emailMap = new Map<string, string>(
        (profileResult.data ?? []).map((p: { id: string; email?: string | null }) => [
          p.id,
          p.email ?? '',
        ])
      );

      // Orphan pairs = those with no active share for THAT area
      const orphanKeys = new Set<string>();
      for (const [key] of pairMap) {
        if (!activeKeys.has(key)) orphanKeys.add(key);
      }

      setDetection({ pairKeys: orphanKeys, emailMap });
      setLoading(false);
    };

    detect().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activities, currentUserId]);

  const { pairKeys: orphanedPairKeys, emailMap } = detection;

  // Derived: orphanedUserIds — users with at least one orphan pair
  const orphanedUserIds = new Set<string>();
  for (const key of orphanedPairKeys) {
    orphanedUserIds.add(key.split(':')[0]);
  }

  // Derived: OrphanUserInfo per user (only orphan areas)
  const orphanUsersMap = new Map<string, OrphanUserInfo>();
  for (const g of activities) {
    const pairKey = `${g.user_id}:${g.area_id}`;
    if (!orphanedPairKeys.has(pairKey)) continue;

    let info = orphanUsersMap.get(g.user_id);
    if (!info) {
      info = {
        userId: g.user_id,
        displayName: g.user_display_name || g.user_id,
        userEmail: emailMap.get(g.user_id) ?? '',  // from dedicated fetch, not ActivityGroup
        groups: [],
        areaIds: [],
        areaNames: new Map(),
      };
      orphanUsersMap.set(g.user_id, info);
    }
    info.groups.push(g);
    if (g.area_id && !info.areaNames.has(g.area_id)) {
      info.areaIds.push(g.area_id);
      info.areaNames.set(g.area_id, g.area_name);
    }
  }

  const orphanUsers = [...orphanUsersMap.values()];
  const orphanGroupCount = orphanUsers.reduce((s, u) => s + u.groups.length, 0);

  return { orphanedUserIds, orphanedPairKeys, orphanUsers, orphanGroupCount, loading };
}
