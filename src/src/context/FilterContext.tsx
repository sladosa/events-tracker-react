import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { UUID, BreadcrumbItem, Category } from '@/types';

// --------------------------------------------
// Constants
// --------------------------------------------

const FILTER_STORAGE_KEY = 'events-tracker-filter-state';

// --------------------------------------------
// Filter State Type
// --------------------------------------------

export interface FilterState {
  areaId: UUID | null;
  categoryId: UUID | null;
  categoryPath: UUID[];
  dateFrom: string | null;
  dateTo: string | null;
  searchQuery: string;
}

// --------------------------------------------
// Stored State (sessionStorage format)
// --------------------------------------------

interface StoredState {
  areaId: string | null;
  selectionChain: Category[];
  selectedShortcutId: string | null;
}

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
// Context Type - ALL properties defined here
// --------------------------------------------

export interface FilterContextType {
  // Current state
  filter: FilterState;
  
  // Leaf category tracking
  isLeafCategory: boolean;
  setIsLeafCategory: (isLeaf: boolean) => void;
  
  // Full path display (for header)
  fullPathDisplay: string;
  setFullPathDisplay: (path: string) => void;
  
  // === NEW: Category selection state (Single Source of Truth) ===
  selectionChain: Category[];
  setSelectionChain: (chain: Category[]) => void;
  dropdownOptions: Category[];
  setDropdownOptions: (options: Category[]) => void;
  isRestored: boolean;
  isRestoring: boolean;
  
  // === Shortcuts ===
  selectedShortcutId: UUID | null;
  setSelectedShortcutId: (id: UUID | null) => void;
  
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
  
  // Storage operations
  saveToStorage: () => void;
  clearStorage: () => void;
  
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
  // === Core filter state ===
  const [filter, setFilter] = useState<FilterState>({
    ...defaultFilterState,
    ...initialState
  });
  
  // === Leaf tracking ===
  const [isLeafCategory, setIsLeafCategory] = useState(false);
  
  // === Full path display ===
  const [fullPathDisplay, setFullPathDisplay] = useState('');

  // === NEW: Category selection state (lifted from component) ===
  const [selectionChain, setSelectionChain] = useState<Category[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<Category[]>([]);
  
  // === Shortcuts ===
  const [selectedShortcutId, setSelectedShortcutId] = useState<UUID | null>(null);
  
  // === Restore tracking ===
  const [isRestored, setIsRestored] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreAttempted = useRef(false);

  // --------------------------------------------
  // Restore from sessionStorage on mount
  // --------------------------------------------
  
  useEffect(() => {
    // Only attempt restore once
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    
    const doRestore = async () => {
      const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!stored) {
        setIsRestored(true);
        return;
      }
      
      setIsRestoring(true);
      
      try {
        const state: StoredState = JSON.parse(stored);
        
        if (state.areaId && state.selectionChain && state.selectionChain.length > 0) {
          // Restore selection chain
          setSelectionChain(state.selectionChain);
          
          // Restore filter state
          const lastSelected = state.selectionChain[state.selectionChain.length - 1];
          const pathIds = state.selectionChain.map(c => c.id);
          
          setFilter(prev => ({
            ...prev,
            areaId: state.areaId,
            categoryId: lastSelected.id,
            categoryPath: pathIds
          }));
          
          // Load appropriate dropdown options
          const children = await loadChildCategories(lastSelected.id);
          
          if (children.length > 0) {
            // Not a leaf - show children
            setDropdownOptions(children);
            setIsLeafCategory(false);
          } else {
            // It's a leaf - show siblings
            setIsLeafCategory(true);
            if (lastSelected.parent_category_id) {
              const siblings = await loadChildCategories(lastSelected.parent_category_id);
              setDropdownOptions(siblings);
            } else {
              // L1 leaf (rare) - show L1+L2
              const l1l2 = await loadL1AndL2Categories(state.areaId);
              setDropdownOptions(l1l2);
            }
          }
          
          // Build path display
          // We need to fetch area name
          const { data: areaData } = await supabase
            .from('areas')
            .select('name')
            .eq('id', state.areaId)
            .single();
          
          const areaName = areaData?.name || 'Unknown';
          const pathNames = [areaName, ...state.selectionChain.map(c => c.name)];
          setFullPathDisplay(pathNames.join(' > '));
          
        } else if (state.areaId) {
          // Only area selected
          setFilter(prev => ({
            ...prev,
            areaId: state.areaId
          }));
          
          // Load L1+L2 for this area
          const categories = await loadL1AndL2Categories(state.areaId);
          setDropdownOptions(categories);
          
          // Get area name for display
          const { data: areaData } = await supabase
            .from('areas')
            .select('name')
            .eq('id', state.areaId)
            .single();
          
          setFullPathDisplay(`${areaData?.name || 'Unknown'} > All Categories`);
        }
        
        // Restore selected shortcut (if any)
        if (state.selectedShortcutId) {
          setSelectedShortcutId(state.selectedShortcutId);
        }
      } catch (e) {
        console.error('Error restoring filter state:', e);
      } finally {
        setIsRestoring(false);
        setIsRestored(true);
      }
    };
    
    doRestore();
  }, []);

