// ============================================================
// amountFormat.ts — one way to render a money-shaped number
// ============================================================
// Croatian formatting (1.234,56) because that is what the source spreadsheet
// and the bank apps show; a balance that has to be mentally re-punctuated to be
// compared against the bank defeats the point of showing it.
// ============================================================

const NF = new Intl.NumberFormat('hr-HR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1.234,56 €`. `unit` is appended verbatim, so it works for kg/min/km too. */
export function formatAmount(value: number, unit?: string): string {
  const s = NF.format(value);
  return unit ? `${s} ${unit}` : s;
}

/** Same, with an explicit sign — for deltas, where "+" carries information. */
export function formatSigned(value: number, unit?: string): string {
  const s = formatAmount(Math.abs(value), unit);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;   // U+2212, matches the minus in the tables
  return s;
}

/**
 * Parse what a person typed into the "u banci" field.
 * Accepts both `1.234,56` (hr) and `1234.56` (keyboard habit), and returns null
 * for anything it cannot read — the caller must not save a guess.
 */
export function parseAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(/€/g, '');
  if (!s) return null;

  // Decide which character is the decimal separator by which one comes last.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalised: string;
  if (lastComma > lastDot) {
    normalised = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalised = s.replace(/,/g, '');
  } else {
    normalised = s;
  }

  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/** `2026-08-15` → `15.08.2026.` */
export function formatDateHr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}.`;
}

/** Today as `YYYY-MM-DD` in LOCAL time (toISOString would shift across midnight). */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
