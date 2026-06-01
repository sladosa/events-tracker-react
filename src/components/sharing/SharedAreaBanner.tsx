// ============================================================
// SharedAreaBanner.tsx
// ============================================================
// Role-aware banner shown below the filter section when a
// specific shared area is selected.
//
// Owner (Structure tab only):   purple — "This Area is shared"
// Write grantee (both tabs):    green  — owner info + copy email
// Read grantee  (both tabs):    amber  — owner info + request write access
// No area selected:             null   — nothing rendered
// ============================================================

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useFilter } from '@/context/FilterContext';
import { fetchAreaGrantees, type GranteeSummary } from '@/hooks/useDataShares';
import { LeaveAreaModal } from '@/components/sharing/LeaveAreaModal';
import { supabase } from '@/lib/supabaseClient';

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Could not copy'),
  );
}

// --------------------------------------------------------
// Message draft view (shared by both info modals)
// --------------------------------------------------------

function MessageDraftView({
  to,
  subject,
  bodyPrefix,
  bodyFixed,
  customText,
  onCustomTextChange,
  onBack,
}: {
  to: string;
  subject: string;
  /** Fixed prefix shown above the textarea (write grantee mode) */
  bodyPrefix?: string;
  /** Full fixed body (read grantee mode — no textarea) */
  bodyFixed?: string;
  customText?: string;
  onCustomTextChange?: (val: string) => void;
  onBack: () => void;
}) {
  const messageToSend = bodyFixed
    ? bodyFixed
    : `${bodyPrefix ?? ''}${customText ?? ''}`;

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        ← Back
      </button>

      {/* TO */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-xs font-semibold text-gray-500 w-8 shrink-0">TO</span>
        <span className="text-xs text-gray-800 flex-1 truncate">{to}</span>
        <button
          onClick={() => copyToClipboard(to, 'Email')}
          className="px-2 py-0.5 text-xs bg-white border border-gray-300 hover:bg-gray-100 rounded transition-colors shrink-0"
        >
          Copy
        </button>
      </div>

      {/* SUBJ */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-xs font-semibold text-gray-500 w-8 shrink-0">SUBJ</span>
        <span className="text-xs text-gray-800 flex-1">{subject}</span>
        <button
          onClick={() => copyToClipboard(subject, 'Subject')}
          className="px-2 py-0.5 text-xs bg-white border border-gray-300 hover:bg-gray-100 rounded transition-colors shrink-0"
        >
          Copy
        </button>
      </div>

      {/* Body */}
      {bodyFixed ? (
        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 whitespace-pre-line leading-relaxed max-h-44 overflow-y-auto">
          {bodyFixed}
        </div>
      ) : (
        <div className="space-y-0">
          <div className="p-2.5 bg-gray-50 rounded-t-lg border border-b-0 border-gray-200 text-xs text-gray-700 whitespace-pre-line leading-relaxed">
            {bodyPrefix}
          </div>
          <textarea
            className="w-full p-2.5 bg-white border border-gray-200 rounded-b-lg text-xs text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={3}
            placeholder="Type your message here..."
            value={customText ?? ''}
            onChange={e => onCustomTextChange?.(e.target.value)}
          />
        </div>
      )}

      <button
        onClick={() => copyToClipboard(messageToSend, 'Message')}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
      >
        Copy message
      </button>
    </div>
  );
}

// --------------------------------------------------------
// Read grantee info modal (opened via ℹ button)
// --------------------------------------------------------

function ReadGranteeInfoModal({
  areaName,
  ownerName,
  ownerEmail,
  onClose,
}: {
  areaName: string;
  ownerName: string;
  ownerEmail: string;
  onClose: () => void;
}) {
  const [showMessage, setShowMessage] = useState(false);
  const [granteeEmail, setGranteeEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setGranteeEmail(user.email);
    });
  }, []);

  const msgSubject = `Write access request — ${areaName}`;
  const msgBody = [
    `Hi,`,
    ``,
    `${granteeEmail || 'I'} currently have read-only access to your "${areaName}" area in Events Tracker.`,
    ``,
    `Read-only access allows me to:`,
    `✓ View all activities in this Area`,
    `✓ Export activities to Excel`,
    `✗ Cannot add or edit activities`,
    `✗ Cannot modify the category structure`,
    ``,
    `I would like to request write access, which would additionally allow me to:`,
    `+ Add and edit my own activities`,
    ``,
    `Please update the sharing settings if you'd like to grant this.`,
    ``,
    `Thanks`,
  ].join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">👁 Read-only access</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {showMessage ? (
          <MessageDraftView
            to={ownerEmail}
            subject={msgSubject}
            bodyFixed={msgBody}
            onBack={() => setShowMessage(false)}
          />
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">
              <span className="font-medium">{areaName}</span> is owned by{' '}
              <span className="font-medium">{ownerName || ownerEmail}</span>.
            </p>
            {ownerEmail && (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg mb-3">
                <span className="text-xs text-gray-700 flex-1 truncate">{ownerEmail}</span>
                <button
                  onClick={() => setShowMessage(true)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                >
                  Contact owner
                </button>
              </div>
            )}
            <div className="text-xs text-gray-600 space-y-1 mb-4">
              <p className="font-medium text-gray-700 mb-1">What can I do?</p>
              <p>✓ View all activities in this Area</p>
              <p>✓ Export activities to Excel</p>
              <p>✗ Cannot add or edit activities</p>
              <p>✗ Cannot modify the category structure</p>
              <p className="pt-1 text-gray-500">To get write access, contact the owner above.</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Owner banner (Structure tab only)
// --------------------------------------------------------

function OwnerBanner({
  onManageAccess,
}: {
  grantees: GranteeSummary[];
  onManageAccess?: () => void;
}) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm">
      <span>🔗</span>
      <span className="flex-1 font-semibold text-purple-900">This Area is shared</span>
      {onManageAccess && (
        <button
          onClick={onManageAccess}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-xs font-medium transition-colors"
        >
          ⚙ Manage Access
        </button>
      )}
    </div>
  );
}

