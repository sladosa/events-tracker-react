import { useState, useCallback } from 'react';
import { useActivityPresets } from '@/hooks/useActivityPresets';
import type { UUID } from '@/types';

interface ShortcutsBarProps {
  currentAreaId: UUID | null;
  currentCategoryId: UUID | null;
  currentCategoryName?: string;
  onSelect: (areaId: UUID | null, categoryId: UUID | null) => void;
  disabled?: boolean;
}

export function ShortcutsBar({
  currentAreaId,
  currentCategoryId,
  currentCategoryName,
  onSelect,
  disabled = false,
}: ShortcutsBarProps) {
  const { presets, loading, createPreset, deletePreset, incrementUsage } = useActivityPresets();
  const [selectedPresetId, setSelectedPresetId] = useState<UUID | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  // Handle preset selection
  const handleSelectPreset = useCallback((presetId: string) => {
    if (presetId === '') {
      setSelectedPresetId(null);
      return;
    }

    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(preset.id);
      onSelect(preset.area_id, preset.category_id);
      incrementUsage(preset.id);
    }
  }, [presets, onSelect, incrementUsage]);

  // Handle save current selection as preset
  const handleSavePreset = useCallback(async () => {
    if (!newPresetName.trim() || !currentCategoryId) return;

    setSaving(true);
    const result = await createPreset(newPresetName, currentAreaId, currentCategoryId);
    setSaving(false);

    if (result) {
      setShowSaveModal(false);
      setNewPresetName('');
      setSelectedPresetId(result.id);
    }
  }, [newPresetName, currentAreaId, currentCategoryId, createPreset]);

  // Handle delete selected preset
  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetId) return;

    const preset = presets.find(p => p.id === selectedPresetId);
    if (!preset) return;

    if (!window.confirm(`Delete shortcut "${preset.name}"?`)) return;

    const success = await deletePreset(selectedPresetId);
    if (success) {
      setSelectedPresetId(null);
    }
  }, [selectedPresetId, presets, deletePreset]);

  // Can save: has category selected and it's different from selected preset
  const canSave = currentCategoryId && (
    !selectedPresetId || 
    presets.find(p => p.id === selectedPresetId)?.category_id !== currentCategoryId
  );

  return (
    <div className="flex items-center gap-2">
      {/* Shortcuts Dropdown */}
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          ⚡ Shortcuts
        </label>
        <select
          value={selectedPresetId || ''}
          onChange={(e) => handleSelectPreset(e.target.value)}
          disabled={disabled || loading}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select shortcut...</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} {preset.usage_count > 0 && `(${preset.usage_count}×)`}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <div className="flex-shrink-0 pt-5">
        <button
          type="button"
          onClick={() => {
            setNewPresetName(currentCategoryName || '');
            setShowSaveModal(true);
          }}
          disabled={disabled || !canSave}
          className="p-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Save current as shortcut"
        >
          💾
        </button>
      </div>

      {/* Delete Button */}
      <div className="flex-shrink-0 pt-5">
        <button
          type="button"
          onClick={handleDeletePreset}
          disabled={disabled || !selectedPresetId}
          className="p-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Delete selected shortcut"
        >
          🗑️
        </button>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Save Shortcut
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shortcut Name
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g., Gym - Strength"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPresetName.trim()) {
                    handleSavePreset();
                  }
                  if (e.key === 'Escape') {
                    setShowSaveModal(false);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={saving || !newPresetName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
