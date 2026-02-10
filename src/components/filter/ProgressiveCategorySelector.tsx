import { useState, useEffect, useCallback } from 'react';
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

interface StepState {
  categories: Category[];      // Categories available at this step
  selectedId: string | null;   // Selected category ID
  selectedCategory: Category | null;
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
  
  // Navigation history - each entry is a step
  const [stepHistory, setStepHistory] = useState<StepState[]>([]);
  const [currentStep, setCurrentStep] = useState<StepState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Full path from root to current selection
  const [fullPath, setFullPath] = useState<Category[]>([]);

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
  // Initialize when area changes
  // --------------------------------------------
  
  useEffect(() => {
    if (filter.areaId) {
      setIsLoading(true);
      loadL1AndL2Categories(filter.areaId)
        .then(categories => {
          const initialStep: StepState = {
            categories,
            selectedId: null,
            selectedCategory: null
          };
          setCurrentStep(initialStep);
          setStepHistory([]);
          setFullPath([]);
          setIsLeafCategory(false);
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, []);
        })
        .finally(() => setIsLoading(false));
    } else {
      setCurrentStep(null);
      setStepHistory([]);
      setFullPath([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
    }
  }, [filter.areaId, areas, loadL1AndL2Categories, setIsLeafCategory, updatePathDisplay]);

  // --------------------------------------------
  // Handlers
  // --------------------------------------------

  const handleAreaChange = (areaId: string) => {
    if (!areaId) {
      selectArea(null);
      setCurrentStep(null);
      setStepHistory([]);
      setFullPath([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
      return;
    }
    selectArea(areaId);
    // Will trigger useEffect to load L1+L2
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!currentStep) return;

    // "All Categories" selected
    if (!categoryId) {
      // If we have history, this shouldn't happen (dropdown should show "Select...")
      // But if at first step, clear selection
      setCurrentStep({
        ...currentStep,
        selectedId: null,
        selectedCategory: null
      });
      selectCategory(null, []);
      setIsLeafCategory(false);
      setFullPath([]);
      const area = areas.find(a => a.id === filter.areaId);
      updatePathDisplay(area?.name || null, []);
      return;
    }

    setIsLoading(true);

    try {
      const category = currentStep.categories.find(c => c.id === categoryId);
      if (!category) return;

      // Build full path from root to this category
      const newFullPath = await buildFullPath(category);
      setFullPath(newFullPath);

      // Check if this category has children
      const children = await loadChildCategories(categoryId);
      const isLeaf = children.length === 0;

      // Update current step with selection
      const updatedCurrentStep: StepState = {
        ...currentStep,
        selectedId: categoryId,
        selectedCategory: category
      };

      if (!isLeaf) {
        // Save current step to history and create new step with children
        setStepHistory([...stepHistory, updatedCurrentStep]);
        setCurrentStep({
          categories: children,
          selectedId: null,
          selectedCategory: null
        });
      } else {
        // It's a leaf - keep current step updated
        setCurrentStep(updatedCurrentStep);
      }

      // Update filter context
      const pathIds: UUID[] = newFullPath.map(c => c.id);
      selectCategory(categoryId, pathIds);
      setIsLeafCategory(isLeaf);

      // Update path display
      const area = areas.find(a => a.id === filter.areaId);
      updatePathDisplay(area?.name || null, newFullPath);

      // Notify if leaf
      if (isLeaf) {
        onLeafSelected?.(category, newFullPath);
      }

    } catch (error) {
      console.error('Error selecting category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (stepHistory.length > 0) {
      // Go back to previous step
      const newHistory = [...stepHistory];
      const previousStep = newHistory.pop()!;
      
      setStepHistory(newHistory);
      setCurrentStep(previousStep);
      
      // Update path and context
      if (previousStep.selectedCategory) {
        buildFullPath(previousStep.selectedCategory).then(path => {
          setFullPath(path);
          const pathIds: UUID[] = path.map(c => c.id);
          selectCategory(previousStep.selectedId, pathIds);
          
          // Check if the previous selection is a leaf
          loadChildCategories(previousStep.selectedId!).then(children => {
            setIsLeafCategory(children.length === 0);
          });
          
          const area = areas.find(a => a.id === filter.areaId);
          updatePathDisplay(area?.name || null, path);
        });
      } else {
        // Previous step had no selection
        setFullPath([]);
        selectCategory(null, []);
        setIsLeafCategory(false);
        const area = areas.find(a => a.id === filter.areaId);
        updatePathDisplay(area?.name || null, []);
      }
    } else if (currentStep?.selectedId) {
      // At first step with selection - clear the selection
      setCurrentStep({
        ...currentStep,
        selectedId: null,
        selectedCategory: null
      });
      setFullPath([]);
      selectCategory(null, []);
      setIsLeafCategory(false);
      const area = areas.find(a => a.id === filter.areaId);
      updatePathDisplay(area?.name || null, []);
    } else {
      // At first step with no selection - go back to All Areas
      selectArea(null);
      setCurrentStep(null);
      setStepHistory([]);
      setFullPath([]);
      setIsLeafCategory(false);
      updatePathDisplay(null, []);
    }
  };

  const handleReset = () => {
    reset();
    setCurrentStep(null);
    setStepHistory([]);
    setFullPath([]);
  };

  // --------------------------------------------
  // Computed values
  // --------------------------------------------

  const canReset = filter.areaId !== null;
  const canGoBack = filter.areaId !== null;
  
  // Determine dropdown label based on current state
  const getCategoryLabel = (): string => {
    if (stepHistory.length === 0) {
      return 'Category (L1/L2)';
    }
    return `Subcategory (Step ${stepHistory.length + 1})`;
  };

  // Get the display value for category dropdown
  const getCategoryValue = (): string => {
    if (currentStep?.selectedId) {
      return currentStep.selectedId;
    }
    return '';
  };

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

        {/* Category Dropdown - Dynamic based on step */}
        <div className="flex-1 min-w-[160px] max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {getCategoryLabel()}
          </label>
          {filter.areaId && currentStep ? (
            <select
              value={getCategoryValue()}
              onChange={(e) => handleCategorySelect(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 text-sm"
            >
              <option value="">
                {stepHistory.length === 0 ? 'All Categories' : 'Select...'}
              </option>
              {currentStep.categories.map((cat) => (
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
              disabled={!canGoBack}
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
      {fullPath.length > 0 && (
        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-indigo-900 font-medium truncate">
              {areas.find(a => a.id === filter.areaId)?.name} &gt; {fullPath.map(c => c.name).join(' > ')}
            </span>
          </div>
          {/* Leaf indicator - use isLeafCategory from context */}
          {isLeafCategory ? (
            <p className="mt-1 text-xs text-green-700">
              ✓ Leaf category selected - ready to add activity
            </p>
          ) : currentStep?.selectedId ? (
            <p className="mt-1 text-xs text-amber-700">
              ⚠ Select a subcategory to reach a leaf
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
