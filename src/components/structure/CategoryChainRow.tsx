// ============================================================
// CategoryChainRow.tsx
// ============================================================
// One row in the Structure Table View.
// Renders full path text with level-based color coding (Option B).
// Actions menu varies by node type: area / non-leaf / leaf.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';
import type { StructureNode } from '@/types/structure';

interface CategoryChainRowProps {
  node: StructureNode;
  isEditMode: boolean;
  onView: (node: StructureNode) => void;
  // Edit mode actions — stubs for S18/S19
  onEdit?: (node: StructureNode) => void;
  onDelete?: (node: StructureNode) => void;
  onAddCategory?: (node: StructureNode) => void;   // Area: "Add Category"
  onAddLeaf?: (node: StructureNode) => void;        // Non-leaf: "Add Leaf"
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
// Actions dropdown menu
// --------------------------------------------------------
interface ActionsMenuProps {
  node: StructureNode;
  isEditMode: boolean;
  onClose: () => void;
  onView: (node: StructureNode) => void;
  onEdit?: (node: StructureNode) => void;
  onDelete?: (node: StructureNode) => void;
  onAddCategory?: (node: StructureNode) => void;
  onAddLeaf?: (node: StructureNode) => void;
  onAddBetween?: (node: StructureNode) => void;
}

function ActionsMenu({
  node,
  isEditMode,
  onClose,
  onView,
  onEdit,
  onDelete,
  onAddCategory,
  onAddLeaf,
  onAddBetween,
}: ActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

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

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-8 z-30 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
    >
      {/* View — always available */}
      {item('View', '👁', () => onView(node))}

      {isEditMode && (
        <>
          {/* Area-specific actions */}
          {node.nodeType === 'area' && (
            <>
              {item('Edit', '✏️', () => onEdit?.(node))}
              {item('Add Category', '➕', () => onAddCategory?.(node))}
              {item('Delete', '🗑️', () => onDelete?.(node), true)}
            </>
          )}

          {/* Non-leaf category actions */}
          {node.nodeType === 'category' && !node.isLeaf && (
            <>
              {item('Edit', '✏️', () => onEdit?.(node))}
              {item('Add Leaf', '➕', () => onAddLeaf?.(node))}
              {item('Add Between', '↕️', () => onAddBetween?.(node))}
              {item('Delete', '🗑️', () => onDelete?.(node), true)}
            </>
          )}

          {/* Leaf category actions */}
          {node.nodeType === 'category' && node.isLeaf && (
            <>
              {item('Edit', '✏️', () => onEdit?.(node))}
              {item('Delete', '🗑️', () => onDelete?.(node), true)}
            </>
          )}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------
// Main row component
// --------------------------------------------------------
export function CategoryChainRow({
  node,
  isEditMode,
  onView,
  onEdit,
  onDelete,
  onAddCategory,
  onAddLeaf,
  onAddBetween,
}: CategoryChainRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = THEME.structure;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors relative',
        rowStyle(node),
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

        {/* Description — desktop: same line via flex; mobile: below */}
        {node.description && (
          <p className="mt-0.5 text-xs text-gray-500 truncate sm:truncate-none">
            {node.description}
          </p>
        )}
      </div>

      {/* ---- Attrs badge ---- */}
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

        {/* ---- Actions menu ---- */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Actions"
          >
            <DotsIcon />
          </button>

          {menuOpen && (
            <ActionsMenu
              node={node}
              isEditMode={isEditMode}
              onClose={() => setMenuOpen(false)}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddCategory={onAddCategory}
              onAddLeaf={onAddLeaf}
              onAddBetween={onAddBetween}
            />
          )}
        </div>
      </div>
    </div>
  );
}
