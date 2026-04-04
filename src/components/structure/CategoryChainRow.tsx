// ============================================================
// CategoryChainRow.tsx
// ============================================================
// One row in the Structure Table View.
// Renders full path text with level-based color coding (Option B).
// Actions menu varies by node type: area / non-leaf / leaf.
//
// Menu uses fixed positioning via createPortal (same as ActivitiesTable)
// so it never clips inside scroll containers. Flip-up logic ensures
// the menu stays on screen when opened near the bottom of the viewport.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import type { StructureNode } from '@/types/structure';
import type { SharedContext } from '@/hooks/useDataShares';

// Approximate pixel height of the largest possible menu
// (non-leaf in edit mode: View + Edit + Add Child + Add Between + Delete = 5 items × ~40px)
const MENU_HEIGHT = 220;

interface CategoryChainRowProps {
  node: StructureNode;
  isEditMode: boolean;
  isHighlighted?: boolean;
  onView: (node: StructureNode) => void;
  onEdit?: (node: StructureNode) => void;
  onDelete?: (node: StructureNode) => void;
  /** Unified add-child callback for all node types (S22: replaces onAddCategory + onAddLeaf) */
  onAddChild?: (node: StructureNode) => void;
  onAddBetween?: (node: StructureNode) => void;     // Non-leaf: "Add Between" (placeholder)
  /** Collab: shared context for grantee-specific menu (null = current user is owner) */
  sharedContext?: SharedContext | null;
  /** Owner only: open Share Management modal for this area node (Faza 7) */
  onManageAccess?: (node: StructureNode) => void;
}

// --------------------------------------------------------
// Level → row style (left border + background) — Option B
// All defined as static strings per Code Guidelines 7.1
// --------------------------------------------------------
function rowStyle(node: StructureNode): string {
  const t = THEME.structure;
  if (node.nodeType === 'area') return t.rowArea;
  if (node.level === 1) return t.rowL1;
  if (node.level === 2) return t.rowL2;
  if (node.isLeaf) return t.rowLeaf;
  return t.rowDeep;
}

// --------------------------------------------------------
// Actions menu icon
// --------------------------------------------------------
const DotsIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
  </svg>
);

// --------------------------------------------------------
// Actions dropdown menu (rendered via portal, fixed positioning)
// --------------------------------------------------------
interface ActionsMenuProps {
  node: StructureNode;
  isEditMode: boolean;
  menuPos: { top?: number; bottom?: number; right: number };
  onClose: () => void;
  onView: (node: StructureNode) => void;
  onEdit?: (node: StructureNode) => void;
  onDelete?: (node: StructureNode) => void;
  onAddChild?: (node: StructureNode) => void;
  onAddBetween?: (node: StructureNode) => void;
  sharedContext?: SharedContext | null;
  onManageAccess?: (node: StructureNode) => void;
  onRequestAccess?: () => void;
}

function ActionsMenu({
  node,
  isEditMode,
  menuPos,
  onClose,
  onView,
  onEdit,
  onDelete,
  onAddChild,
  onAddBetween,
  sharedContext,
  onManageAccess,
  onRequestAccess,
}: ActionsMenuProps) {
  const item = (label: string, icon: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => { onClick(); onClose(); }}
      className={cn(
        'w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-100',
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );

  // Non-interactive info row (owner info for grantee)
  const infoRow = (icon: string, text: string) => (
    <div
      key={text}
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 cursor-default"
    >
      <span>{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );

  return createPortal(
    <>
      {/* Backdrop — closes menu on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Menu panel — fixed so it escapes any overflow:hidden ancestor */}
      <div
        className="fixed w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
        style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}
      >
        {/* View — always available */}
        {item('View details', '👁', () => onView(node))}

        {sharedContext ? (
          // ── Grantee menu ──────────────────────────────
          <div className="border-t border-gray-100 mt-1 pt-1">
            {infoRow(
              '👤',
              `Owner: ${sharedContext.ownerDisplayName || sharedContext.ownerEmail || 'Unknown'}`,
            )}
            {sharedContext.ownerEmail && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sharedContext.ownerEmail).then(
                    () => toast.success('Email copied'),
                    () => toast.error('Could not copy'),
                  );
                  onClose();
                }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span>📋</span>
                <span>Copy owner email</span>
              </button>
            )}
            {sharedContext.permission === 'read' && (
              <button
                onClick={() => { onRequestAccess?.(); onClose(); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span>✉</span>
                <span>Request write access</span>
              </button>
            )}
          </div>
        ) : (
          // ── Owner menu ────────────────────────────────
          isEditMode && (
            <>
              {/* Area-specific actions */}
              {node.nodeType === 'area' && (
                <>
                  {item('Edit', '✏️', () => onEdit?.(node))}
                  {item('+ Add Child', '➕', () => onAddChild?.(node))}
                  {item('Delete', '🗑️', () => onDelete?.(node), true)}
                  <div className="my-1 border-t border-gray-100" />
                  {item(
                    'Manage Access',
                    '⚙️',
                    () => onManageAccess ? onManageAccess(node) : toast('Share Management — coming soon'),
                  )}
                </>
              )}

              {/* Non-leaf category actions */}
              {node.nodeType === 'category' && !node.isLeaf && (
                <>
                  {item('Edit', '✏️', () => onEdit?.(node))}
                  {item('+ Add Child', '➕', () => onAddChild?.(node))}
                  {item('Add Between', '↕️', () => onAddBetween?.(node))}
                  {item('Delete', '🗑️', () => onDelete?.(node), true)}
                </>
              )}

              {/* Leaf category actions */}
              {node.nodeType === 'category' && node.isLeaf && (
                <>
                  {item('Edit', '✏️', () => onEdit?.(node))}
                  {item('+ Add Child', '➕', () => onAddChild?.(node))}
                  {item('Delete', '🗑️', () => onDelete?.(node), true)}
                </>
              )}
            </>
          )
        )}
      </div>
    </>,
    document.body,
  );
}

