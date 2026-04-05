// ============================================================
// useDataShares.ts — CRUD za data_shares tablicu
// ============================================================
// Koristi se za Share Management UI (Faza 6) i za FilterContext
// sharedContext detekciju (Faza 2c).
//
// createShare: traži grantee u profiles; ako nije nađen, inserti
//   u share_invites (pending invite — auto-prihvaća se pri registraciji).
// ============================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  UUID,
  DataShare,
  DataShareWithProfile,
  SharePermission,
  ShareInvite,
} from '@/types/database';

// --------------------------------------------
// Return types
// --------------------------------------------

export interface UseDataSharesReturn {
  shares: DataShareWithProfile[];
  loading: boolean;
  error: string | null;
  listShares: (areaId: UUID) => Promise<DataShareWithProfile[]>;
  createShare: (
    areaId: UUID,
    granteeEmail: string,
    permission: SharePermission
  ) => Promise<{ share?: DataShare; invite?: ShareInvite; error?: string }>;
  revokeShare: (shareId: UUID) => Promise<{ error?: string }>;
  cancelInvite: (inviteId: UUID) => Promise<{ error?: string }>;
  listInvites: (areaId: UUID) => Promise<ShareInvite[]>;
}

// --------------------------------------------
// Hook
// --------------------------------------------

export function useDataShares(): UseDataSharesReturn {
  const [shares, setShares] = useState<DataShareWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------
  // listShares — aktivni pristup za danu area
  // ------------------------------------------
  const listShares = useCallback(async (areaId: UUID): Promise<DataShareWithProfile[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('data_shares')
        .select('*, grantee:profiles!data_shares_grantee_id_fkey(id, email, display_name, created_at)')
        .eq('target_id', areaId)
        .eq('share_type', 'area')
        .order('created_at', { ascending: true });

      if (err) throw err;
      const result = (data || []) as DataShareWithProfile[];
      setShares(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Greška pri dohvatu dijeljenja';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------------------------------------
  // createShare — insert u data_shares ili share_invites
  // ------------------------------------------
  const createShare = useCallback(async (
    areaId: UUID,
    granteeEmail: string,
    permission: SharePermission
  ): Promise<{ share?: DataShare; invite?: ShareInvite; error?: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: 'Nisi prijavljen' };

      // Spriječi dijeljenje s vlastitim emailom
      if (granteeEmail.toLowerCase() === user.email?.toLowerCase()) {
        return { error: 'Ne možeš dijeliti Area s vlastitim accountom' };
      }

      // Traži grantee u profiles po emailu
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, email, display_name, created_at')
        .eq('email', granteeEmail.toLowerCase().trim())
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (profileData) {
        // Korisnik postoji — kreiraj data_share direktno
        const { data: shareData, error: shareErr } = await supabase
          .from('data_shares')
          .insert({
            owner_id: user.id,
            grantee_id: profileData.id,
            share_type: 'area',
            target_id: areaId,
            permission,
          })
          .select()
          .single();

        if (shareErr) {
          if (shareErr.code === '23505') {
            return { error: 'Ovaj korisnik već ima pristup ovoj Area-i' };
          }
          throw shareErr;
        }
        return { share: shareData as DataShare };
      } else {
        // Korisnik još nije registriran — kreiraj pending invite
        const { data: inviteData, error: inviteErr } = await supabase
          .from('share_invites')
          .insert({
            owner_id: user.id,
            grantee_email: granteeEmail.toLowerCase().trim(),
            share_type: 'area',
            target_id: areaId,
            permission,
            status: 'pending',
          })
          .select()
          .single();

        if (inviteErr) {
          if (inviteErr.code === '23505') {
            return { error: 'Pending invite za ovaj email već postoji' };
          }
          throw inviteErr;
        }
        return { invite: inviteData as ShareInvite };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Greška pri kreiranju dijeljenja';
      return { error: msg };
    }
  }, []);

  // ------------------------------------------
  // revokeShare — briše aktivan data_share
  // ------------------------------------------
  const revokeShare = useCallback(async (shareId: UUID): Promise<{ error?: string }> => {
    try {
      const { error: err } = await supabase
        .from('data_shares')
        .delete()
        .eq('id', shareId);

      if (err) throw err;
      setShares(prev => prev.filter(s => s.id !== shareId));
      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Greška pri opozivanju pristupa';
      return { error: msg };
    }
  }, []);

  // ------------------------------------------
  // listInvites — pending invites za danu area
  // ------------------------------------------
  const listInvites = useCallback(async (areaId: UUID): Promise<ShareInvite[]> => {
    try {
      const { data, error: err } = await supabase
        .from('share_invites')
        .select('*')
        .eq('target_id', areaId)
        .eq('share_type', 'area')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (err) throw err;
      return (data || []) as ShareInvite[];
    } catch (err) {
      console.error('Error fetching invites:', err);
      return [];
    }
  }, []);

  // ------------------------------------------
  // cancelInvite — briše pending invite
  // ------------------------------------------
  const cancelInvite = useCallback(async (inviteId: UUID): Promise<{ error?: string }> => {
    try {
      const { error: err } = await supabase
        .from('share_invites')
        .delete()
        .eq('id', inviteId);

      if (err) throw err;
      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Greška pri otkazivanju invite-a';
      return { error: msg };
    }
  }, []);

  return {
    shares,
    loading,
    error,
    listShares,
    createShare,
    revokeShare,
    cancelInvite,
    listInvites,
  };
}

// --------------------------------------------
// Standalone helper: dohvati sharedContext za
// danu areaId i currentUser. Koristi FilterContext.
// Vraca null ako korisnik nije grantee za tu Area.
// --------------------------------------------

export interface SharedContext {
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  permission: SharePermission;
}

export async function fetchSharedContext(
  areaId: UUID | null,
  userId: string | null
): Promise<SharedContext | null> {
  if (!areaId || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('data_shares')
      .select('owner_id, permission')
      .eq('target_id', areaId)
      .eq('grantee_id', userId)
      .neq('owner_id', userId)
      .eq('share_type', 'area')
      .maybeSingle();

    if (error || !data) return null;

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', data.owner_id)
      .maybeSingle();

    return {
      ownerId: data.owner_id as string,
      ownerEmail: (ownerProfile as { email?: string } | null)?.email ?? '',
      ownerDisplayName:
        (ownerProfile as { display_name?: string | null } | null)?.display_name
        ?? (ownerProfile as { email?: string } | null)?.email
        ?? '',
      permission: data.permission as SharePermission,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------
// Standalone helper: dohvati listu grantee-a za
// area kojom upravlja trenutni korisnik (owner view).
// --------------------------------------------

export interface GranteeSummary {
  name: string;
  email: string;
  permission: SharePermission;
}

export async function fetchAreaGrantees(areaId: UUID): Promise<GranteeSummary[]> {
  try {
    const { data, error } = await supabase
      .from('data_shares')
      .select('permission, grantee_id')
      .eq('target_id', areaId)
      .eq('share_type', 'area')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return [];

    const granteeIds = data.map(s => s.grantee_id as string);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', granteeIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p]));

    return data.map(s => {
      const p = profileMap.get(s.grantee_id as string);
      return {
        name: p?.display_name ?? p?.email ?? 'Unknown',
        email: (p?.email as string | undefined) ?? '',
        permission: s.permission as SharePermission,
      };
    });
  } catch {
    return [];
  }
}
