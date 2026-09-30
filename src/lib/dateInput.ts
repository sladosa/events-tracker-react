// ============================================================
// dateInput.ts — <input type="date"> / <input type="time"> ↔ Date (S155)
// ============================================================
// JEDNA kopija za Add i Edit zaglavlje. Do S155 ih je bilo dvije, i razišle su
// se dvaput u istom testu (BUG-S155-EDITNAN):
//   1. Add je ignorirao prazno polje, Edit nije ⇒ brisanje dana dalo je
//      `Number('')` = NaN, neispravan datum, a inkrementalni pomak u Editu je
//      nakon toga svaki sljedeći pomak pretvarao u NaN.
//   2. Godina se u vrijednost polja pisala BEZ dopune na 4 znamenke. Dok se
//      tipka godina, Chrome javlja međustanja (2026 → 0002 → 0020 → …), a
//      `2-08-07` polje ne prihvaća — prikaže prazno `dd/mm/yyyy`, i čovjek
//      više ne vidi što ispravlja.
// ⚠ Međustanja godine se NAMJERNO propuštaju (inkrementalni pomak se sam
//   ispravi kad godina bude gotova, v. `EditActivityPage.handleDateTimeChange`);
//   odbiti ih bi značilo da React vrati staru vrijednost usred tipkanja.
//   Neispravnu godinu pri spremanju hvata provjera u Saveu.
// ============================================================

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * Granice polja datuma. Bez `max` Chrome u godinu pušta do 6 znamenki
 * (do 275760) — izmjereno S155, `252026`. Četveroznamenkast `max` ograniči
 * unos na 4. Raspon je isti koji Edit Save ionako traži (1900–2200).
 */
export const DATE_INPUT_MIN = '1900-01-01';
export const DATE_INPUT_MAX = '2200-12-31';

/**
 * Je li vrijednost polja datuma GOTOV datum koji smije dalje (u filtar, u
 * bazu). Dok se tipka godina, polje javlja i `0002-…`; filtar koji to primi
 * pošalje upit i ZAPAMTI ga u pregledniku (S155, `202566` u polju `To`).
 * Usporedba stringova je ispravna jer je oblik fiksan `YYYY-MM-DD`.
 */
export function isCompleteDateValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= DATE_INPUT_MIN && value <= DATE_INPUT_MAX;
}

/** `YYYY-MM-DD` za `<input type="date">`, LOKALNO, godina uvijek 4 znamenke. */
export function toDateInputValue(d: Date): string {
  if (!Number.isFinite(d.getTime())) return '';
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `HH:MM` za `<input type="time">`, lokalno. */
export function toTimeInputValue(d: Date): string {
  if (!Number.isFinite(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Novi datum iz polja, uz ZADRŽANO vrijeme iz `base`.
 * `null` = polje je prazno ili nečitljivo (npr. dok se briše dan) — pozivatelj
 * tada NE javlja promjenu.
 */
export function applyDateInput(base: Date, value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m || !Number.isFinite(base.getTime())) return null;
  const next = new Date(base);
  next.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(next.getTime()) ? next : null;
}

/**
 * Novo vrijeme iz polja, uz zadržan datum. Sekunde i ms na nulu — detekcija
 * kolizije radi na razini minute (CLAUDE.md, `session_start`).
 */
export function applyTimeInput(base: Date, value: string): Date | null {
  const m = /^(\d{2}):(\d{2})/.exec(value);
  if (!m || !Number.isFinite(base.getTime())) return null;
  const next = new Date(base);
  next.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return Number.isFinite(next.getTime()) ? next : null;
}