  // --------------------------------------------
  // Database helpers (moved from component)
  // --------------------------------------------
  
  const loadL1AndL2Categories = async (areaId: string): Promise<Category[]> => {
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
  };

  const loadChildCategories = async (parentId: string): Promise<Category[]> => {
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
  };

  // --------------------------------------------
  // Storage operations
  // --------------------------------------------
  
  const saveToStorage = useCallback(() => {
    const state: StoredState = {
      areaId: filter.areaId,
      selectionChain: selectionChain,
      selectedShortcutId: selectedShortcutId
    };
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  }, [filter.areaId, selectionChain, selectedShortcutId]);
  
  const clearStorage = useCallback(() => {
    sessionStorage.removeItem(FILTER_STORAGE_KEY);
  }, []);

  // --------------------------------------------
  // Auto-save when filter changes (after restore)
  // --------------------------------------------
  
  useEffect(() => {
    if (!isRestored) return;
    saveToStorage();
  }, [filter.areaId, selectionChain, selectedShortcutId, isRestored, saveToStorage]);

  // --------------------------------------------
  // Navigation actions
  // --------------------------------------------

  const selectArea = useCallback((areaId: UUID | null) => {
    setFilter(prev => ({
      ...prev,
      areaId,
      categoryId: null,
      categoryPath: []
    }));
    setIsLeafCategory(false);
    // Note: selectionChain and dropdownOptions should be updated by the component
  }, []);

  const selectCategory = useCallback((categoryId: UUID | null, path: UUID[] = []) => {
    setFilter(prev => ({
      ...prev,
      categoryId,
      categoryPath: path
    }));
  }, []);

  const navigateToPath = useCallback((path: BreadcrumbItem[]) => {
    if (path.length === 0) {
      setFilter(prev => ({
        ...prev,
        areaId: null,
        categoryId: null,
        categoryPath: []
      }));
      setIsLeafCategory(false);
      setFullPathDisplay('');
      setSelectionChain([]);
      setDropdownOptions([]);
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
      setFullPathDisplay('');
      setSelectionChain([]);
      setDropdownOptions([]);
    } else if (lastItem.type === 'area') {
      setFilter(prev => ({
        ...prev,
        areaId: lastItem.id,
        categoryId: null,
        categoryPath: []
      }));
      setIsLeafCategory(false);
      setSelectionChain([]);
    } else {
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

  const navigateUp = useCallback(() => {
    setFilter(prev => {
      if (prev.categoryPath.length > 1) {
        const newPath = prev.categoryPath.slice(0, -1);
        return {
          ...prev,
          categoryId: newPath[newPath.length - 1],
          categoryPath: newPath
        };
      } else if (prev.categoryId) {
        return {
          ...prev,
          categoryId: null,
          categoryPath: []
        };
      } else if (prev.areaId) {
        return {
          ...prev,
          areaId: null
        };
      }
      return prev;
    });
    setIsLeafCategory(false);
  }, []);

  const reset = useCallback(() => {
    setFilter(defaultFilterState);
    setIsLeafCategory(false);
    setFullPathDisplay('');
    setSelectionChain([]);
    setDropdownOptions([]);
    setSelectedShortcutId(null);
    clearStorage();
  }, [clearStorage]);

  // --------------------------------------------
  // Date & Search
  // --------------------------------------------

  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setFilter(prev => ({
      ...prev,
      dateFrom: from,
      dateTo: to
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilter(prev => ({
      ...prev,
      searchQuery: query
    }));
  }, []);

  // --------------------------------------------
  // Computed values
  // --------------------------------------------

  const hasActiveFilter = Boolean(
    filter.areaId || 
    filter.categoryId || 
    filter.dateFrom || 
    filter.dateTo || 
    filter.searchQuery
  );

  const isFiltered = Boolean(filter.areaId || filter.categoryId);

  // --------------------------------------------
  // Context value
  // --------------------------------------------

  const value: FilterContextType = {
    filter,
    isLeafCategory,
    setIsLeafCategory,
    fullPathDisplay,
    setFullPathDisplay,
    // NEW
    selectionChain,
    setSelectionChain,
    dropdownOptions,
    setDropdownOptions,
    isRestored,
    isRestoring,
    // Shortcuts
    selectedShortcutId,
    setSelectedShortcutId,
    // Actions
    selectArea,
    selectCategory,
    navigateToPath,
    navigateUp,
    reset,
    setDateRange,
    setSearchQuery,
    saveToStorage,
    clearStorage,
    // Computed
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
// Export default state and types
// --------------------------------------------

export { defaultFilterState };
