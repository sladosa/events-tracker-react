import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, UUID } from '@/types/database';
import { useFilter } from '@/context/FilterContext';
import { useAreas } from '@/hooks/useAreas';

// --------------------------------------------
// Types
// --------------------------------------------

interface ProgressiveCategorySelectorProps {
  onLeafSelected?: (category: Category, path: Category[]) => void;
  className?: string;
}

// Storage key for filter persistence
const FILTER_STORAGE_KEY = 'events-tracker-filter-state';

interface StoredState {
  areaId: string | null;
  selectionChain: Category[];
}

// --------------------------------------------
// Component
// --------------------------------------------

export function ProgressiveCategorySelector({
  onLeafSelected,
  className = '',
}: ProgressiveCategorySelectorProps) {
  const { 
    filter, 
    selectArea, 
    selectCategory, 
    reset,
    isLeafCategory,
    setIsLeafCategory,
    setFullPathDisplay 
  } = useFilter();
  
  const { areas, loading: areasLoading } = useAreas();
  
  // Selection chain - the complete path of selected categories
  const [selectionChain, setSelectionChain] = useState<Category[]>([]);
  
  // Current dropdown options
  const [dropdownOptions, setDropdownOptions] = useState<Category[]>([]);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Track if we've restored from storage
  const restoredFromStorage = useRef(false);
  
  // Skip next area load (after restore)
  const skipNextAreaLoad = useRef(false);

  // --------------------------------------------
  // Load L1 + L2 categories (first step)
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

  // --------------------------------------------
  // Load children of a specific category
  // --------------------------------------------
  
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

  // --------------------------------------------
  // Build full path from root to a category
  // --------------------------------------------
  
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
  // Save state to sessionStorage
  // --------------------------------------------
  
  const saveToStorage = useCallback((areaId: string | null, chain: Category[]) => {
    const state: StoredState = {
      areaId,
      selectionChain: chain
    };
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  }, []);

  // --------------------------------------------
  // Restore from storage on mount (when areas are available)
  // --------------------------------------------
  
  useEffect(() => {
    const doRestore = async () => {
      if (areas.length === 0) return;
      if (restoredFromStorage.current) return;
      restoredFromStorage.current = true;
      
      const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!stored) return;
      
      try {
        const state: StoredState = JSON.parse(stored);
        
        if (state.areaId && state.selectionChain.length > 0) {
          // Set flag to skip next area load
          skipNextAreaLoad.current = true;
          
          // Restore selection chain first (before triggering area change)
          setSelectionChain(state.selectionChain);
          
          // Load appropriate dropdown options
          const lastSelected = state.selectionChain[state.selectionChain.length - 1];
          const children = await loadChildCategories(lastSelected.id);
          
          if (children.length > 0) {
            setDropdownOptions(children);
          } else {
            // It's a leaf - show parent's siblings
            if (lastSelected.parent_category_id) {
              const siblings = await loadChildCategories(lastSelected.parent_category_id);
              setDropdownOptions(siblings);
            } else {
              const l1l2 = await loadL1AndL2Categories(state.areaId);
              setDropdownOptions(l1l2);
            }
          }
          
          // Restore area (this will trigger useEffect but skipNextAreaLoad will prevent reload)
          selectArea(state.areaId);
          
          // Build full path
          const fullPath = await buildFullPath(lastSelected);
          
          // Update context
          const pathIds: UUID[] = fullPath.map(c => c.id);
          selectCategory(lastSelected.id, pathIds);
          setIsLeafCategory(children.length === 0);
          
          const area = areas.find(a => a.id === state.areaId);
          updatePathDisplay(area?.name || null, fullPath);
        } else if (state.areaId) {
          selectArea(state.areaId);
        }
      } catch (e) {
        console.error('Error restoring filter state:', e);
      }
    };
    
    doRestore();
  }, [areas, selectArea, selectCategory, setIsLeafCategory, loadChildCategories, loadL1AndL2Categories, buildFullPath, updatePathDisplay]);

  // --------------------------------------------
  // Load L1+L2 when area changes (and not restoring)
  // --------------------------------------------
  
  useEffect(() => {
    if (!filter.areaId) {
      setDropdownOptions([]);
      setSelectionChain([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      return;
    }
    
    // Check if we should restore from storage instead of loading fresh
    const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (stored && !restoredFromStorage.current) {
      try {
        const state: StoredState = JSON.parse(stored);
        if (state.areaId === filter.areaId && state.selectionChain.length > 0) {
          // Will be handled by restoreFromStorage
          return;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Skip if we just restored
    if (skipNextAreaLoad.current) {
      skipNextAreaLoad.current = false;
      return;
    }
    
    // Don't reload if we already have selection chain
    if (selectionChain.length > 0) return;
    
    setIsLoading(true);
    loadL1AndL2Categories(filter.areaId)
      .then(categories => {
        setDropdownOptions(categories);
        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, []);
      })
      .finally(() => setIsLoading(false));
  }, [filter.areaId, areas, selectionChain.length, loadL1AndL2Categories, setIsLeafCategory, updatePathDisplay]);

  // --------------------------------------------
  // Handlers
  // --------------------------------------------

  const handleAreaChange = async (areaId: string) => {
    if (!areaId) {
      selectArea(null);
      setDropdownOptions([]);
      setSelectionChain([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      saveToStorage(null, []);
      return;
    }
    
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
    saveToStorage(areaId, []);
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!categoryId) {
      // "All Categories" selected - clear selection but stay at current level
      if (selectionChain.length > 0) {
        // Go back to showing children of parent
        const newChain = selectionChain.slice(0, -1);
        setSelectionChain(newChain);
        
        if (newChain.length > 0) {
          const lastSelected = newChain[newChain.length - 1];
          const children = await loadChildCategories(lastSelected.id);
          setDropdownOptions(children);
          
          const fullPath = await buildFullPath(lastSelected);
          const pathIds: UUID[] = fullPath.map(c => c.id);
          selectCategory(lastSelected.id, pathIds);
          
          // Check if parent is leaf
          setIsLeafCategory(children.length === 0);
          
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, fullPath);
          saveToStorage(filter.areaId, newChain);
        } else {
          // Back to L1/L2
          const categories = await loadL1AndL2Categories(filter.areaId!);
          setDropdownOptions(categories);
          selectCategory(null, []);
          setIsLeafCategory(false);
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, []);
          saveToStorage(filter.areaId, []);
        }
      }
      return;
    }

    setIsLoading(true);

    try {
      const category = dropdownOptions.find(c => c.id === categoryId);
      if (!category) return;

      // Build full path from root to this category
      const fullPath = await buildFullPath(category);
      
      // Add to selection chain (use full path as chain)
      setSelectionChain(fullPath);

      // Check if this category has children
      const children = await loadChildCategories(categoryId);
      const isLeaf = children.length === 0;

      if (!isLeaf) {
        // Show children in dropdown
        setDropdownOptions(children);
      }
      // If leaf, keep current dropdown (user might want to select sibling)

      // Update filter context
      const pathIds: UUID[] = fullPath.map(c => c.id);
      selectCategory(categoryId, pathIds);
      setIsLeafCategory(isLeaf);

      // Update path display
      const area = areas.find(a => a.id === filter.areaId);
      updatePathDisplay(area?.name || null, fullPath);

      // Save to storage
      saveToStorage(filter.areaId, fullPath);

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
      saveToStorage(null, []);
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
        saveToStorage(filter.areaId, newChain);
      } else {
        // Back to L1/L2 level
        const categories = await loadL1AndL2Categories(filter.areaId!);
        setDropdownOptions(categories);
        selectCategory(null, []);
        setIsLeafCategory(false);
        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, []);
        saveToStorage(filter.areaId, []);
      }
    } catch (error) {
      console.error('Error going back:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    reset();
    setDropdownOptions([]);
    setSelectionChain([]);
    sessionStorage.removeItem(FILTER_STORAGE_KEY);
  };

  // --------------------------------------------
  // Computed values
  // --------------------------------------------

  const canReset = filter.areaId !== null;
  const canGoBack = filter.areaId !== null;
  
  // Determine dropdown label based on selection
  const getCategoryLabel = (): string => {
    if (selectionChain.length === 0) {
      return 'Category (L1/L2)';
    }
    return `Subcategory (Step ${selectionChain.length + 1})`;
  };

  // Get currently selected value for dropdown
  const getSelectedValue = (): string => {
    if (selectionChain.length === 0) return '';
    const lastSelected = selectionChain[selectionChain.length - 1];
    // Check if last selected is in current dropdown options
    const inOptions = dropdownOptions.find(o => o.id === lastSelected.id);
    return inOptions ? lastSelected.id : '';
  };

  // Full path for display
  const displayPath = selectionChain;

  // --------------------------------------------
  // Render
  // --------------------------------------------

  return (
    <div className={className}>
      {/* Dropdowns Row - ONLY 2 dropdowns + buttons */}
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

        {/* Category Dropdown - Dynamic based on selection */}
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
    </div>
  );
}
