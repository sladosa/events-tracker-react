/**
 * catalogPicker.ts — čisti model izbornika iz kataloga (S190; I/O je `catalogOptions.ts`).
 *
 * ODLUKE (Saša, 31.10., `TRENING_MIGRACIJA.md` „Korak 5 — odluke S190"):
 *   - bez tražilice; skupine, otvorena jedna;
 *   - u skupini prvo ono što TAJ korisnik najčešće radi u ZADNJIH 12 MJESECI, najviše 6 + „Sve";
 *   - uz skupinu „zadnje prije N d" — odmor se mjeri po SKUPINI (i sporednoj), ne po vježbi.
 */

export interface CatalogPhoto { id: string; url: string; filename: string | null }

export interface CatalogItem {
  eventId: string;
  ownerId: string;
  /** Vrijednost koju polje sprema (slug). */
  value: string;
  /** Ono što čovjek čita (ime); bez `label` atributa = vrijednost. */
  label: string;
  group: string | null;
  group2: string | null;
  /** slug atributa ⇒ vrijednost (svi atributi zapisa kataloga). */
  values: Record<string, string | number | boolean | null>;
  /** slug atributa ⇒ id retka `event_attributes` (za uređivanje). */
  rowIds: Record<string, string>;
  photos: CatalogPhoto[];
}

/** Korištenje JEDNE vrijednosti kod jednog korisnika. */
export interface Usage {
  /** Broj RAZLIČITIH dana (treninga) u zadnjih 12 mjeseci. */
  days12: number;
  /** Zadnji dan (YYYY-MM-DD) u zadnjih 12 mjeseci, ili null. */
  last: string | null;
}

export const TOP_N = 6;
export const NO_GROUP = '';

/** Iz sirovih redaka (vrijednost + dan) ⇒ korištenje po vrijednosti. */
export function usageFrom(rows: { value: string | null; day: string }[]): Map<string, Usage> {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.value) continue;
    const set = days.get(r.value) ?? new Set<string>();
    set.add(r.day);
    days.set(r.value, set);
  }
  const out = new Map<string, Usage>();
  for (const [v, set] of days) {
    out.set(v, { days12: set.size, last: [...set].sort().at(-1) ?? null });
  }
  return out;
}

export interface PickerGroup {
  key: string;            // NO_GROUP za zapise bez skupine
  items: CatalogItem[];   // već složeno: učestalost pa ime
  /** Dana od zadnjeg opterećenja skupine (glavne ILI sporedne), null = nije u 12 mj. */
  daysSince: number | null;
}

const daysBetween = (fromYmd: string, toYmd: string) =>
  Math.round((Date.parse(toYmd + 'T00:00:00Z') - Date.parse(fromYmd + 'T00:00:00Z')) / 864e5);

/**
 * Skupine izbornika. Redoslijed skupina: `groupOrder` (popis opcija atributa skupine u
 * katalogu), pa skupine kojih u popisu nema abecedno, pa „bez skupine" na kraju.
 */
export function pickerGroups(
  items: CatalogItem[],
  usage: Map<string, Usage>,
  groupOrder: string[],
  todayYmd: string,
): PickerGroup[] {
  const byGroup = new Map<string, CatalogItem[]>();
  for (const it of items) {
    const g = it.group ?? NO_GROUP;
    byGroup.set(g, [...(byGroup.get(g) ?? []), it]);
  }
  const extra = [...byGroup.keys()].filter(g => g !== NO_GROUP && !groupOrder.includes(g)).sort((a, b) => a.localeCompare(b, 'hr'));
  const keys = [...groupOrder.filter(g => byGroup.has(g)), ...extra, ...(byGroup.has(NO_GROUP) ? [NO_GROUP] : [])];

  return keys.map(key => {
    const its = (byGroup.get(key) ?? []).slice().sort((a, b) =>
      (usage.get(b.value)?.days12 ?? 0) - (usage.get(a.value)?.days12 ?? 0) || a.label.localeCompare(b.label, 'hr'));
    // Odmor po skupini: i vježbe kojima je ova skupina SPOREDNA (erg ⇒ Upper-pull).
    const lasts = items
      .filter(it => key === NO_GROUP ? !it.group : (it.group === key || it.group2 === key))
      .map(it => usage.get(it.value)?.last)
      .filter((d): d is string => !!d)
      .sort();
    const last = lasts.at(-1);
    return { key, items: its, daysSince: last ? daysBetween(last, todayYmd) : null };
  });
}

/** Skupina koja se otvara: skupina trenutne vrijednosti, inače nijedna. */
export function initialGroup(items: CatalogItem[], currentValue: string | null): string | null {
  if (!currentValue) return null;
  const it = items.find(i => i.value === currentValue);
  return it ? (it.group ?? NO_GROUP) : null;
}

export function itemByValue(items: CatalogItem[], value: string | null | undefined): CatalogItem | null {
  if (!value) return null;
  return items.find(i => i.value === value) ?? null;
}
