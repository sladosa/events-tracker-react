import { useEffect, useState, useMemo } from 'react';
import { useFilter } from '@/context/FilterContext';
import { useDateBounds, getDatePresets, formatDateDisplay } from '@/hooks/useDateBounds';

interface DateRangeFilterProps {
  className?: string;
}

// Sentinel value for the All Time option in the <select>
const ALL_TIME_VALUE = '__all_time__';
const CUSTOM_VALUE   = '__custom__';

export function DateRangeFilter({ className = '' }: DateRangeFilterProps) {
  const { filter, setDateRange, setSortOrder } = useFilter();
  const { bounds, loading, refresh } = useDateBounds(filter.areaId, filter.categoryId);

  // Local state for From/To inputs
  const [localFrom, setLocalFrom] = useState<string>('');
  const [localTo, setLocalTo]     = useState<string>('');

  // Track whether user has manually edited dates (bypasses bounds auto-init)
  const [userModified, setUserModified] = useState(false);

  // Presets (stable — getDatePresets() is pure, called once per render is fine)
  const presets = getDatePresets();

  // ── Auto-init from bounds ──────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && bounds.minDate && bounds.maxDate && !userModified) {
      setLocalFrom(bounds.minDate);
      setLocalTo(bounds.maxDate);
      setDateRange(bounds.minDate, bounds.maxDate);
    }
  }, [bounds.minDate, bounds.maxDate, loading, userModified, setDateRange]);

  // ── Sync when filter resets externally (e.g. after import) ─────────────────
  useEffect(() => {
    if (filter.dateFrom && filter.dateTo) {
      setLocalFrom(filter.dateFrom);
      setLocalTo(filter.dateTo);
    } else if (filter.dateFrom === null && filter.dateTo === null) {
      setLocalFrom('');
      setLocalTo('');
      setUserModified(false);
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.dateFrom, filter.dateTo]);

  // ── Manual date input handlers ─────────────────────────────────────────────
  const handleFromChange = (value: string) => {
    setLocalFrom(value);
    setUserModified(true);
    if (value && localTo) setDateRange(value, localTo);
  };

  const handleToChange = (value: string) => {
    setLocalTo(value);
    setUserModified(true);
    if (localFrom && value) setDateRange(localFrom, value);
  };

  // ── Apply preset by label ──────────────────────────────────────────────────
  const handlePreset = (label: string) => {
    if (label === ALL_TIME_VALUE || label === CUSTOM_VALUE) {
      if (label === ALL_TIME_VALUE) handleAllTime();
      return;
    }
    const preset = presets.find(p => p.label === label);
    if (!preset) return;
    const { from, to } = preset.getRange();
    setLocalFrom(from);
    setLocalTo(to);
    setDateRange(from, to);
    setUserModified(true);
  };

  // ── Reset to full data range ───────────────────────────────────────────────
  const handleAllTime = () => {
    if (bounds.minDate && bounds.maxDate) {
      setLocalFrom(bounds.minDate);
      setLocalTo(bounds.maxDate);
      setDateRange(bounds.minDate, bounds.maxDate);
      setUserModified(false);
    }
  };

  // ── Determine which dropdown option is currently active ───────────────────
  // Compare localFrom/localTo against each preset's computed range.
  // If none matches and we're at All Time bounds → ALL_TIME_VALUE.
  // Otherwise → CUSTOM_VALUE (user typed something arbitrary).
  const activePresetLabel = useMemo(() => {
    if (!localFrom || !localTo) return ALL_TIME_VALUE;
    // Check All Time first
    if (localFrom === bounds.minDate && localTo === bounds.maxDate) return ALL_TIME_VALUE;
    // Check each preset
    for (const p of presets) {
      const { from, to } = p.getRange();
      if (from === localFrom && to === localTo) return p.label;
    }
    return CUSTOM_VALUE;
  }, [localFrom, localTo, bounds.minDate, bounds.maxDate, presets]);

  return (
    <div className={className}>
      {/* Date Inputs Row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* From Date */}
        <div className="w-36 sm:w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            lang="sv"
            value={localFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            min={bounds.minDate || undefined}
            max={localTo || undefined}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* To Date */}
        <div className="w-36 sm:w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            lang="sv"
            value={localTo}
            onChange={(e) => handleToChange(e.target.value)}
            min={localFrom || bounds.minDate || undefined}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* Period Dropdown — replaces the row of preset buttons */}
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select
              value={activePresetLabel}
              onChange={(e) => handlePreset(e.target.value)}
              disabled={loading}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm text-gray-700 cursor-pointer"
            >
              {/* All Time at top as default */}
              <option value={ALL_TIME_VALUE}>All Time</option>
              <option disabled>──────────</option>
              {presets.map(p => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
              {/* Custom only shown when user manually edited dates */}
              {activePresetLabel === CUSTOM_VALUE && (
                <option value={CUSTOM_VALUE} disabled>Custom</option>
              )}
            </select>
          </div>

          {/* Sort order — kept adjacent to period dropdown */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortOrder('desc')}
              title="Newest first"
              className={`px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                filter.sortOrder !== 'asc'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              ↓ Newest
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              title="Oldest first"
              className={`px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                filter.sortOrder === 'asc'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              ↑ Oldest
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Info */}
      {bounds.minDate && bounds.maxDate && (
        <div className="mt-2 text-xs text-gray-500">
          📅 Data range: {formatDateDisplay(bounds.minDate)} — {formatDateDisplay(bounds.maxDate)}
          {loading && (
            <span className="ml-2 inline-flex items-center">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-1" />
              Loading...
            </span>
          )}
        </div>
      )}

      {/* No data message */}
      {!loading && !bounds.minDate && (
        <div className="mt-2 text-xs text-gray-400">
          No activities found for current filter
        </div>
      )}
    </div>
  );
}
