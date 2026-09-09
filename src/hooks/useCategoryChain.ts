import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Category, UUID } from '@/types';

interface UseCategoryChainReturn {
  chain: Category[];      // Od leaf (index 0) do root (zadnji)
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const CHAIN_CACHE_PREFIX = 'chain_v1_';

function readChainCache(categoryId: string): Category[] | null {
  try {
    const raw = sessionStorage.getItem(CHAIN_CACHE_PREFIX + categoryId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Category[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeChainCache(categoryId: string, chain: Category[]) {
  try {
    sessionStorage.setItem(CHAIN_CACHE_PREFIX + categoryId, JSON.stringify(chain));
  } catch {
    // Storage full or disabled — ignore
  }
}

/**
 * Dohvaća lanac kategorija od leaf do root.
 * Vraća array gdje je prvi element leaf kategorija, a zadnji root.
 * Rezultat se cachira u sessionStorage — sljedeći Add Activity iste kategorije je trenutan.
 */
export function useCategoryChain(leafCategoryId: UUID | null): UseCategoryChainReturn {
  const [chain, setChain] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChain = useCallback(async (skipCache = false) => {
    if (!leafCategoryId) {
      setChain([]);
      return;
    }

    // Cache hit — skip DB round trip
    if (!skipCache) {
      const cached = readChainCache(leafCategoryId);
      if (cached) {
        setChain(cached);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const { data: allCategories, error: fetchError } = await supabase
        .from('categories')
        .select('id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, settings, created_at, updated_at')
        .order('level', { ascending: false });

      if (fetchError) throw fetchError;

      const categoryMap = new Map<string, Category>();
      allCategories?.forEach(cat => categoryMap.set(cat.id, cat));

      const result: Category[] = [];
      let currentId: string | null = leafCategoryId;
      let iterations = 0;

      while (currentId && iterations < 20) {
        const category = categoryMap.get(currentId);
        if (!category) break;
        result.push(category);
        currentId = category.parent_category_id;
        iterations++;
      }

      writeChainCache(leafCategoryId, result);
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

  // Explicit refetch bypasses cache (called after Structure edits)
  const refetch = useCallback(async () => {
    if (leafCategoryId) {
      try { sessionStorage.removeItem(CHAIN_CACHE_PREFIX + leafCategoryId); } catch {}
    }
    await fetchChain(true);
  }, [fetchChain, leafCategoryId]);

  /**
   * ⚠ KEŠ MORA SLUŠATI ONOGA TKO GA ČINI ZASTARJELIM — inače je invalidacija
   *   samo komentar (S132).
   *
   *   `refetch` gore postoji od početka i nosi napomenu „called after Structure
   *   edits". Nitko ga nikad nije zvao: oba pozivatelja (`AddActivityPage:616`,
   *   `EditActivityPage:558`) destrukturiraju samo `chain`/`loading`/`error`.
   *   Dakle snimka lanca — a s njom i `settings.comment_template` leafa, koji
   *   `resolveEventNote` čita na Finishu — živjela je do zatvaranja kartice.
   *
   * ⚠ `sessionStorage` PREŽIVI F5. Gasi se tek zatvaranjem taba, pa je kvar
   *   izgledao neuklonjiv: izmjereno na PROD-u 09.09.2026. — auto-comment
   *   template obrisan i u `areas.settings` i u `categories.settings`
   *   (potvrđeno Structure exportom I s oba Edit panela), a Finish ga je i
   *   dalje upisivao u `comment`. Osvježavanje stranice nije pomagalo, pa je
   *   izgledalo kao da baza laže.
   *
   * ⚠ Listener stoji U HOOKU, ne u pozivateljima: tako vrijedi za oba
   *   postojeća i za svakog budućeg — invarijanta, ne disciplina (isti razlog
   *   zbog kojeg `clearDraft()` sam gasi auto-save, S121). `areas-changed`
   *   dispatchaju i Structure panel (`StructureNodeEditPanel:1323`) i Structure
   *   import (`AppHome.onImported`), dakle oba puta kojima se `settings` mijenja.
   *
   * ⚠ `refetch` mora ostati stabilan (`useCallback` nad `leafCategoryId`) —
   *   nov identitet na svakom renderu ponovno bi vezao listener pri svakom
   *   renderu, razred BUG-S121-AUTOSAVE.
   */
  useEffect(() => {
    const onAreasChanged = () => { void refetch(); };
    window.addEventListener('areas-changed', onAreasChanged);
    return () => window.removeEventListener('areas-changed', onAreasChanged);
  }, [refetch]);

  return { chain, loading, error, refetch };
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
          .select('id, user_id, area_id, parent_category_id, name, description, slug, level, sort_order, path, settings, created_at, updated_at')
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
