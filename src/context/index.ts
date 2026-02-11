// Context Providers - centralized export
export { 
  FilterProvider, 
  useFilter, 
  defaultFilterState 
} from './FilterContext';

// Types are exported directly from FilterContext.tsx via 'export interface'
export type { 
  FilterState, 
  FilterContextType 
} from './FilterContext';
