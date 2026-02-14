// Data fetching hooks
export { useAreas, useTemplateAreas } from './useAreas';
export { 
  useCategories, 
  useCategoriesFlat, 
  useRootCategories, 
  useChildCategories,
  useTemplateCategories
} from './useCategories';
export { useCategoryPath, useCategoryPathOptimized } from './useCategoryPath';
export { useCategoryTree, useCategoryTreeByArea } from './useCategoryTree';

// Add Activity hooks
export { useCategoryChain, useIsLeafCategory, useLeafCategories } from './useCategoryChain';
export { 
  useAttributeDefinitions, 
  useLookupValues,
  parseValidationRules,
  getOptionsForDependency
} from './useAttributeDefinitions';
export { useSessionTimer } from './useSessionTimer';
export { useActivityPresets } from './useActivityPresets';

// Activity Editor hooks
export { 
  useLocalStorageSync,
  serializeEvent,
  deserializeEvent,
  serializeFormState,
  deserializeFormState,
  calculateAge,
  createEmptyDraft,
  createDraftFromState,
} from './useLocalStorageSync';

// Filter hooks
export { useDateBounds, getDatePresets, formatDateDisplay } from './useDateBounds';

// Activities hooks
export { useActivities, formatTime, formatDate, getActivitiesDebugLog, clearActivitiesDebugLog } from './useActivities';
export type { ActivityEvent, ActivityGroup } from './useActivities';

// Constants - moved to lib/constants.ts, re-export for backwards compatibility
export { TEMPLATE_USER_ID } from '@/lib/constants';