// --------------------------------------------------------
// Write grantee info modal (opened via ℹ button)
// --------------------------------------------------------

function WriteGranteeInfoModal({
  areaName,
  ownerName,
  ownerEmail,
  onClose,
}: {
  areaName: string;
  ownerName: string;
  ownerEmail: string;
  onClose: () => void;
}) {
  const [showMessage, setShowMessage] = useState(false);
  const [granteeEmail, setGranteeEmail] = useState('');
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setGranteeEmail(user.email);
    });
  }, []);

  const msgSubject = `Note about "${areaName}" area`;
  const msgBodyPrefix = [
    `Hi,`,
    ``,
    `${granteeEmail || 'I'} have write access to your "${areaName}" area in Events Tracker.`,
    ``,
    `Write access rights:`,
    `✓ View all activities in this Area`,
    `✓ Add and edit my own activities`,
    `✓ Export activities to Excel`,
    `✗ Cannot edit other users' activities`,
    `✗ Cannot modify the category structure`,
    ``,
    `Message:`,
    ``,
  ].join('\n');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">✅ Write access</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {showMessage ? (
          <MessageDraftView
            to={ownerEmail}
            subject={msgSubject}
            bodyPrefix={msgBodyPrefix}
            customText={customText}
            onCustomTextChange={setCustomText}
            onBack={() => setShowMessage(false)}
          />
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-3">
              <span className="font-medium">{areaName}</span> is owned by{' '}
              <span className="font-medium">{ownerName || ownerEmail}</span>.
            </p>
            {ownerEmail && (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg mb-3">
                <span className="text-xs text-gray-700 flex-1 truncate">{ownerEmail}</span>
                <button
                  onClick={() => setShowMessage(true)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                >
                  Contact owner
                </button>
              </div>
            )}
            <div className="text-xs text-gray-600 space-y-1 mb-4">
              <p className="font-medium text-gray-700 mb-1">What can I do?</p>
              <p>✓ Add and edit your own activities in this Area</p>
              <p>✓ Export activities to Excel</p>
              <p>✗ Cannot edit other users' activities</p>
              <p>✗ Cannot modify the category structure</p>
              <p className="pt-1 text-gray-500 italic">Your events are stored in {ownerName || 'the owner'}'s area. You can copy them to your own area at any time.</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Write grantee banner — compact single line
// --------------------------------------------------------

function WriteGranteeBanner({
  areaId,
  areaName,
  ownerName,
  ownerEmail,
}: {
  areaId: string;
  areaName: string;
  ownerName: string;
  ownerEmail: string;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
        <span>✅</span>
        <span className="flex-1 font-semibold text-green-900">Write access</span>
        <button
          onClick={() => setShowInfo(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-md text-xs font-medium transition-colors"
        >
          ℹ Info
        </button>
        <button
          onClick={() => setShowLeaveModal(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-md text-xs font-medium transition-colors"
        >
          Take your data
        </button>
      </div>

      {showInfo && (
        <WriteGranteeInfoModal
          areaName={areaName}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          onClose={() => setShowInfo(false)}
        />
      )}

      {showLeaveModal && (
        <LeaveAreaModal
          areaId={areaId}
          areaName={areaName}
          permission="write"
          onClose={() => setShowLeaveModal(false)}
          onDone={() => setShowLeaveModal(false)}
        />
      )}
    </>
  );
}

// --------------------------------------------------------
// Read grantee banner — compact single line
// --------------------------------------------------------

function ReadGranteeBanner({
  areaName,
  ownerName,
  ownerEmail,
}: {
  areaName: string;
  ownerName: string;
  ownerEmail: string;
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <span>👁</span>
        <span className="flex-1 font-semibold text-amber-900">Read-only access</span>
        <button
          onClick={() => setShowInfo(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-xs font-medium transition-colors"
        >
          ℹ Info
        </button>
      </div>

      {showInfo && (
        <ReadGranteeInfoModal
          areaName={areaName}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  );
}

// --------------------------------------------------------
// Main export
// --------------------------------------------------------

interface SharedAreaBannerProps {
  tab: 'activities' | 'structure';
  /** Called when user clicks "Manage Access" (owner, Structure tab). Faza 7. */
  onManageAccess?: () => void;
}

export function SharedAreaBanner({ tab, onManageAccess }: SharedAreaBannerProps) {
  const { filter, sharedContext, fullPathDisplay } = useFilter();
  const [ownerGrantees, setOwnerGrantees] = useState<GranteeSummary[]>([]);

  // Area name = first segment of full path display
  const areaName = fullPathDisplay.split(' > ')[0] || 'Area';

  const [sharesVersion, setSharesVersion] = useState(0);
  useEffect(() => {
    const handler = () => setSharesVersion(v => v + 1);
    window.addEventListener('shares-changed', handler);
    return () => window.removeEventListener('shares-changed', handler);
  }, []);

  // For owner view: fetch grantees when area changes or shares are modified
  useEffect(() => {
    if (sharedContext || !filter.areaId) {
      setOwnerGrantees([]);
      return;
    }
    let cancelled = false;
    fetchAreaGrantees(filter.areaId).then(grantees => {
      if (!cancelled) setOwnerGrantees(grantees);
    });
    return () => { cancelled = true; };
  }, [filter.areaId, sharedContext, sharesVersion]);

  // No banner if no area selected
  if (!filter.areaId) return null;

  // Grantee banners
  if (sharedContext) {
    const { permission, ownerDisplayName, ownerEmail } = sharedContext;
    if (permission === 'write') {
      return (
        <WriteGranteeBanner
          areaId={filter.areaId!}
          areaName={areaName}
          ownerName={ownerDisplayName}
          ownerEmail={ownerEmail}
        />
      );
    }
    return (
      <ReadGranteeBanner
        areaName={areaName}
        ownerName={ownerDisplayName}
        ownerEmail={ownerEmail}
      />
    );
  }

  // Owner banner — only on Structure tab, only when area has active shares
  if (tab === 'structure' && ownerGrantees.length > 0) {
    return (
      <OwnerBanner
        grantees={ownerGrantees}
        onManageAccess={onManageAccess}
      />
    );
  }

  return null;
}
