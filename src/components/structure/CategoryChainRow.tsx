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
//
// S22: onAddCategory + onAddLeaf unified → onAddChild (available on ALL node types)
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import type { StructureNode } from '@/types/structure';

// Approximate pixel height of the largest possible menu
// (Non-leaf in edit mode: View + Edit + Add Child + Add Between + Delete = 5 items × ~40px)
const MENU_HEIGHT = 220;

interface CategoryChainRowProps {
  node: StructureNode;
  isEditMode: boolean;
  isHighlighted?: boolean;
  onView: (node: StructureNode) => void;
  onEdit?: (node: StructureNode) => void;
  onDelete?: (node: StructureNode) => void;
  /** Add a child category under this node — available on Area, non-leaf, AND leaf */
  onAddChild?: (node: StructureNode) => void;
  onAddBetween?: (node: StructureNode) => void;     // Non-leaf: "Add Between" (placeholder)
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

  return createPortal(
    <>
      {/* Backdrop — closes menu on outside click */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* Menu panel — fixed so it escapes any overflow:hidden ancestor */}
      <div
        className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
        style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}
      >
        {/* View — always available */}
        {item('View', '👁', () => onView(node))}

        {isEditMode && (
          <>
            {/* Area-specific actions */}
            {node.nodeType === 'area' && (
              <>
                {item('Edit', '✏️', () => onEdit?.(node))}
                {item('+ Add Child', '➕', () => onAddChild?.(node))}
                {item('Delete', '🗑️', () => onDelete?.(node), true)}
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
}: CategoryChainRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
