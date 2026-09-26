/**
 * localDate.ts — `YYYY-MM-DD` dana koji covjek VIDI (lokalno), ne UTC dana (S152).
 *
 * ⚠ `d.toISOString().split('T')[0]` daje UTC dan. U Zagrebu (UTC+1/+2) je to
 *   za lokalnu ponoc DAN PRIJE — izmjereno: „This Month" je 26.09.2026. davao
 *   `2026-08-31 → 2026-09-29` (ukljucen zadnji dan proslog mjeseca, IZOSTAVLJEN
 *   zadnji dan ovoga), „This Year" `2025-12-31 → 2026-12-30`. Za „danas" je
 *   greska ista, samo vidljiva jedino izmedju 00:00 i 02:00.
 *   Isti razred je S117 zatvorio za `event_date` u Addu (`toLocalDateStr`);
 *   Edit, zaglavlje s datumom i predlosci filtra ostali su na UTC-u.
 *
 * Ne vrijedi za put `YYYY-MM-DD` → `Date.UTC`/`T12:00Z` → `toISOString()`:
 *   ondje je UTC namjeran i dosljedan (`deltaWindow`, `prevDayIso`).
 */
export function localYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Danasnji lokalni dan. */
export function todayLocalYmd(): string {
  return localYmd(new Date());
}
