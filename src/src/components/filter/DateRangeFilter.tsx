import { useEffect, useState } from 'react';
import { useFilter } from '@/context/FilterContext';
import { useDateBounds, getDatePresets, formatDateDisplay } from '@/hooks/useDateBounds';

interface DateRangeFilterProps {
  className?: string;
}

export function DateRangeFilter({ className = '' }: DateRangeFilterProps) {
  const { filter, setDateRange } = useFilter();
  const { bounds, loading } = useDateBounds(filter.areaId, filter.categoryId);
  
  // Local state for inputs (to allow editing before applying)
  const [localFrom, setLocalFrom] = useState<string>('');
  const [localTo, setLocalTo] = useState<string>('');
  
  // Track if user has manually set dates
  const [userModified, setUserModified] = useState(false);

  // Initialize/reset dates when bounds change (and user hasn't modified)
  useEffect(() => {
    if (!loading && bounds.minDate && bounds.maxDate && !userModified) {
      setLocalFrom(bounds.minDate);
      setLocalTo(bounds.maxDate);
      setDateRange(bounds.minDate, bounds.maxDate);
    }
  }, [bounds.minDate, bounds.maxDate, loading, userModified, setDateRange]);

  // Sync from filter state when it changes externally
  useEffect(() => {
    if (filter.dateFrom && filter.dateTo) {
      setLocalFrom(filter.dateFrom);
      setLocalTo(filter.dateTo);
    }
  }, [filter.dateFrom, filter.dateTo]);

  // Handle date input changes
  const handleFromChange = (value: string) => {
    setLocalFrom(value);
    setUserModified(true);
    if (value && localTo) {
      setDateRange(value, localTo);
    }
  };

  const handleToChange = (value: string) => {
    setLocalTo(value);
    setUserModified(true);
    if (localFrom && value) {
      setDateRange(localFrom, value);
    }
  };

  // Apply preset
  const handlePreset = (preset: ReturnType<typeof getDatePresets>[0]) => {
    const { from, to } = preset.getRange();
    setLocalFrom(from);
    setLocalTo(to);
    setDateRange(from, to);
    setUserModified(true);
  };

  // Reset to full range
  const handleAllTime = () => {
    if (bounds.minDate && bounds.maxDate) {
      setLocalFrom(bounds.minDate);
      setLocalTo(bounds.maxDate);
      setDateRange(bounds.minDate, bounds.maxDate);
      setUserModified(false);
    }
  };

  const presets = getDatePresets();

  // Check if current range matches "All Time"
  const isAllTime = localFrom === bounds.minDate && localTo === bounds.maxDate;

  return (
    <div className={className}>
      {/* Date Inputs Row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* From Date */}
        <div className="w-36 sm:w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From
          </label>
          <input
            type="date"
            value={localFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            min={bounds.minDate || undefined}
            max={localTo || bounds.maxDate || undefined}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* To Date */}
        <div className="w-36 sm:w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To
          </label>
          <input
            type="date"
            value={localTo}
            onChange={(e) => handleToChange(e.target.value)}
            min={localFrom || bounds.minDate || undefined}
            max={bounds.maxDate || undefined}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
          />
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
          
          {/* All Time Button */}
          <button
            onClick={handleAllTime}
            disabled={loading || isAllTime}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
              isAllTime
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Date Range Info */}
      {bounds.minDate && bounds.maxDate && (
        <div className="mt-2 text-xs text-gray-500">
          📅 Data range: {formatDateDisplay(bounds.minDate)} — {formatDateDisplay(bounds.maxDate)}
          {loading && (
            <span className="ml-2 inline-flex items-center">
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-1"></span>
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
