/**
 * categoryTree.ts — pitanja o stablu kategorija nad `categoryCache` mapom.
 *
 * ZAŠTO (S162, Backlog P4 „promjena Aree čita `categories` 7×"): lista je prije
 * dohvata evenata radila TRI SERIJSKA kruga do baze (id-jevi Aree → koji su
 * leaf → eventi), a isti id-jevi su se tražili s četiri mjesta (lista, Prev/Next,
 * raspon datuma, popis atributa za filtar). Odabir kategorije još gore: potomci
 * i preci su se tražili upit-po-razini. Cijela tablica kategorija je već u
 * memoriji (`getCategoryMap`), pa su ovo čiste funkcije nad njom.
 *
 * Čiste ⇒ testirane bez baze (`categoryTree.test.mjs`).
 */
import type { UUID } from '@/types';
import type { CachedCategory } from '@/lib/categoryCache';

type CatMap = Map<string, CachedCategory>;

function childrenIndex(map: CatMap): Map<string, UUID[]> {
  const idx = new Map<string, UUID[]>();
  for (const c of map.values()) {
    if (!c.parent_category_id) continue;
    const arr = idx.get(c.parent_category_id);
    if (arr) arr.push(c.id); else idx.set(c.parent_category_id, [c.id]);
  }
  return idx;
}

/** Sve kategorije Aree (svih razina). */
export function areaCategoryIds(map: CatMap, areaId: UUID): UUID[] {
  const out: UUID[] = [];
  for (const c of map.values()) if (c.area_id === areaId) out.push(c.id);
  return out;
}

/** Kategorija i svi njeni potomci (sama prva). */
export function descendantIds(map: CatMap, catId: UUID): UUID[] {
  const idx = childrenIndex(map);
  const out: UUID[] = [];
  const seen = new Set<string>();
  const stack: UUID[] = [catId];
  while (stack.length) {
    const id = stack.shift()!;
    if (seen.has(id)) continue;   // ciklus u podacima ne smije zavrtjeti petlju
    seen.add(id);
    out.push(id);
    stack.push(...(idx.get(id) ?? []));
  }
  return out;
}

/** Kategorija i svi njeni preci do korijena (sama prva). */
export function ancestorIds(map: CatMap, catId: UUID): UUID[] {
  const out: UUID[] = [];
  const seen = new Set<string>();
  let cur: string | null = catId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur as UUID);
    cur = map.get(cur)?.parent_category_id ?? null;
  }
  return out;
}

/** Samo oni id-jevi koji nemaju nijedno dijete. */
export function leafOnly(map: CatMap, ids: UUID[]): UUID[] {
  const parents = new Set<string>();
  for (const c of map.values()) if (c.parent_category_id) parents.add(c.parent_category_id);
  return ids.filter(id => !parents.has(id));
}