// --------------------------------------------------------
// Main row component
// --------------------------------------------------------
export function CategoryChainRow({
  node,
  isEditMode,
  isHighlighted = false,
  onView,
  onEdit,
  onDelete,
  onAddChild,
  onAddBetween,
  sharedContext,
  onManageAccess,
}: CategoryChainRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = THEME.structure;

  // Calculate menu position with flip-up if near bottom of viewport
  const handleMenuOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = Math.max(window.innerWidth - rect.right, 4);

      if (spaceBelow < MENU_HEIGHT + 8) {
        // Not enough space below — open above the button
        setMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
      } else {
        // Default: open below the button
        setMenuPos({ top: rect.bottom + 4, right });
      }
    }
    setMenuOpen(v => !v);
  }, []);

  // Close menu on scroll (menu is fixed so it would drift otherwise)
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition-colors relative',
        isHighlighted
          ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400'
          : cn('hover:bg-gray-50/50', rowStyle(node)),
      )}
    >
      {/* ---- Path + description ---- */}
      <div className="flex-1 min-w-0">
        {/* Full path — wraps naturally on mobile (no truncation) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm font-medium break-words',
            node.nodeType === 'area' ? 'text-indigo-900 font-semibold' : 'text-gray-800',
          )}>
            {node.fullPath}
          </span>

          {/* Leaf badge */}
          {node.isLeaf && node.nodeType === 'category' && (
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', t.badgeLeaf)}>
              leaf
            </span>
          )}

          {/* No events badge — shown only on leaf with 0 events */}
          {node.isLeaf && node.nodeType === 'category' && node.eventCount === 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400 italic">
              no events yet
            </span>
          )}
        </div>

        {/* Description */}
        {node.description && (
          <p className="mt-0.5 text-xs text-gray-500">
            {node.description}
          </p>
        )}
      </div>

      {/* ---- Attrs badge + Actions menu ---- */}
      <div className="flex-shrink-0 flex items-center gap-2 mt-0.5">
        {node.nodeType === 'category' && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
            node.attrCount > 0 ? t.badgeAttrs : 'bg-gray-100 text-gray-400',
          )}>
            {node.attrCount > 0 ? `${node.attrCount} attrs` : '—'}
          </span>
        )}
        {node.nodeType === 'area' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 whitespace-nowrap">
            —
          </span>
        )}

        {/* ---- Actions menu trigger ---- */}
        <div className="flex-shrink-0">
          <button
            ref={buttonRef}
            onClick={handleMenuOpen}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Actions"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <ActionsMenu
              node={node}
              isEditMode={isEditMode}
              menuPos={menuPos}
              onClose={() => setMenuOpen(false)}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onAddBetween={onAddBetween}
              sharedContext={sharedContext}
              onManageAccess={onManageAccess}
              onRequestAccess={() => setShowRequestModal(true)}
            />
          )}
        </div>
      </div>

      {/* Request write access modal (read grantee) */}
      {showRequestModal && sharedContext && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowRequestModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Request write access</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{node.area.name}</span> is owned by{' '}
              <span className="font-medium">
                {sharedContext.ownerDisplayName || sharedContext.ownerEmail || 'Unknown'}
              </span>.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Sharing is managed at the Area level. To request write access, contact the owner:
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-5">
              <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                {sharedContext.ownerEmail || '(email not available)'}
              </span>
              {sharedContext.ownerEmail && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sharedContext.ownerEmail).then(
                      () => toast.success('Email copied'),
                      () => toast.error('Could not copy'),
                    );
                    setShowRequestModal(false);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Copy email
                </button>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
