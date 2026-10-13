// ============================================================
// filterOptions.ts — izbornik „Filter by" za atribut s opcijama (S170)
// ============================================================
// Filtar je izbornik nudio SAMO atributu s ravnim popisom (`Tip`). Atribut
// čije opcije ovise o roditelju (`depends_on`: `Podtip` ← `Tip`, `Izvor` ←
// `Racun`, `Status` ← `Izvor`) nema top-level `suggest`, pa je padao na polje
// za tekst s `ilike '%…%'`: `Popravci` je vraćao i `auto C5 / popravci`
// (30 umjesto 18), a tipfeler 0 bez objašnjenja. Saša na `main`-u: „za Izvor
// očekujem izbornik (Racun, Cash…)".
//
// PRAVILO
//   Opcije = ravan popis ∪ svi popisi iz `options_map` (i `*`).
//   Dugi atribut (isto pravilo kao `optionOrder`: najdulji popis ≥ ALPHA_MIN)
//   ⇒ GRUPE po vrijednosti roditelja, abecedno. Kratki ⇒ RAVAN popis bez
//   ponavljanja, redom vlasnika. Inače bi `Status` imao četiri grupe s istim
//   `Planiran, Izvrsen`, a `Izvor` dvaput `Racun`.
//   ⚠ Vrijednost filtra je samo opcija, grupa je PRIKAZ: isti Podtip smije
//     živjeti pod dva Tipa (`gorivo` pod oba auta) i filtar ih hvata oba.
// ============================================================

import type { ParsedAttributeOptions } from '@/hooks/useAttributeDefinitions';
import { isAlphaAttribute, sortOptions } from './optionOrder';

export interface FilterOptionGroup {
  /** Vrijednost roditelja (`Kuća`) ili `null` za opcije bez grupe. */
  label: string | null;
  options: string[];
}

/** Grupe opcija za izbornik filtra; prazan niz ⇒ atribut nema opcija (polje za tekst). */
export function buildFilterOptionGroups(parsed: ParsedAttributeOptions): FilterOptionGroup[] {
  if (parsed.type !== 'suggest' && parsed.type !== 'enum') return [];

  const own = parsed.options.filter(Boolean);
  const mapped = Object.entries(parsed.dependsOn?.optionsMap ?? {})
    .map(([parent, opts]) => [parent, (opts ?? []).filter(Boolean)] as const)
    .filter(([, opts]) => opts.length > 0);

  const lists = [own, ...mapped.map(([, opts]) => opts)];
  if (lists.every(l => l.length === 0)) return [];

  if (mapped.length > 0 && isAlphaAttribute(lists)) {
    const byParent = new Map(mapped);
    const groups: FilterOptionGroup[] = [];
    if (own.length > 0) groups.push({ label: null, options: sortOptions(own) });
    for (const parent of sortOptions([...byParent.keys()])) {
      groups.push({ label: parent, options: sortOptions(byParent.get(parent)!) });
    }
    return groups;
  }

  const seen = new Set<string>();
  const flat: string[] = [];
  for (const l of lists) for (const o of l) if (!seen.has(o)) { seen.add(o); flat.push(o); }
  return [{ label: null, options: isAlphaAttribute(lists) ? sortOptions(flat) : flat }];
}
