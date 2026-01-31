import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, UUID } from '@/types';

interface UseCategoryChainReturn {
  chain: Category[];      // Od leaf (index 0) do root (zadnji)
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Dohvaća lanac kategorija od leaf do root.
 * Vraća array gdje je prvi element leaf kategorija, a zadnji root.
 */
export function useCategoryChain(leafCategoryId: UUID | null): UseCategoryChainReturn {
  const [chain, setChain] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChain = useCallback(async () => {
    if (!leafCategoryId) {
      setChain([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Dohvati sve kategorije - RLS će filtrirati
      // Ne filtriramo po user_id jer kategorija može biti shared ili importana
      const { data: allCategories, error: fetchError } = await supabase
        .from('categories')
        .select('id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, created_at, updated_at')
        .order('level', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Fetched categories for chain:', allCategories?.length);

      // Build chain od leaf do root
      const categoryMap = new Map<string, Category>();
      allCategories?.forEach(cat => categoryMap.set(cat.id, cat));

      const result: Category[] = [];
      let currentId: string | null = leafCategoryId;

      // Traverse up the tree
      let iterations = 0;
      const maxIterations = 20; // Prevent infinite loop
      
      while (currentId && iterations < maxIterations) {
        const category = categoryMap.get(currentId);
        if (!category) {
          console.warn('Category not found in chain:', currentId);
          break;
        }
        
        result.push(category);
        currentId = category.parent_category_id;
        iterations++;
      }

      console.log('Category chain loaded:', result.map(c => c.name));
      setChain(result);
    } catch (err) {
      console.error('Error fetching category chain:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch category chain'));
    } finally {
      setLoading(false);
    }
  }, [leafCategoryId]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  return { chain, loading, error, refetch: fetchChain };
}

/**
 * Helper: Provjeri je li kategorija leaf (nema djece)
 */
export function useIsLeafCategory(categoryId: UUID | null): { isLeaf: boolean; loading: boolean } {
  const [isLeaf, setIsLeaf] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setIsLeaf(true);
      return;
    }

    const checkLeaf = async () => {
      setLoading(true);
      try {
        const { count, error } = await supabase
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('parent_category_id', categoryId);

        if (error) throw error;
        setIsLeaf(count === 0);
      } catch (err) {
        console.error('Error checking if leaf:', err);
        setIsLeaf(true); // Assume leaf on error
      } finally {
        setLoading(false);
      }
    };

    checkLeaf();
  }, [categoryId]);

  return { isLeaf, loading };
}

/**
 * Helper: Dohvati sve leaf kategorije ispod određene kategorije
 */
export function useLeafCategories(parentCategoryId: UUID | null, areaId: UUID | null): {
  leafCategories: Category[];
  loading: boolean;
  error: Error | null;
} {
  const [leafCategories, setLeafCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLeaves = async () => {
      if (!areaId) {
        setLeafCategories([]);
        return;
      }

      setLoading(true);
      try {
        // Dohvati sve kategorije za area
        const { data: allCategories, error: fetchError } = await supabase
          .from('categories')
          .select('id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, created_at, updated_at')
          .eq('area_id', areaId)
          .order('level', { ascending: true })
          .order('sort_order', { ascending: true });

        if (fetchError) throw fetchError;

        // Nađi sve kategorije koje imaju djecu
        const parentIds = new Set(
          allCategories?.filter(c => c.parent_category_id).map(c => c.parent_category_id) || []
        );

        // Leaf = nema nikoga tko ima ovu kategoriju kao parenta
        let leaves = allCategories?.filter(c => !parentIds.has(c.id)) || [];

        // Ako je specificiran parent, filtriraj samo njegove descendante
        if (parentCategoryId) {
          const descendants = new Set<string>();
          const findDescendants = (parentId: string) => {
            descendants.add(parentId);
            allCategories?.filter(c => c.parent_category_id === parentId)
              .forEach(child => findDescendants(child.id));
          };
          findDescendants(parentCategoryId);
          
          leaves = leaves.filter(l => descendants.has(l.id));
        }

        setLeafCategories(leaves);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch leaf categories'));
      } finally {
        setLoading(false);
      }
    };

    fetchLeaves();
  }, [parentCategoryId, areaId]);

  return { leafCategories, loading, error };
}
