import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { FilterState, UUID, BreadcrumbItem } from '@/types';

// --------------------------------------------
// Default State
// --------------------------------------------

const defaultFilterState: FilterState = {
  areaId: null,
  categoryId: null,
  categoryPath: [],
  dateFrom: null,
  dateTo: null,
  searchQuery: ''
};

// --------------------------------------------
// Context Type
// --------------------------------------------

interface FilterContextType {
  // Current state
  filter: FilterState;
  
  // Leaf category tracking
  isLeafCategory: boolean;
  setIsLeafCategory: (isLeaf: boolean) => void;
  
  // Full path display (for header)
  fullPathDisplay: string;
  setFullPathDisplay: (path: string) => void;
  
  // Navigation actions
  selectArea: (areaId: UUID | null) => void;
  selectCategory: (categoryId: UUID | null, path?: UUID[]) => void;
  navigateToPath: (path: BreadcrumbItem[]) => void;
  navigateUp: () => void;
  reset: () => void;
  
  // Date filter actions
  setDateRange: (from: string | null, to: string | null) => void;
  
  // Search
  setSearchQuery: (query: string) => void;
  
  // Computed
  hasActiveFilter: boolean;
  isFiltered: boolean;
}

// --------------------------------------------
// Context Creation
// --------------------------------------------

const FilterContext = createContext<FilterContextType | undefined>(undefined);

// --------------------------------------------
// Provider Component
// --------------------------------------------

interface FilterProviderProps {
  children: ReactNode;
  initialState?: Partial<FilterState>;
}

export function FilterProvider({ children, initialState }: FilterProviderProps) {
  const [filter, setFilter] = useState<FilterState>({
    ...defaultFilterState,
    ...initialState
  });
  
  // Track if currently selected category is a leaf
  const [isLeafCategory, setIsLeafCategory] = useState(false);
  
  // Track full path display string (e.g., "Fitness > Gym > Strength")
  const [fullPathDisplay, setFullPathDisplay] = useState('All Areas > All Categories');

  // Select an area (resets category selection)
  const selectArea = useCallback((areaId: UUID | null) => {
    setFilter(prev => ({
      ...prev,
      areaId,
      categoryId: null,
      categoryPath: []
    }));
    setIsLeafCategory(false);
  }, []);

  // Select a category (with optional path)
  const selectCategory = useCallback((categoryId: UUID | null, path: UUID[] = []) => {
    setFilter(prev => ({
      ...prev,
      categoryId,
      categoryPath: path
    }));
  }, []);

  // Navigate using breadcrumb path
  const navigateToPath = useCallback((path: BreadcrumbItem[]) => {
    if (path.length === 0) {
      // Navigate to root
      setFilter(prev => ({
        ...prev,
        areaId: null,
        categoryId: null,
        categoryPath: []
      }));
      setIsLeafCategory(false);
      setFullPathDisplay('All Areas > All Categories');
      return;
    }

    const lastItem = path[path.length - 1];
    
    if (lastItem.type === 'root') {
      setFilter(prev => ({
        ...prev,
        areaId: null,
        categoryId: null,
        categoryPath: []
      }));
      setIsLeafCategory(false);
      setFullPathDisplay('All Areas > All Categories');
    } else if (lastItem.type === 'area') {
      setFilter(prev => ({
        ...prev,
        areaId: lastItem.id,
        categoryId: null,
        categoryPath: []
      }));
      setIsLeafCategory(false);
    } else {
      // Category - extract area from path
      const areaItem = path.find(p => p.type === 'area');
      const categoryItems = path.filter(p => p.type === 'category');
      
      setFilter(prev => ({
        ...prev,
        areaId: areaItem?.id || null,
        categoryId: lastItem.id,
        categoryPath: categoryItems.map(c => c.id!).filter(Boolean)
      }));
    }
  }, []);

  // Navigate one level up
  const navigateUp = useCallback(() => {
    setFilter(prev => {
      if (prev.categoryPath.length > 1) {
        // Go to parent category
        const newPath = prev.categoryPath.slice(0, -1);
        return {
          ...prev,
          categoryId: newPath[newPath.length - 1],
          categoryPath: newPath
        };
      } else if (prev.categoryId) {
        // Go back to area level
        return {
          ...prev,
          categoryId: null,
          categoryPath: []
        };
      } else if (prev.areaId) {
        // Go back to root
        return {
          ...prev,
          areaId: null
        };
      }
      return prev;
    });
    setIsLeafCategory(false);
  }, []);

  // Reset all filters
  const reset = useCallback(() => {
    setFilter(defaultFilterState);
    setIsLeafCategory(false);
    setFullPathDisplay('All Areas > All Categories');
  }, []);

  // Set date range
  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setFilter(prev => ({
      ...prev,
      dateFrom: from,
      dateTo: to
    }));
  }, []);

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setFilter(prev => ({
      ...prev,
      searchQuery: query
    }));
  }, []);

  // Computed: has any active filter
  const hasActiveFilter = Boolean(
    filter.areaId || 
    filter.categoryId || 
    filter.dateFrom || 
    filter.dateTo || 
    filter.searchQuery
  );

  // Computed: is hierarchy filtered (area or category selected)
  const isFiltered = Boolean(filter.areaId || filter.categoryId);

  const value: FilterContextType = {
    filter,
    isLeafCategory,
    setIsLeafCategory,
    fullPathDisplay,
    setFullPathDisplay,
    selectArea,
    selectCategory,
    navigateToPath,
    navigateUp,
    reset,
    setDateRange,
    setSearchQuery,
    hasActiveFilter,
    isFiltered
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

// --------------------------------------------
// Hook for using the context
// --------------------------------------------

export function useFilter(): FilterContextType {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}

// --------------------------------------------
// Export default state for testing
// --------------------------------------------

export { defaultFilterState };
