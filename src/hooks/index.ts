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

// Constants
export const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';
