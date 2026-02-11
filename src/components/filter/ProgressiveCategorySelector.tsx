import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, UUID } from '@/types/database';
import { useFilter } from '@/context/FilterContext';
import { useAreas } from '@/hooks/useAreas';
import { useActivityPresets } from '@/hooks/useActivityPresets';

// --------------------------------------------
// Types
// --------------------------------------------

interface ProgressiveCategorySelectorProps {
  onLeafSelected?: (category: Category, path: Category[]) => void;
  className?: string;
}

// --------------------------------------------
// Component
// --------------------------------------------

export function ProgressiveCategorySelector({
  onLeafSelected,
  className = '',
}: ProgressiveCategorySelectorProps) {
  // Get ALL state from context (Single Source of Truth)
  const { 
    filter, 
    selectArea, 
    selectCategory, 
    reset,
    isLeafCategory,
    setIsLeafCategory,
    setFullPathDisplay,
    // Category selection state
    selectionChain,
    setSelectionChain,
    dropdownOptions,
    setDropdownOptions,
    isRestored,
    isRestoring,
    // Shortcuts
    selectedShortcutId,
    setSelectedShortcutId
  } = useFilter();
  
  const { areas, loading: areasLoading } = useAreas();
  
  // Shortcuts
  const { presets, loading: presetsLoading, createPreset, deletePreset, incrementUsage } = useActivityPresets();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  
  // Local loading state for DB operations
  const [isLoading, setIsLoading] = useState(false);

  // --------------------------------------------
  // Database helpers
  // --------------------------------------------
  
  const loadL1AndL2Categories = useCallback(async (areaId: string): Promise<Category[]> => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, level, parent_category_id, area_id, sort_order')
        .eq('area_id', areaId)
        .in('level', [1, 2])
        .order('level')
        .order('sort_order');

      if (error) throw error;
      return (data || []) as Category[];
    } catch (error) {
      console.error('Error loading L1+L2 categories:', error);
      return [];
    }
  }, []);

  const loadChildCategories = useCallback(async (parentId: string): Promise<Category[]> => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, level, parent_category_id, area_id, sort_order')
        .eq('parent_category_id', parentId)
        .order('sort_order');

      if (error) throw error;
      return (data || []) as Category[];
    } catch (error) {
      console.error('Error loading child categories:', error);
      return [];
    }
  }, []);

  const buildFullPath = useCallback(async (category: Category): Promise<Category[]> => {
    const path: Category[] = [category];
    let currentParentId = category.parent_category_id;
    
    while (currentParentId) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, level, parent_category_id, area_id, sort_order')
          .eq('id', currentParentId)
          .single();
        
        if (error || !data) break;
        path.unshift(data as Category);
        currentParentId = data.parent_category_id;
      } catch {
        break;
      }
    }
    
    return path;
  }, []);

  // --------------------------------------------
  // Update display path
  // --------------------------------------------
  
  const updatePathDisplay = useCallback((areaName: string | null, categoryPath: Category[]) => {
    const parts: string[] = [];
    
    if (areaName) {
      parts.push(areaName);
    } else {
      parts.push('All Areas');
    }
    
    if (categoryPath.length > 0) {
      parts.push(...categoryPath.map(c => c.name));
    } else {
      parts.push('All Categories');
    }
    
    setFullPathDisplay(parts.join(' > '));
  }, [setFullPathDisplay]);

  // --------------------------------------------
  // Shortcut handlers
  // --------------------------------------------
  
  const handleShortcutSelect = useCallback(async (presetId: string) => {
    if (!presetId) {
      setSelectedShortcutId(null);
      return;
    }

    const preset = presets.find(p => p.id === presetId);
    if (!preset || !preset.category_id) return;

    setIsLoading(true);
    setSelectedShortcutId(preset.id);

    try {
      // Fetch the category to build full path
      const { data: category, error } = await supabase
        .from('categories')
        .select('id, name, level, parent_category_id, area_id, sort_order')
        .eq('id', preset.category_id)
        .single();

      if (error || !category) throw error;

      // Build full path
      const fullPath = await buildFullPath(category as Category);
      setSelectionChain(fullPath);

      // Set area
      if (preset.area_id) {
        selectArea(preset.area_id);
      }

      // Check if leaf
      const children = await loadChildCategories(preset.category_id);
      const isLeaf = children.length === 0;

      if (!isLeaf) {
        setDropdownOptions(children);
      } else {
        // Show siblings for leaf
        if (category.parent_category_id) {
          const siblings = await loadChildCategories(category.parent_category_id);
          setDropdownOptions(siblings);
        } else if (preset.area_id) {
          const l1l2 = await loadL1AndL2Categories(preset.area_id);
          setDropdownOptions(l1l2);
        }
      }

      // Update context
      const pathIds: UUID[] = fullPath.map(c => c.id);
      selectCategory(preset.category_id, pathIds);
      setIsLeafCategory(isLeaf);

      // Update display
      const area = areas.find(a => a.id === preset.area_id);
      updatePathDisplay(area?.name || null, fullPath);

      // Increment usage
      incrementUsage(preset.id);

      // Notify if leaf
      if (isLeaf) {
        onLeafSelected?.(category as Category, fullPath);
      }
    } catch (error) {
      console.error('Error selecting shortcut:', error);
    } finally {
      setIsLoading(false);
    }
  }, [presets, buildFullPath, loadChildCategories, loadL1AndL2Categories, selectArea, selectCategory, setIsLeafCategory, setSelectedShortcutId, setSelectionChain, setDropdownOptions, updatePathDisplay, incrementUsage, areas, onLeafSelected]);

  const handleSavePreset = useCallback(async () => {
    if (!newPresetName.trim() || !filter.categoryId) return;

    setSavingPreset(true);
    const result = await createPreset(newPresetName, filter.areaId, filter.categoryId);
    setSavingPreset(false);

    if (result) {
      setShowSaveModal(false);
      setNewPresetName('');
      setSelectedShortcutId(result.id);
    }
  }, [newPresetName, filter.areaId, filter.categoryId, createPreset, setSelectedShortcutId]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedShortcutId) return;

    const preset = presets.find(p => p.id === selectedShortcutId);
    if (!preset) return;

    if (!window.confirm(`Delete shortcut "${preset.name}"?`)) return;

    const success = await deletePreset(selectedShortcutId);
    if (success) {
      setSelectedShortcutId(null);
    }
  }, [selectedShortcutId, presets, deletePreset, setSelectedShortcutId]);

  // Can save: has leaf category selected
  const canSaveShortcut = isLeafCategory && filter.categoryId;

  // --------------------------------------------
  // Load L1+L2 when area changes (ONLY if not restoring)
  // --------------------------------------------
  
  useEffect(() => {
    // Don't run until restore is complete
    if (!isRestored || isRestoring) return;
    
    // If no area selected, clear everything
    if (!filter.areaId) {
      setDropdownOptions([]);
      setSelectionChain([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      return;
    }
    
    // If we already have a selection chain for this area, don't reload
    // This prevents overwriting restored state
    if (selectionChain.length > 0 && selectionChain[0]?.area_id === filter.areaId) {
      return;
    }
    
    // Fresh area selection - load L1+L2
    setIsLoading(true);
    loadL1AndL2Categories(filter.areaId)
      .then(categories => {
        setDropdownOptions(categories);
        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, []);
      })
      .finally(() => setIsLoading(false));
      
  }, [filter.areaId, isRestored, isRestoring, selectionChain, areas, loadL1AndL2Categories, setDropdownOptions, setSelectionChain, setIsLeafCategory, updatePathDisplay]);

  // --------------------------------------------
  // Handlers
  // --------------------------------------------

  const handleAreaChange = async (areaId: string) => {
    if (!areaId) {
      // Clear all
      selectArea(null);
      setDropdownOptions([]);
      setSelectionChain([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      return;
    }
    
    // Set area and clear category selection
    selectArea(areaId);
    setSelectionChain([]);
    
    // Load L1+L2 for this area
    setIsLoading(true);
    const categories = await loadL1AndL2Categories(areaId);
    setDropdownOptions(categories);
    setIsLoading(false);
    
    selectCategory(null, []);
    setIsLeafCategory(false);
    const area = areas.find(a => a.id === areaId);
    updatePathDisplay(area?.name || null, []);
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!categoryId) {
      // "All Categories" or "Select..." selected
      if (selectionChain.length > 0) {
        // Go back to parent level
        const newChain = selectionChain.slice(0, -1);
        setSelectionChain(newChain);
        
        if (newChain.length > 0) {
          const lastSelected = newChain[newChain.length - 1];
          const children = await loadChildCategories(lastSelected.id);
          setDropdownOptions(children);
          
          const fullPath = await buildFullPath(lastSelected);
          const pathIds: UUID[] = fullPath.map(c => c.id);
          selectCategory(lastSelected.id, pathIds);
          
          setIsLeafCategory(children.length === 0);
          
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, fullPath);
        } else {
          // Back to L1/L2
          const categories = await loadL1AndL2Categories(filter.areaId!);
          setDropdownOptions(categories);
          selectCategory(null, []);
          setIsLeafCategory(false);
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, []);
        }
      }
      return;
    }

    setIsLoading(true);

    try {
      const category = dropdownOptions.find(c => c.id === categoryId);
      if (!category) return;

      // Build full path
      const fullPath = await buildFullPath(category);
      setSelectionChain(fullPath);

      // Check if leaf
      const children = await loadChildCategories(categoryId);
      const isLeaf = children.length === 0;

      if (!isLeaf) {
        setDropdownOptions(children);
      }
      // If leaf, keep current dropdown for sibling selection

      // Update filter context
      const pathIds: UUID[] = fullPath.map(c => c.id);
      selectCategory(categoryId, pathIds);
      setIsLeafCategory(isLeaf);

      // Update path display
      const area = areas.find(a => a.id === filter.areaId);
      updatePathDisplay(area?.name || null, fullPath);

      // Notify if leaf
      if (isLeaf) {
        onLeafSelected?.(category, fullPath);
      }

    } catch (error) {
      console.error('Error selecting category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = async () => {
    if (selectionChain.length === 0) {
      // At L1/L2 with no selection - go back to All Areas
      selectArea(null);
      setDropdownOptions([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      return;
    }

    setIsLoading(true);

    try {
      // Remove last category from chain
      const newChain = selectionChain.slice(0, -1);
      setSelectionChain(newChain);

      if (newChain.length > 0) {
        // Show children of the new last item
        const lastSelected = newChain[newChain.length - 1];
        const children = await loadChildCategories(lastSelected.id);
        
        if (children.length > 0) {
          setDropdownOptions(children);
        } else {
          // Last item is a leaf now, show its siblings
          if (lastSelected.parent_category_id) {
            const siblings = await loadChildCategories(lastSelected.parent_category_id);
            setDropdownOptions(siblings);
          } else {
            // It's L1, show L1+L2
            const categories = await loadL1AndL2Categories(filter.areaId!);
            setDropdownOptions(categories);
          }
        }

        // Update context
        const fullPath = await buildFullPath(lastSelected);
        const pathIds: UUID[] = fullPath.map(c => c.id);
        selectCategory(lastSelected.id, pathIds);
        
        // Check if it's a leaf
        const childrenCheck = await loadChildCategories(lastSelected.id);
        setIsLeafCategory(childrenCheck.length === 0);

        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, fullPath);
      } else {
        // Back to L1/L2 level
        const categories = await loadL1AndL2Categories(filter.areaId!);
        setDropdownOptions(categories);
        selectCategory(null, []);
        setIsLeafCategory(false);
        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, []);
      }
    } catch (error) {
      console.error('Error going back:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    reset();
  };

  // --------------------------------------------
  // Computed values
  // --------------------------------------------

  const canReset = filter.areaId !== null;
  const canGoBack = filter.areaId !== null;
  
  const getCategoryLabel = (): string => {
    if (selectionChain.length === 0) {
      return 'Category (L1/L2)';
    }
    return `Subcategory (Step ${selectionChain.length + 1})`;
  };

  const getSelectedValue = (): string => {
    if (selectionChain.length === 0) return '';
    const lastSelected = selectionChain[selectionChain.length - 1];
    const inOptions = dropdownOptions.find(o => o.id === lastSelected.id);
    return inOptions ? lastSelected.id : '';
  };

  const displayPath = selectionChain;

  // --------------------------------------------
  // Render
  // --------------------------------------------

  // Show loading while restoring
  if (isRestoring) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Restoring filter...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Shortcuts Row */}
      <div className="flex items-end gap-2 mb-3">
        {/* Shortcuts Dropdown */}
        <div className="flex-1 min-w-0 max-w-xs">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            ⚡ Shortcuts
          </label>
          <select
            value={selectedShortcutId || ''}
            onChange={(e) => handleShortcutSelect(e.target.value)}
            disabled={presetsLoading || isLoading}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
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
        <button
          type="button"
          onClick={() => {
            const lastCat = selectionChain[selectionChain.length - 1];
            setNewPresetName(lastCat?.name || '');
            setShowSaveModal(true);
          }}
          disabled={!canSaveShortcut || isLoading}
          className="p-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Save current selection as shortcut"
        >
          💾
        </button>

        {/* Delete Button */}
        <button
          type="button"
          onClick={handleDeletePreset}
          disabled={!selectedShortcutId || isLoading}
          className="p-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Delete selected shortcut"
        >
          🗑️
        </button>
      </div>

      {/* Area/Category Dropdowns Row */}
      <div className="flex flex-wrap items-end gap-3">
        
        {/* Area Dropdown */}
        <div className="w-36 sm:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Area
          </label>
          <select
            value={filter.areaId || ''}
            onChange={(e) => handleAreaChange(e.target.value)}
            disabled={areasLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
          >
            <option value="">All Areas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.icon} {area.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Dropdown */}
        <div className="flex-1 min-w-[160px] max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {getCategoryLabel()}
          </label>
          {filter.areaId ? (
            <select
              value={getSelectedValue()}
              onChange={(e) => handleCategorySelect(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            >
              <option value="">
                {selectionChain.length === 0 ? 'All Categories' : 'Select...'}
              </option>
              {dropdownOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  L{cat.level}: {cat.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm"
            >
              <option>All Categories</option>
            </select>
          )}
        </div>

        {/* Back + Reset Buttons */}
        {canReset && (
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              disabled={!canGoBack || isLoading}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go back one level"
            >
              ← Back
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              title="Reset all filters"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      )}

      {/* Full Path Display */}
      {displayPath.length > 0 && (
        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-indigo-900 font-medium truncate">
              {areas.find(a => a.id === filter.areaId)?.name} &gt; {displayPath.map(c => c.name).join(' > ')}
            </span>
          </div>
          {/* Leaf indicator */}
          {isLeafCategory ? (
            <p className="mt-1 text-xs text-green-700">
              ✓ Leaf category selected - ready to add activity
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">
              ⚠ Select a subcategory to reach a leaf
            </p>
          )}
        </div>
      )}

      {/* Save Shortcut Modal */}
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
                disabled={savingPreset || !newPresetName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingPreset ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
