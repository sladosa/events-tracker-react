// ============================================================
// confirmedPeriod.ts — je li ovaj redak već unutar potvrđenog stanja?
// ============================================================
// Spec: `docs/DELTA_WINDOW_SPEC.md` §5, sloj 3 (faza 4).
//
// ⚠ ZAŠTO POSTOJI KAO ZASEBAN MODUL
//   Isto pitanje postavljaju DVA mjesta: delta sheet (kolona `Potvrda`, koja
//   ga rješava Excel formulom) i uvoz (ovaj guard). Dvije kopije pravila su
//   prilika da se raziđu — a raziđu li se, sheet bi jedan redak označio kao
//   potvrđen, a uvoz ga pustio bez pitanja. Čista funkcija se da testirati i
//   protuprovjeriti bez baze i bez Excela.
//
// ⚠ PRAVILO JE ISTO KAO U KOLONI `Potvrda`: redak pripada PRVOJ potvrdi koja
//   ga obuhvaća (najranijoj čiji je `confirmed_on >= event_date`), ne
//   posljednjoj. Sidro pokriva sve `<=` svog dana, pa je najranija potvrda
//   najuža istinita tvrdnja — i ona je ono što korisnik vidi u sheetu.
//
// ⚠ GRANICA JE `>=`, NE `>`. Sidro potvrđuje stanje NA KRAJU svog dana
//   (§2.17 „promjene strogo NAKON"), pa je redak datiran točno na dan sidra
//   već uračunat u potvrđeni iznos.
//
// ⚠ POTVRDE SU PO RAČUNU (`group_value`), ne po Arei. Redak čiji se račun ne
//   da utvrditi NE označava se — lažna oznaka na tuđem računu bila bi gora od
//   izostanka, jer bi korisnika naučila da guard preskače.

export interface AnchorLike {
  group_value:  string;
  confirmed_on: string;   // YYYY-MM-DD
  amount:       number;
  note?:        string | null;
}

export interface ConfirmedMark {
  /** Dan potvrde koja ovaj redak već obuhvaća. */
  confirmedOn: string;
  /** Iznos te potvrde — poruka mora IMENOVATI sidro koje se dovodi u pitanje. */
  amount:      number;
  /** Račun na koji se potvrda odnosi. */
  groupValue:  string;
}

/**
 * Prva potvrda koja obuhvaća `eventDate` za dani račun, ili `null`.
 *
 * @param anchors    sidra Aree (bilo kojim redoslijedom; ne mijenjaju se)
 * @param groupValue račun retka; `null`/prazno ⇒ nema odgovora, vraća `null`
 * @param eventDate  `YYYY-MM-DD`
 */
export function findCoveringAnchor(
  anchors:    readonly AnchorLike[],
  groupValue: string | null | undefined,
  eventDate:  string | null | undefined,
): ConfirmedMark | null {
  if (!groupValue || !eventDate) return null;

  let best: AnchorLike | null = null;
  for (const a of anchors) {
    if (a.group_value !== groupValue) continue;
    if (a.confirmed_on < eventDate) continue;          // ne obuhvaća ga
    // Najranija potvrda koja ga obuhvaća — usporedba stringova je ispravna za
    // `YYYY-MM-DD` i ne uvodi vremenske zone (`new Date('2026-09-06')` je UTC
    // ponoć, pa bi lokalna zona znala pomaknuti dan).
    if (best === null || a.confirmed_on < best.confirmed_on) best = a;
  }
  if (!best) return null;
  return { confirmedOn: best.confirmed_on, amount: best.amount, groupValue };
}

/** `YYYY-MM-DD` → `DD.MM.YYYY.` — poruku čita čovjek. */
export function hrDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}
