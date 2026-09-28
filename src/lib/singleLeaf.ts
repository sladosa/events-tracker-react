// ============================================================
// singleLeaf.ts — `+` smije znati kamo ide i kad filtar nije na leafu (S154)
// ============================================================
// Koka (PROD, mali iPhone) je zatjecala filtar na `Financije_all > All
// Categories` i sivi `+`, bez ideje zašto. Do toga vode dva puta: sama odabere
// Areu, ili obnova filtra prekorači rok od 8 s (S149) i namjerno ostane na Arei.
// A `Financije_all` ima JEDAN leaf — pitanje „u koju kategoriju?" ondje nema
// dva odgovora, pa ga ne treba ni postavljati.
//
// Pravilo je generičko (nula configa): ispod odabrane Aree / kategorije postoji
// TOČNO jedan leaf ⇒ `+` ide na njega. Dva ili više ⇒ i dalje treba birati.
// ============================================================

import type { UUID } from '@/types';
import type { CachedCategory } from '@/lib/categoryCache';

/**
 * Jedini leaf ispod `categoryId` (s njim uključivo) ili, bez kategorije, u Arei.
 * `null` kad ih je nula ili više od jednog.
 */
export function findSingleLeaf(
  cats: Iterable<CachedCategory>,
  areaId: UUID | null,
  categoryId: UUID | null,
): UUID | null {
  if (!areaId && !categoryId) return null;
  const all = [...cats];
  const hasChildren = new Set(all.map(c => c.parent_category_id).filter(Boolean) as string[]);

  let scope: CachedCategory[];
  if (categoryId) {
    const byParent = new Map<string, CachedCategory[]>();
    for (const c of all) {
      if (!c.parent_category_id) continue;
      const list = byParent.get(c.parent_category_id) ?? [];
      list.push(c);
      byParent.set(c.parent_category_id, list);
    }
    const root = all.find(c => c.id === categoryId);
    if (!root) return null;
    scope = [];
    const stack = [root];
    while (stack.length) {
      const c = stack.pop()!;
      scope.push(c);
      stack.push(...(byParent.get(c.id) ?? []));
    }
  } else {
    scope = all.filter(c => c.area_id === areaId);
  }

  const leaves = scope.filter(c => !hasChildren.has(c.id));
  return leaves.length === 1 ? leaves[0].id : null;
}

/** Imena od korijena do kategorije (bez Aree). */
export function categoryNamePath(cats: Map<string, CachedCategory>, id: UUID): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let cur = cats.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.unshift(cur.name);
    cur = cur.parent_category_id ? cats.get(cur.parent_category_id) : undefined;
  }
  return names;
}
