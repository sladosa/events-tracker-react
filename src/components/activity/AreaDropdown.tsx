import { useAreas } from '@/hooks/useAreas';
import type { UUID } from '@/types';

interface AreaDropdownProps {
  value: UUID | null;
  onChange: (areaId: UUID | null) => void;
  disabled?: boolean;
  className?: string;
}

export function AreaDropdown({ value, onChange, disabled, className = '' }: AreaDropdownProps) {
  const { areas, loading, error } = useAreas();

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Error loading areas: {error.message}
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Area
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">
          {loading ? 'Loading...' : 'Select Area'}
        </option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.icon && `${area.icon} `}{area.name}
          </option>
        ))}
      </select>
    </div>
  );
}
