import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, UUID } from '@/types/database';
import { useFilter } from '@/context/FilterContext';
import { useAreas } from '@/hooks/useAreas';

interface ProgressiveCategorySelectorProps {
  onLeafSelected?: (category: Category, path: Category[]) => void;
  className?: string;
}

type Step = {
  level: number;
  parentId: string | null;
  areaId: string;
  label: string;
};

export function ProgressiveCategorySelector({
  onLeafSelected,
  className = '',
}: ProgressiveCategorySelectorProps) {
  // Use correct FilterContext API
  const { filter, selectArea, selectCategory, reset } = useFilter();
  const { areas, loading: areasLoading } = useAreas();
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<Category[]>([]);

  // Load categories for current step
  const loadCategoriesForStep = async (step: Step) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('categories')
        .select('id, name, level, parent_category_id, area_id, sort_order')
        .eq('area_id', step.areaId)
        .order('sort_order');

      if (step.parentId) {
        query = query.eq('parent_category_id', step.parentId);
      } else {
        // First step - load L1 and L2 categories without parent
        query = query.in('level', [1, 2]).is('parent_category_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if category is a leaf (has no children)
  const isLeafCategory = async (categoryId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_category_id', categoryId);

    if (error) {
      console.error('Error checking leaf status:', error);
      return false;
    }

    return (count ?? 0) === 0;
  };

  // Build full path including L1 for L2 categories
  const buildFullPath = async (category: Category): Promise<Category[]> => {
    const path: Category[] = [];
    let current: Category | null = category;

    // Build path from leaf to root
    while (current) {
      path.unshift(current);

      if (!current.parent_category_id) {
        // We're at L1 or L2 without parent - check if L2
        if (current.level === 2) {
          // Find L1 parent for this L2 category
          const { data: l1Categories, error } = await supabase
            .from('categories')
            .select('id, name, level, parent_category_id, area_id, sort_order')
            .eq('area_id', current.area_id)
            .eq('level', 1)
            .is('parent_category_id', null);

          if (!error && l1Categories && l1Categories.length > 0) {
            // Add L1 to beginning of path
            path.unshift(l1Categories[0] as Category);
          }
        }
        break;
      }

      // Load parent category with explicit type
      const { data: parentData, error: parentError } = await supabase
        .from('categories')
        .select('id, name, level, parent_category_id, area_id, sort_order')
        .eq('id', current.parent_category_id)
        .single();

      if (parentError || !parentData) {
        break;
      }

      current = parentData as Category;
    }

    return path;
  };

  // Handle category selection
  const handleSelectCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    const isLeaf = await isLeafCategory(categoryId);
    const fullPath = await buildFullPath(category);

    setSelectedPath(fullPath);
    
    // Use correct FilterContext API - selectCategory expects UUID[]
    const pathIds: UUID[] = fullPath.map(cat => cat.id);
    selectCategory(categoryId, pathIds);

    if (isLeaf) {
      // This is a leaf category - we're done
      onLeafSelected?.(category, fullPath);
    } else {
      // Load next level
      const nextStep: Step = {
        level: category.level + 1,
        parentId: categoryId,
        areaId: category.area_id!,
        label: `Subcategory (Step ${category.level + 1})`,
      };
      setCurrentStep(nextStep);
      loadCategoriesForStep(nextStep);
    }
  };

  // Handle area selection
  const handleAreaChange = (areaId: string) => {
    if (!areaId) {
      setCurrentStep(null);
      setCategories([]);
      setSelectedPath([]);
      reset(); // Use reset from FilterContext
      return;
    }

    // Use correct FilterContext API
    selectArea(areaId);
    
    const newStep: Step = {
      level: 1,
      parentId: null,
      areaId,
      label: 'Category (Step 1)',
    };

    setCurrentStep(newStep);
    setSelectedPath([]);
    loadCategoriesForStep(newStep);
  };

  // Go back one step
  const handleBack = () => {
    if (selectedPath.length === 0) {
      setCurrentStep(null);
      setCategories([]);
      return;
    }

    const newPath = selectedPath.slice(0, -1);
    setSelectedPath(newPath);

    if (newPath.length === 0) {
      // Back to area selection
      if (!filter.areaId) return;
      
      const newStep: Step = {
        level: 1,
        parentId: null,
        areaId: filter.areaId,
        label: 'Category (Step 1)',
      };
      setCurrentStep(newStep);
      loadCategoriesForStep(newStep);
      
      // Clear category selection but keep area
      selectCategory(null, []);
    } else {
      // Back to previous category level
      const parent = newPath[newPath.length - 1];
      const newStep: Step = {
        level: parent.level + 1,
        parentId: parent.id,
        areaId: parent.area_id!,
        label: `Subcategory (Step ${parent.level + 1})`,
      };
      setCurrentStep(newStep);
      loadCategoriesForStep(newStep);
      
      // Update filter with new path
      const pathIds: UUID[] = newPath.map(cat => cat.id);
      selectCategory(parent.id, pathIds);
    }
  };

  // Reset all selections
  const handleReset = () => {
    setCurrentStep(null);
    setCategories([]);
    setSelectedPath([]);
    reset(); // Use reset from FilterContext
  };

  return (
    <div className={className}>
      {/* Area Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Area
        </label>
        <select
          value={filter.areaId || ''}
          onChange={(e) => handleAreaChange(e.target.value)}
          disabled={areasLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
        >
          <option value="">
            {areasLoading ? 'Loading areas...' : 'Select area...'}
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.icon} {area.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category Selection Steps */}
      {currentStep && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {currentStep.label}
          </label>
          <select
            value={filter.categoryId || ''}
            onChange={(e) => handleSelectCategory(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
          >
            <option value="">
              {isLoading ? 'Loading...' : 'Select category...'}
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.level === 1 ? 'L1: ' : 'L2: '}
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Full Path Display */}
      {selectedPath.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="text-blue-900 font-medium">
              {selectedPath.map((cat) => cat.name).join(' > ')}
              {' > '}
            </span>
          </div>
          {filter.categoryId && (
            <div className="mt-2 text-xs text-blue-700">
              ✓ Leaf category selected - ready to add activity
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {(currentStep || selectedPath.length > 0) && (
        <div className="flex gap-2">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset all
          </button>
        </div>
      )}
    </div>
  );
}
