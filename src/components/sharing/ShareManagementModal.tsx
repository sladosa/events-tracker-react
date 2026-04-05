// ============================================================
// ShareManagementModal.tsx — Faza 7
// ============================================================
// Owner-only modal for managing who has access to an Area.
//
// Sections:
//   - Active access: DataShareWithProfile list + [Revoke]
//   - Pending invites: share_invites (status=pending) + [Cancel]
//   - Invite form: email + permission dropdown + [Invite]
//   - Help text (compact, always visible on desktop)
//
// Entry points (all in AppHome.tsx):
//   1. 🔗 Manage Access badge in filter bar (areaHasActiveShares)
//   2. ⚙ Manage Access in Structure tab OwnerBanner
//   3. ⚙ Manage Access in CategoryChainRow ⋮ menu (area-level)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/cn';
import { useDataShares } from '@/hooks/useDataShares';
import type { UUID, DataShareWithProfile, ShareInvite, SharePermission } from '@/types/database';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface ShareManagementModalProps {
  areaId: UUID;
  areaName: string;
  onClose: () => void;
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function ShareManagementModal({ areaId, areaName, onClose }: ShareManagementModalProps) {
  const { shares, loading, listShares, createShare, revokeShare, cancelInvite, listInvites } =
    useDataShares();
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<SharePermission>('write');
  const [isInviting, setIsInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<UUID | null>(null);
  const [cancellingId, setCancellingId] = useState<UUID | null>(null);

  // --------------------------------------------------
  // Refresh both shares + pending invites
  // --------------------------------------------------

  const refresh = useCallback(async () => {
    const [, pendingInvites] = await Promise.all([
      listShares(areaId),
      listInvites(areaId),
    ]);
    setInvites(pendingInvites);
  }, [areaId, listShares, listInvites]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setIsInviting(true);
    const result = await createShare(areaId, email, invitePermission);
    setIsInviting(false);
    if (result.error) {
      toast.error(result.error);
    } else if (result.share) {
      toast.success(`Access granted to ${email}`);
      setInviteEmail('');
      await refresh();
    } else if (result.invite) {
      toast.success(`Invite sent to ${email} (pending registration)`);
      setInviteEmail('');
      await refresh();
    }
  };

  const handleRevoke = async (share: DataShareWithProfile) => {
    const email = share.grantee?.email ?? '';
    setRevokingId(share.id);
    const result = await revokeShare(share.id);
    setRevokingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Access revoked for ${email || 'user'}`);
    }
  };

  const handleCancel = async (invite: ShareInvite) => {
    setCancellingId(invite.id);
    const result = await cancelInvite(invite.id);
    setCancellingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Invite cancelled for ${invite.grantee_email}`);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Share &ldquo;{areaName}&rdquo;
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* ── Active access ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Active access
            </h3>
            {loading ? (
              <p className="text-sm text-gray-400 py-2">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No active shares</p>
            ) : (
              <div className="space-y-2">
                {shares.map(share => {
                  const name = share.grantee?.display_name || share.grantee?.email || 'Unknown';
                  const email = share.grantee?.email ?? '';
                  const initials = name.slice(0, 2).toUpperCase();
                  return (
                    <div key={share.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                        {email && <div className="text-xs text-gray-500 truncate">{email}</div>}
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                        share.permission === 'write'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700',
                      )}>
                        {share.permission}
                      </span>
                      <button
                        disabled={revokingId === share.id}
                        onClick={() => handleRevoke(share)}
                        className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {revokingId === share.id ? '…' : 'Revoke'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pending invites ── */}
          {invites.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Pending invites
              </h3>
              <div className="space-y-2">
                {invites.map(invite => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 py-2 px-3 bg-yellow-50 border border-yellow-100 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 truncate">{invite.grantee_email}</div>
                      <div className="text-xs text-gray-400">Waiting for registration</div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                      invite.permission === 'write'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700',
                    )}>
                      {invite.permission}
                    </span>
                    <button
                      disabled={cancellingId === invite.id}
                      onClick={() => handleCancel(invite)}
                      className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {cancellingId === invite.id ? '…' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Invite form ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Invite someone
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isInviting) handleInvite(); }}
                placeholder="email@example.com"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <select
                value={invitePermission}
                onChange={e => setInvitePermission(e.target.value as SharePermission)}
                className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="write">write</option>
                <option value="read">read</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isInviting ? '…' : 'Invite'}
              </button>
            </div>
          </div>

          {/* ── Help text ── */}
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 space-y-1">
            <p>
              Sharing grants access to the entire{' '}
              <strong className="text-gray-500">&ldquo;{areaName}&rdquo;</strong> Area.
            </p>
            <p>
              <strong className="text-gray-500">write</strong> — can add and edit their own
              activities &nbsp;·&nbsp;{' '}
              <strong className="text-gray-500">read</strong> — view only
            </p>
            <p>
              If the invitee doesn&apos;t have an account yet, they&apos;ll get access automatically
              when they register.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
