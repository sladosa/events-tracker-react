// ============================================================
// requiredAttributes.ts — jedno pravilo za „polje je obavezno"
// ============================================================
// ZAŠTO POSTOJI KAO ZASEBAN FILE
//   Provjeru trebaju tri mjesta: Add (Finish), Add (`Save +`, jer se događaj
//   ondje sprema u red) i Edit (Save). Isti uvjet prepisan na tri mjesta je
//   tri prilike da se raziđe — isti razred kao `canUpdateExisting()` (S125).
//
// ŠTO JE OBAVEZNO, A ŠTO NIJE
//   `is_required` je pravilo FORME, ne baze i ne uvoza. U bazi nema `NOT NULL`
//   (5.164 postojeća retka), a Excel import ga namjerno ne provjerava —
//   povijesni batchevi i `N/A` moraju i dalje prolaziti.
//
// ⚠ `false` JE ODGOVOR, NE IZOSTANAK
//   Obavezan boolean odgovoren s „ne" je popunjen. Da se `false` broji kao
//   prazno, jedini način da se takva forma spremi bio bi odgovoriti „da".
// ============================================================

import type { AttributeDefinition } from '@/types';

/** Ima li vrijednost. Prazno je samo `null`/`undefined`/prazan string. */
export function hasAttributeValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

/**
 * Imena obaveznih atributa bez vrijednosti, **redoslijedom kojim stoje u
 * formi**. Redoslijed nije kozmetika: `Izvor` ovisi o `Racun`u, pa dok je
 * roditelj prazan ovisno polje nema iz čega ponuditi vrijednost. Popis koji
 * počinje roditeljem vodi korisnika ispravnim redom sam od sebe.
 */
export function missingRequired(
  defs: AttributeDefinition[],
  valueOf: (definitionId: string) => unknown,
): string[] {
  return defs
    .filter(d => d.is_required && !hasAttributeValue(valueOf(d.id)))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(d => d.name);
}

/**
 * Poruka koja **imenuje polje**. Prazna kad nema što nedostaje.
 *
 * ⚠ NE upućuje na „Show all". Obavezno polje je od S131 uvijek na ekranu
 * (`AttributeChainForm.isHiddenExplicitly`), pa bi uputa slala korisnika da
 * traži ondje gdje nema što naći — a uputa koja ne pomaže nauči se preskočiti.
 */
export function requiredMessage(names: string[], where?: string): string {
  if (names.length === 0) return '';
  const list = names.join(', ');
  const scope = where ? ` (${where})` : '';
  return names.length === 1
    ? `Polje "${list}" je obavezno${scope}.`
    : `Obavezna polja${scope}: ${list}.`;
}
