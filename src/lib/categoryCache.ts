/**
 * categoryCache.ts
 * ================
 * Module-level cache cijele `categories` tablice (+ imena area) za read putanje.
 *
 * ZAŠTO: View/Edit/Add flowovi hodaju po parent lancu i grade breadcrumb putanje.
 * Prije je svaka aktivnost (i svaki Prev/Next prefetch) iznova povlačila kategorije
 * upit-po-upit ili cijelu tablicu — deseci upita po jednom otvaranju aktivnosti.
 * Kategorije se rijetko mijenjaju, pa ih držimo u memoriji.
 *
 * INVALIDACIJA:
 *   - CustomEvent 'areas-changed' (Structure add/rename/delete, import, leave area)
 *   - CustomEvent 'structure-deleted' (Structure Delete modal)
 *   - TTL 5 min (sigurnosna mreža za promjene koje ne dispatchaju event,
 *     npr. drugi korisnik u shared arei)
 *
 * RLS: upit vraća samo kategorije koje korisnik smije vidjeti (vlastite + shared),
 * identično kao dosadašnji direktni upiti — keš ne mijenja vidljivost.
 */

import { supabase } from '@/lib/supabaseClient';
import type { UUID } from '@/types';

export interface CachedCategory {
  id: UUID;
  name: string;
  parent_category_id: UUID | null;
  area_id: UUID | null;
}

const TTL_MS = 5 * 60 * 1000;

let _cats: Promise<Map<string, CachedCategory>> | null = null;
let _areas: Promise<Map<string, string>> | null = null;
let _catsFetchedAt = 0;
let _areasFetchedAt = 0;

/** Sve kategorije vidljive korisniku, keširano. Map<categoryId, CachedCategory> */
export function getCategoryMap(): Promise<Map<string, CachedCategory>> {
  if (!_cats || Date.now() - _catsFetchedAt > TTL_MS) {
    _catsFetchedAt = Date.now();
    const p = (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_category_id, area_id');
      if (error) throw error;
      const rows = (data ?? []) as unknown as CachedCategory[];
      return new Map(rows.map(c => [c.id as string, c]));
    })();
    _cats = p;
    p.catch(() => { if (_cats === p) _cats = null; });
  }
  return _cats;
}

/** Imena svih area vidljivih korisniku, keširano. Map<areaId, name> */
export function getAreaNameMap(): Promise<Map<string, string>> {
  if (!_areas || Date.now() - _areasFetchedAt > TTL_MS) {
    _areasFetchedAt = Date.now();
    const p = (async () => {
      const { data, error } = await supabase.from('areas').select('id, name');
      if (error) throw error;
      const rows = (data ?? []) as { id: string; name: string }[];
      return new Map(rows.map(a => [a.id, a.name]));
    })();
    _areas = p;
    p.catch(() => { if (_areas === p) _areas = null; });
  }
  return _areas;
}

export function invalidateCategoryCache(): void {
  _cats = null;
  _areas = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('areas-changed', invalidateCategoryCache);
  window.addEventListener('structure-deleted', invalidateCategoryCache);
}
