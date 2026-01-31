import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, CategoryWithArea, UUID } from '@/types';

// Template user ID - koristi se za "starter" podatke za nove korisnike
const TEMPLATE_USER_ID = '00000000-0000-0000-0000-000000000000';

interface UseCategoriesOptions {
  areaId?: UUID | null;
  parentId?: UUID | null; // null = root categories, undefined = all
  includeArea?: boolean;
  includeTemplates?: boolean; // Default: false - prikaži samo svoje
}

interface UseCategoriesReturn {
  categories: CategoryWithArea[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesReturn {
  const { areaId, parentId, includeArea = true, includeTemplates = false } = options;
  
  const [categories, setCategories] = useState<CategoryWithArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build select query - single line for nested relations (Supabase gotcha!)
      const selectQuery = includeArea 
        ? 'id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, created_at, updated_at, area:areas(id, name, icon, color, slug)'
        : '*';

      let query = supabase
        .from('categories')
        .select(selectQuery)
        .order('level', { ascending: true })
        .order('sort_order', { ascending: true });

      // Filter out template user unless explicitly requested
      if (!includeTemplates) {
        query = query.neq('user_id', TEMPLATE_USER_ID);
      }

      // Filter by area if provided
      if (areaId) {
        query = query.eq('area_id', areaId);
      }

      // Filter by parent - null means root categories only
      if (parentId === null) {
        query = query.is('parent_category_id', null);
      } else if (parentId !== undefined) {
        query = query.eq('parent_category_id', parentId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch categories'));
    } finally {
      setLoading(false);
    }
  }, [areaId, parentId, includeArea, includeTemplates]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetch: fetchCategories };
}

// --------------------------------------------
// Helper: Get all categories as a flat list
// --------------------------------------------

export function useCategoriesFlat(): UseCategoriesReturn {
  return useCategories({ includeArea: true });
}

// --------------------------------------------
// Helper: Get root categories for an area
// --------------------------------------------

export function useRootCategories(areaId?: UUID | null): UseCategoriesReturn {
  return useCategories({ areaId, parentId: null });
}

// --------------------------------------------
// Helper: Get children of a category
// --------------------------------------------

export function useChildCategories(parentId: UUID): UseCategoriesReturn {
  return useCategories({ parentId });
}

// --------------------------------------------
// Helper: Get template categories (for suggestions)
// --------------------------------------------

export function useTemplateCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<CategoryWithArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, created_at, updated_at, area:areas(id, name, icon, color, slug)')
        .eq('user_id', TEMPLATE_USER_ID)
        .order('level', { ascending: true })
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch template categories'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetch: fetchCategories };
}
