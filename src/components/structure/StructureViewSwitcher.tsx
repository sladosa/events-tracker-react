// ============================================================
// StructureViewSwitcher.tsx
// ============================================================
// Table | Sunburst toggle for the Structure tab.
// Desktop only — hidden on mobile (Table View is always shown).
// When Edit Mode is active, caller should force viewMode='table'
// and disable the switcher.
// ============================================================

import { cn } from '@/lib/cn';
import { THEME } from '@/lib/theme';

export type StructureViewMode = 'table' | 'sunburst';

interface StructureViewSwitcherProps {
  viewMode: StructureViewMode;
  onChange: (mode: StructureViewMode) => void;
  disabled?: boolean; // true when Edit Mode is active
}

const TableIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h18M3 14h18M10 4v16M3 4h18v16H3z" />
  </svg>
);

const SunburstIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" strokeWidth={2} />
    <circle cx="12" cy="12" r="9" strokeWidth={2} strokeDasharray="4 2" />
  </svg>
);

export function StructureViewSwitcher({
  viewMode,
  onChange,
  disabled = false,
}: StructureViewSwitcherProps) {
  const t = THEME.structure;

  return (
    // hidden on mobile — Structure tab only shows Table View on small screens
    <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => !disabled && onChange('table')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          viewMode === 'table'
            ? cn(t.btnViewSwitch, 'shadow-sm')
            : 'text-gray-500 hover:text-gray-700',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        title="Table View"
      >
        <TableIcon />
        <span>Table</span>
      </button>
      <button
        onClick={() => !disabled && onChange('sunburst')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          viewMode === 'sunburst'
            ? cn(t.btnViewSwitch, 'shadow-sm')
            : 'text-gray-500 hover:text-gray-700',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        title="Sunburst View"
      >
        <SunburstIcon />
        <span>Sunburst</span>
      </button>
    </div>
  );
}
