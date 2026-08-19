/**
 * Events Tracker – Datum-atributi u Excelu  (Faza 0.1)
 * =====================================================
 * Jedno mjesto na kojem se `datetime` atribut prevodi između tri oblika:
 *
 *   baza      `2025-01-07T12:00:00+00:00`   (timestamptz, kako ga Postgres vrati)
 *   aplikacija`2025-01-07T12:00`            (`attributeRules.formatForDatetimeInput`)
 *   Excel     prava datumska ćelija         (prikaz `d.m.yyyy`)
 *
 * ⚠ ZAŠTO PODNE: Excel serial ↔ `Date` u exceljs-u ide preko čistog UTC-a
 * (`utils.dateToExcel` = `getTime()/86400000`), a ova aplikacija čita ćelije
 * lokalnim getterima (`normalizeDateCell`). Vrijednost usidrena u **podne UTC**
 * pada na isti kalendarski dan u svakoj zoni od UTC−11 do UTC+11, pa dan ne
 * može skliznuti ni ljeti ni zimi. Ponoć (kako se piše `event_date`) ima tu
 * marginu samo prema istoku.
 *
 * ⚠ ZAŠTO NE `toISOString()`: dosadašnji import je datumsku ćeliju pretvarao u
 * puni ISO s ponoći (`2025-01-07T00:00:00.000Z`), što se kao **string** razlikuje
 * od onoga što baza drži — pa je svaki dodir retka izgledao kao promjena atributa.
 */

/** `YYYY-MM-DD` iz bilo kojeg od tri oblika; `null` ako se ne da pročitati. */
export function datePartOfDatetime(v: unknown): string | null {
  if (v == null || v === '') return null;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }

  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
}

/** `HH:mm` iz stringa; datumska ćelija nema vrijeme pa vraća `null`. */
function timePartOfDatetime(v: unknown): string | null {
  if (v instanceof Date || v == null) return null;
  const m = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/.exec(String(v).trim());
  return m ? m[1] : null;
}

/**
 * Oblik koji ide u bazu i u otisak retka: `YYYY-MM-DDTHH:mm`.
 * Datumska ćelija (bez vremena) dobiva podne — isto što piše `set_attribute`
 * automatika i offline generator, pa se roundtrip ne mijenja pod rukama.
 */
export function canonicalDatetime(v: unknown): string | null {
  const date = datePartOfDatetime(v);
  if (!date) return null;
  return `${date}T${timePartOfDatetime(v) ?? '12:00'}`;
}

/**
 * Vrijednost za Excel ćeliju: prava `Date` (podne UTC) da je Koka vidi kao
 * `7.1.2025.` i da je Data Validation tipa `date` može provjeriti pri upisu.
 * `null` znači „ostavi kako jest" (vrijednost nije datum).
 */
export function datetimeCellValue(v: unknown): Date | null {
  const date = datePartOfDatetime(v);
  if (!date) return null;
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12));
}

/** Format datumskih ćelija u exportu. Hrvatski zapis, bez vremena. */
export const DATE_ATTR_NUMFMT = 'd.m.yyyy';
