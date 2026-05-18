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
import { supabase } from '@/lib/supabaseClient';
import { useDataShares } from '@/hooks/useDataShares';
import type { UUID, DataShareWithProfile, ShareInvite, SharePermission } from '@/types/database';

// --------------------------------------------------------
// Props
// --------------------------------------------------------

interface ShareManagementModalProps {
  areaId: UUID;
  areaName: string;
  onClose: () => void;
  /** Pre-fill invite email (e.g. from Re-invite orphan flow) */
  initialInviteEmail?: string;
}

// --------------------------------------------------------
// Main component
// --------------------------------------------------------

export function ShareManagementModal({ areaId, areaName, onClose, initialInviteEmail }: ShareManagementModalProps) {
  const { shares, loading, listShares, createShare, updateSharePermission, revokeShare, cancelInvite, listInvites } =
    useDataShares();
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState(initialInviteEmail ?? '');
  const [invitePermission, setInvitePermission] = useState<SharePermission>('write');
  const [isInviting, setIsInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<UUID | null>(null);
  const [cancellingId, setCancellingId] = useState<UUID | null>(null);
  const [updatingPermId, setUpdatingPermId] = useState<UUID | null>(null);
  const [gettingLinkForId, setGettingLinkForId] = useState<UUID | null>(null);
  const [messageBox, setMessageBox] = useState<{ toEmail: string; body: string } | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [subjectCopied, setSubjectCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const INVITE_SUBJECT = 'Invite to Events Tracker';
  const [callerInfo, setCallerInfo] = useState<{ email: string; name: string; id: string } | null>(null);
  // Revoke-with-events flow
  const [revokeTarget, setRevokeTarget] = useState<{
    share: DataShareWithProfile;
    eventCount: number;
    eventIds: string[];
  } | null>(null);
  const [revokeChecking, setRevokeChecking] = useState<UUID | null>(null);
  const [revokeAction, setRevokeAction] = useState<'revoke_only' | 'claim' | 'delete'>('revoke_only');
  const [revokeExecuting, setRevokeExecuting] = useState(false);
  // Help panel: collapsed on mobile by default (expanded via ❓ toggle); always visible on desktop via CSS
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', user.id)
        .maybeSingle();
      const email = (profile as { email?: string } | null)?.email ?? user.email ?? '';
      const displayName = (profile as { display_name?: string | null } | null)?.display_name;
      setCallerInfo({ email, name: displayName ?? email.split('@')[0], id: user.id });
    });
  }, []);

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

  const DATA_NOTE = `Note: your activities will be stored in the shared area. You can copy them to your own area at any time using the "Take your data" option in the area menu.`;

  const buildMessage = (toEmail: string, inviteUrl: string | null): { toEmail: string; body: string } => {
    const name = callerInfo?.name ?? 'Someone';
    const email = callerInfo?.email ?? '';
    if (inviteUrl) {
      return {
        toEmail,
        body: `${name} (${email}) has shared the "${areaName}" area with you in Events Tracker.\n\nSet your password and access the app:\n${inviteUrl}\n\n${DATA_NOTE}`,
      };
    }
    return {
      toEmail,
      body: `${name} (${email}) has shared the "${areaName}" area with you in Events Tracker.\n\nYou can access it now — just sign in at:\n${window.location.origin}\n\n${DATA_NOTE}`,
    };
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setIsInviting(true);
    const result = await createShare(areaId, email, invitePermission, areaName);
    setIsInviting(false);
    if (result.error) {
      toast.error(result.error);
    } else if (result.share) {
      setInviteEmail('');
      setMessageBox(buildMessage(email, null));
      window.dispatchEvent(new CustomEvent('shares-changed'));
      await refresh();
    } else if (result.invite) {
      setInviteEmail('');
      setMessageBox(buildMessage(email, result.invite_link ?? null));
      await refresh();
    }
  };

  const handleGetLinkForInvite = async (invite: ShareInvite) => {
    setGettingLinkForId(invite.id);
    const result = await createShare(areaId, invite.grantee_email, invite.permission, areaName);
    setGettingLinkForId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      setMessageBox(buildMessage(invite.grantee_email, result.invite_link ?? null));
    }
  };

  const handlePermissionChange = async (share: DataShareWithProfile, permission: SharePermission) => {
    setUpdatingPermId(share.id);
    const result = await updateSharePermission(share.id, permission);
    setUpdatingPermId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Permission updated to ${permission}`);
    }
  };

  const doSimpleRevoke = async (share: DataShareWithProfile) => {
    const email = share.grantee?.email ?? '';
    setRevokingId(share.id);
    const result = await revokeShare(share.id);
    setRevokingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Access revoked for ${email || 'user'}`);
      window.dispatchEvent(new CustomEvent('shares-changed'));
      await refresh();
    }
  };

  const handleRevoke = async (share: DataShareWithProfile) => {
    setRevokeChecking(share.id);

    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .eq('area_id', areaId);
    const catIds = (cats ?? []).map((c: { id: string }) => c.id);

    if (catIds.length > 0) {
      const { data: evtData } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', share.grantee_id)
        .in('category_id', catIds);
      const eventIds = (evtData ?? []).map((e: { id: string }) => e.id);

      setRevokeChecking(null);

      if (eventIds.length > 0) {
        setRevokeTarget({ share, eventCount: eventIds.length, eventIds });
        setRevokeAction('revoke_only');
        return;
      }
    } else {
      setRevokeChecking(null);
    }

    await doSimpleRevoke(share);
  };

  const handleRevokeWithAction = async () => {
    if (!revokeTarget || !callerInfo) return;
    const { share, eventIds } = revokeTarget;
    const email = share.grantee?.email ?? '';
    const CHUNK = 200;

    setRevokeExecuting(true);

    const result = await revokeShare(share.id);
    if (result.error) {
      toast.error(result.error);
      setRevokeExecuting(false);
      return;
    }

    if (revokeAction === 'claim') {
      try {
        for (let i = 0; i < eventIds.length; i += CHUNK) {
          const chunk = eventIds.slice(i, i + CHUNK);
          await supabase.from('event_attributes').update({ user_id: callerInfo.id }).in('event_id', chunk);
          await supabase.from('events').update({ user_id: callerInfo.id }).in('id', chunk);
        }
        toast.success(`Revoked and claimed ${eventIds.length} events from ${email || 'user'}`);
      } catch {
        toast.error('Access revoked, but some events could not be claimed. Check Orphan Events.');
      }
    } else if (revokeAction === 'delete') {
      try {
        for (let i = 0; i < eventIds.length; i += CHUNK) {
          const chunk = eventIds.slice(i, i + CHUNK);
          await supabase.from('event_attachments').delete().in('event_id', chunk);
          await supabase.from('event_attributes').delete().in('event_id', chunk);
          await supabase.from('events').delete().in('id', chunk);
        }
        toast.success(`Revoked and deleted ${eventIds.length} events from ${email || 'user'}`);
      } catch {
        toast.error('Access revoked, but some events could not be deleted. Check Orphan Events.');
      }
    } else {
      toast.success(`Access revoked for ${email || 'user'}. Events visible in Orphan Events.`);
    }

    setRevokeExecuting(false);
    setRevokeTarget(null);
    window.dispatchEvent(new CustomEvent('shares-changed'));
    await refresh();
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

          {/* ── Revoke-with-events decision panel ── */}
          {revokeTarget && (
            <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {revokeTarget.share.grantee?.display_name || revokeTarget.share.grantee?.email || 'This user'} has{' '}
                    <strong>{revokeTarget.eventCount}</strong> events in this area.
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Choose what happens to their data when access is revoked:</p>
                </div>
              </div>

              <div className="space-y-2">
                {([
                  { value: 'revoke_only' as const, label: 'Revoke only', desc: 'Events stay in DB — manage later via Orphan Events banner' },
                  { value: 'claim' as const, label: 'Claim events', desc: "Events will appear as yours (user_id changed to yours)" },
                  { value: 'delete' as const, label: 'Delete events', desc: 'Permanently delete all their events and attributes' },
                ] as const).map(opt => (
                  <label key={opt.value} className={cn(
                    'flex gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors',
                    revokeAction === opt.value
                      ? opt.value === 'delete' ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-white'
                      : 'border-amber-200 bg-white hover:border-amber-300',
                  )}>
                    <input
                      type="radio"
                      name="revokeAction"
                      value={opt.value}
                      checked={revokeAction === opt.value}
                      onChange={() => setRevokeAction(opt.value)}
                      className="mt-0.5 accent-amber-600 shrink-0"
                    />
                    <div>
                      <p className={cn('text-xs font-semibold', opt.value === 'delete' ? 'text-red-700' : 'text-gray-800')}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  disabled={revokeExecuting}
                  onClick={() => setRevokeTarget(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={revokeExecuting}
                  onClick={handleRevokeWithAction}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50',
                    revokeAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700',
                  )}
                >
                  {revokeExecuting ? '…' : 'Confirm revoke'}
                </button>
              </div>
            </div>
          )}

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
                      <select
                        value={share.permission}
                        disabled={updatingPermId === share.id}
                        onChange={e => handlePermissionChange(share, e.target.value as SharePermission)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400',
                          share.permission === 'write'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700',
                          updatingPermId === share.id && 'opacity-50',
                        )}
                      >
                        <option value="write">write</option>
                        <option value="read">read</option>
                      </select>
                      <button
                        disabled={revokingId === share.id || revokeChecking === share.id || revokeExecuting}
                        onClick={() => handleRevoke(share)}
                        className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {(revokingId === share.id || revokeChecking === share.id) ? '…' : 'Revoke'}
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
                      disabled={gettingLinkForId === invite.id}
                      onClick={() => handleGetLinkForInvite(invite)}
                      className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {gettingLinkForId === invite.id ? '…' : 'Copy link'}
                    </button>
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

          {/* ── Message box — shown after invite/share; copy to send via any channel ── */}
          {messageBox && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* TO row */}
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-10 flex-shrink-0">TO</span>
                <span className="flex-1 text-sm text-gray-800 font-medium truncate">{messageBox.toEmail}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(messageBox.toEmail);
                    setEmailCopied(true);
                    setTimeout(() => setEmailCopied(false), 2000);
                  }}
                  className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-md transition-colors flex-shrink-0"
                >
                  {emailCopied ? '✓' : 'Copy'}
                </button>
              </div>
              {/* Subject row */}
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-10 flex-shrink-0">SUBJ</span>
                <span className="flex-1 text-sm text-gray-700 truncate">{INVITE_SUBJECT}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(INVITE_SUBJECT);
                    setSubjectCopied(true);
                    setTimeout(() => setSubjectCopied(false), 2000);
                  }}
                  className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-md transition-colors flex-shrink-0"
                >
                  {subjectCopied ? '✓' : 'Copy'}
                </button>
              </div>
              {/* Body */}
              <div className="px-4 py-3 bg-white">
                <textarea
                  readOnly
                  value={messageBox.body}
                  rows={5}
                  className="w-full text-sm text-gray-700 bg-transparent border-0 resize-none focus:outline-none leading-relaxed"
                  onFocus={e => e.target.select()}
                />
              </div>
              {/* Actions */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <button
                  onClick={() => { setMessageBox(null); setEmailCopied(false); setSubjectCopied(false); setMessageCopied(false); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(messageBox.body);
                    setMessageCopied(true);
                    setTimeout(() => setMessageCopied(false), 2000);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {messageCopied ? '✓ Copied!' : 'Copy message'}
                </button>
              </div>
            </div>
          )}

          {/* ── Help text — always visible on desktop, toggle on mobile ── */}
          <div className="border-t border-gray-100 pt-3">
            {/* Mobile: ❓ toggle button */}
            <button
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors md:hidden mb-2"
              onClick={() => setHelpOpen(v => !v)}
            >
              <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center font-bold text-[10px] text-gray-400">?</span>
              {helpOpen ? 'Hide help' : 'How does sharing work?'}
            </button>

            {/* Help content: always on desktop (md:block), togglable on mobile */}
            <div className={cn('text-xs text-gray-400 space-y-1.5', helpOpen ? 'block' : 'hidden md:block')}>
              <p>
                Sharing grants access to the entire{' '}
                <strong className="text-gray-500">&ldquo;{areaName}&rdquo;</strong> Area —
                all categories and their activities.
              </p>
              <p>
                <strong className="text-gray-500">write</strong> — grantee can add and edit
                their own activities, export data. Cannot modify category structure.
              </p>
              <p>
                <strong className="text-gray-500">read</strong> — grantee can only view and
                export. Cannot add or edit any activities.
              </p>
              <p>
                If the invitee doesn&apos;t have an account yet, access is granted automatically
                when they register with that email.
              </p>
              <p>
                You can change permissions or revoke access at any time from this panel.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
