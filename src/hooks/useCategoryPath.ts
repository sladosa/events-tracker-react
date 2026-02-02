import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { BreadcrumbItem, UUID } from '@/types';

interface UseCategoryPathReturn {
  path: BreadcrumbItem[];
  loading: boolean;
  error: Error | null;
}

/**
 * Dohvaća breadcrumb path od root-a do dane kategorije
 * Vraća: [Root] -> [Area] -> [Category Level 1] -> ... -> [Current Category]
 */
export function useCategoryPath(categoryId: UUID | null): UseCategoryPathReturn {
  const [path, setPath] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buildPath = useCallback(async () => {
    // Always start with root
    const breadcrumb: BreadcrumbItem[] = [
      { id: null, name: 'All', type: 'root' }
    ];

    if (!categoryId) {
      setPath(breadcrumb);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch the category with its area
      const { data: category, error: catError } = await supabase
        .from('categories')
        .select('id, name, level, area_id, parent_category_id, area:areas(id, name, icon, color)')
        .eq('id', categoryId)
        .single();

      if (catError) throw catError;
      if (!category) throw new Error('Category not found');

      // Supabase join returns area as array or object depending on relation
      const areaData = Array.isArray(category.area) ? category.area[0] : category.area;

      // Add area to breadcrumb
      if (areaData) {
        breadcrumb.push({
          id: areaData.id,
          name: areaData.name,
          type: 'area'
        });
      }

      // Build parent chain by traversing up
      const categoryChain: Array<{ id: string; name: string; level: number; parent_category_id: string | null }> = [];
      let currentCat: { id: string; name: string; level: number; parent_category_id: string | null } | null = {
        id: category.id,
        name: category.name,
        level: category.level,
        parent_category_id: category.parent_category_id,
      };

      // Collect all ancestors
      while (currentCat) {
        categoryChain.unshift(currentCat); // Add to beginning

        if (currentCat.parent_category_id) {
          const { data: parent, error: parentError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', currentCat.parent_category_id)
            .single();

          if (parentError) {
            console.warn('Error fetching parent:', parentError);
            break;
          }
          currentCat = parent as typeof currentCat;
        } else {
          currentCat = null;
        }
      }

      // Add categories to breadcrumb
      for (const cat of categoryChain) {
        breadcrumb.push({
          id: cat.id,
          name: cat.name,
          type: 'category',
          level: cat.level
        });
      }

      setPath(breadcrumb);
    } catch (err) {
      console.error('Error building category path:', err);
      setError(err instanceof Error ? err : new Error('Failed to build path'));
      setPath(breadcrumb); // Return at least root
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    buildPath();
  }, [buildPath]);

  return { path, loading, error };
}

/**
 * Verzija koja koristi ltree path ako je dostupan (brže - jedan query)
 * Za sada fallback na gornju implementaciju
 */
export function useCategoryPathOptimized(categoryId: UUID | null): UseCategoryPathReturn {
  // TODO: Implementirati korištenje ltree path kolone za brži lookup
  // Za sada koristi standardnu implementaciju
  return useCategoryPath(categoryId);
}
