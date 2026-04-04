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

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

function copyEmail(email: string) {
  navigator.clipboard.writeText(email).then(
    () => toast.success('Email copied'),
    () => toast.error('Could not copy email'),
  );
}

// --------------------------------------------------------
// Request write access modal
// --------------------------------------------------------

function RequestAccessModal({
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Request write access</h3>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">{areaName}</span> is owned by{' '}
          <span className="font-medium">{ownerName || ownerEmail}</span>.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Sharing is managed at the Area level. To request write access, contact the owner directly:
        </p>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-5">
          <span className="text-sm font-medium text-gray-800 flex-1 truncate">{ownerEmail}</span>
          <button
            onClick={() => { copyEmail(ownerEmail); onClose(); }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Copy email
          </button>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Owner banner (Structure tab only)
// --------------------------------------------------------

function OwnerBanner({
  grantees,
  onManageAccess,
}: {
  grantees: GranteeSummary[];
  onManageAccess?: () => void;
}) {
  const summary = grantees.map(g => `${g.name} (${g.permission})`).join(', ');

  return (
    <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-lg text-sm">
      <span className="mt-0.5">🔗</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-purple-900">This Area is shared</span>
        {summary && (
          <span className="text-purple-700"> — {summary}. Structure changes affect all users.</span>
        )}
      </div>
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
// Write grantee banner
// --------------------------------------------------------

function WriteGranteeBanner({
  areaName,
  ownerName,
  ownerEmail,
}: {
  areaName: string;
  ownerName: string;
  ownerEmail: string;
}) {
  return (
    <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm">
      <span className="mt-0.5">✅</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-green-900">{areaName}</span>
        <span className="text-green-700"> — shared Area (write access). Owned by </span>
        <span className="font-medium text-green-900">{ownerName || ownerEmail}</span>
        {ownerEmail && (
          <>
            <span className="text-green-600"> · {ownerEmail}</span>
            <button
              onClick={() => copyEmail(ownerEmail)}
              className="ml-1.5 text-xs text-green-600 hover:text-green-800 underline"
            >
              Copy email
            </button>
          </>
        )}
        <div className="text-xs text-green-600 mt-0.5">Structure is read-only for you.</div>
      </div>
    </div>
  );
}

// --------------------------------------------------------
// Read grantee banner
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
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <span className="mt-0.5">👁</span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-amber-900">{areaName}</span>
          <span className="text-amber-700"> — shared Area (read only). Owned by </span>
          <span className="font-medium text-amber-900">{ownerName || ownerEmail}</span>
          {ownerEmail && (
            <>
              <span className="text-amber-600"> · {ownerEmail}</span>
              <button
                onClick={() => copyEmail(ownerEmail)}
                className="ml-1.5 text-xs text-amber-600 hover:text-amber-800 underline"
              >
                Copy email
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-xs font-medium transition-colors"
        >
          ✉ Request write access
        </button>
      </div>

      {showModal && (
        <RequestAccessModal
          areaName={areaName}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          onClose={() => setShowModal(false)}
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

  // For owner view: fetch grantees when area changes
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
  }, [filter.areaId, sharedContext]);

  // No banner if no area selected
  if (!filter.areaId) return null;

  // Grantee banners
  if (sharedContext) {
    const { permission, ownerDisplayName, ownerEmail } = sharedContext;
    if (permission === 'write') {
      return (
        <WriteGranteeBanner
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
