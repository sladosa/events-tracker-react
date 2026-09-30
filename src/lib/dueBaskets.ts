// ============================================================
// dueBaskets.ts — košara protiv bankinog broja (DOSPJELO_SPEC §3, §5)
// ============================================================
// Čista funkcija, testabilna bez baze (isti obrazac kao `splitRataAmounts`).
//
// ⚠ U LIPAMA. Novac se ovdje uspoređuje s nulom (tolerancija 0,00 — odluka
//   D3), a zbroj decimala nosi grešku binarnog zapisa (`0,1 + 0,2`). Isti
//   razlog kao `ROUND(…, 2)` u Excelu (S112) i `splitRataAmounts` (S145).
// ⚠ NETO (minus − plus): banka tereti neto — povrat umanjuje skupnu naplatu
//   (ZABA košara 11.08.: isplate 2.868,04, povrat 3,00). Visa traži bruto
//   isplatu (spec §2, zrcalo `PRIMLJENA UPLATA`) — to je faza 4 i odluka
//   koja se donosi kad Visa uđe u config, ne sad.
// ============================================================

const toCents = (x: number): number => Math.round(x * 100);

/** Σ košare u lipama: ono što banka treba skinuti. */
export function basketNetCents(row: { gross_plus: number; gross_minus: number }): number {
  return toCents(row.gross_minus) - toCents(row.gross_plus);
}

export type BankCompare =
  | { state: 'empty' }
  | { state: 'ok' }
  | { state: 'diff'; diffCents: number };

/**
 * Usporedi Σ košare s brojem koji je čovjek upisao s ekrana banke.
 * `bank = null` ⇒ polje je prazno ili nečitljivo — tada se NE tvrdi ništa.
 * `diffCents` > 0 ⇒ košara je VEĆA od onoga što je banka skinula.
 *
 * ⚠ Polje se nikad ne popunjava unaprijed Σ-om: tada bi usporedba bila
 *   tautološka (§2.17), zelena po konstrukciji.
 */
export function compareWithBank(sumCents: number, bank: number | null): BankCompare {
  if (bank === null || !Number.isFinite(bank)) return { state: 'empty' };
  const diff = sumCents - toCents(bank);
  return diff === 0 ? { state: 'ok' } : { state: 'diff', diffCents: diff };
}
