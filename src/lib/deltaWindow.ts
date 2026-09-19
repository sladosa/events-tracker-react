/**
 * Delta prozor — koliko daleko unatrag ide delta sheet.
 * =====================================================
 *
 * DO S142 je prozor bio `max(dan poslije ZADNJEG sidra, danas − N dana)`, pa je
 * sidro bilo **tvrd pod**: raspon iz panela nije mogao doseći ispred njega.
 * Posljedica (izmjereno na PROD-u 18.09.2026.): panel traži 60 dana, ZABA file
 * nosi **12**, i **47 `Racun` redaka nestane bez ijedne poruke**. Isti razred kao
 * BUG-S123-DELTAACCT — file izađe uredan, s krivim opsegom, i ništa ne kaže.
 *
 * Sada se prozor mjeri **sidrima**, ne danima (`docs/DELTA_WINDOW_SPEC.md` §4.1).
 *
 * ⚠ ZAŠTO SIDRA, A NE DANI — i zašto je „N dana" pao na mjerenju:
 *   prozor mora krenuti DAN POSLIJE nekog sidra, jer tada je otvarajuće stanje
 *   **potvrđen broj bez ijednog dijela izračuna** (`fetchAnchoredBalance` na dan
 *   sidra vrati sam iznos sidra). „Danas − 60" pada na 20.07.2026., a najbliže
 *   sidro prije toga je na ZABA-i **01.01.2025.**, na RF-u **31.12.2022.** ⇒
 *   otvarajuće stanje bilo bi sidro + 565 odnosno **1.297 dana izračuna**.
 *   Dani to svojstvo ne mogu dati ni slučajno.
 *
 * ⚠ FUNKCIJA JE ČISTA I ŽIVI IZVAN MODALA NAMJERNO. Isti izbor treba **panel**
 *   (da ispiše stvarni raspon prije izvoza) i **izvoz** (da ga napravi). Dvije
 *   kopije istog uvjeta su prilika da se raziđu — a onda panel obeća jedan
 *   raspon, a file donese drugi. Isti razred kao `canUpdateExisting()` (S125).
 */

const DAY_MS = 86400000;

/** `YYYY-MM-DD` → UTC ms. ⚠ `Date.UTC` uzima mjesec 0-based (S113). */
function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Podskup `BalanceAnchor` koji ovaj izbor stvarno čita. */
export interface DeltaWindowAnchor {
  amount: number;
  confirmed_on: string;
  created_at?: string | null;
  group_value?: string;
  note?: string | null;
}

export interface DeltaWindowAnchorInfo {
  amount: number;
  confirmed_on: string;
  note: string | null;
}

export interface DeltaWindowResult {
  /** Sidro na kojem prozor počiva — izvor otvarajućeg stanja. `null` = račun ga nema. */
  anchor: DeltaWindowAnchorInfo | null;
  /** Prvi dan prozora (`dateFrom` za upit). */
  start: string;
  /** Dan prije prozora — `asOf` za otvarajuće stanje. Uz sidro je to točno dan sidra. */
  dayBefore: string;
  /** Koliko dana prozor pokriva, uključivo (start … danas). */
  spanDays: number;
  /** `false` ⇒ račun nema nijedno sidro, pa se palo na `fallbackDays`. */
  fromAnchor: boolean;
  /** Koliko sidara račun uopće ima (do danas). */
  anchorsAvailable: number;
  /** Stvarno upotrijebljen K — može biti manji od traženog. */
  anchorsBackUsed: number;
  /** `true` ⇒ traženi K je veći od broja sidara, pa je uzeto najstarije. */
  clamped: boolean;
  /**
   * Sidra koja padaju UNUTAR prozora (novija od onog na kojem prozor počiva).
   * Faza 3 nad njima gradi kontrolne točke; faza 1 ih samo broji u panelu.
   */
  anchorsInWindow: DeltaWindowAnchorInfo[];
}

/**
 * Odabir prozora.
 *
 * @param anchors      sva sidra Aree za tu grupu (bilo kojim redom)
 * @param account      grupa/račun za koji se gradi sheet
 * @param today        `YYYY-MM-DD`, današnji dan
 * @param anchorsBack  K — koliko sidara unatrag. 0 = dosadašnje ponašanje
 *                     (dan poslije zadnjeg sidra), 1 = prozor obuhvaća zadnje sidro.
 * @param fallbackDays koliko dana unatrag kad račun NEMA nijedno sidro
 */
export function pickDeltaWindow(
  anchors: DeltaWindowAnchor[],
  account: string,
  today: string,
  anchorsBack: number,
  fallbackDays: number,
): DeltaWindowResult {
  // ⚠ Isti izbor koji radi RPC: najnovije potvrđeno, a kod istog datuma ono
  //   ZADNJE upisano — tako se tipfeler ispravlja novim retkom, ne UPDATE-om.
  //   Raziđe li se ovaj sort s RPC-om, otvarajuće stanje prestane biti iznos
  //   sidra koje panel imenuje, i to bez ijedne poruke.
  const sorted = anchors
    .filter(a => a.group_value === account && a.confirmed_on <= today)
    .sort((a, b) => (a.confirmed_on === b.confirmed_on
      ? String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      : b.confirmed_on.localeCompare(a.confirmed_on)));

  const todayMs = ymdToUtcMs(today);
  const info = (a: DeltaWindowAnchor): DeltaWindowAnchorInfo => ({
    amount: a.amount, confirmed_on: a.confirmed_on, note: a.note ?? null,
  });

  // Račun bez sidra: prozor se ne može usidriti, pa se pada na dane. Bez ovoga
  // bi prozor krenuo od početka vremena i izvezao cijelu povijest.
  if (sorted.length === 0) {
    const startMs = todayMs - (Math.max(1, fallbackDays) - 1) * DAY_MS;
    return {
      anchor: null,
      start: utcMsToYmd(startMs),
      dayBefore: utcMsToYmd(startMs - DAY_MS),
      spanDays: Math.max(1, fallbackDays),
      fromAnchor: false,
      anchorsAvailable: 0,
      anchorsBackUsed: 0,
      clamped: false,
      anchorsInWindow: [],
    };
  }

  const wanted = Math.max(0, Math.floor(anchorsBack));
  const idx    = Math.min(wanted, sorted.length - 1);
  const anchor = sorted[idx];

  // Prozor kreće DAN POSLIJE sidra: sidro je „potvrđeno stanje NA dan X", a saldo
  // su promjene STROGO nakon njega (OVERVIEW_TAB_SPEC §2.17). Redak datiran točno
  // na X već je unutar potvrđenog iznosa, pa bi ga kontrolna formula brojala dvaput.
  const anchorMs = ymdToUtcMs(anchor.confirmed_on);
  const startMs  = anchorMs + DAY_MS;

  return {
    anchor: info(anchor),
    start: utcMsToYmd(startMs),
    // ⚠ Uz sidro je `dayBefore` točno dan sidra ⇒ `fetchAnchoredBalance` vrati
    //   SAM IZNOS SIDRA. To je cijela poanta ove promjene i ujedno njezin test:
    //   otvarajuće stanje mora izaći jednako iznosu sidra U CENT (T-S141-4).
    dayBefore: anchor.confirmed_on,
    spanDays: Math.round((todayMs - startMs) / DAY_MS) + 1,
    fromAnchor: true,
    anchorsAvailable: sorted.length,
    anchorsBackUsed: idx,
    clamped: wanted > idx,
    // ⚠ Sidra NOVIJA od onog na kojem prozor počiva padaju unutar prozora. Za njih
    //   vrijedi OBRNUTO pravilo od gornjeg: redak datiran točno na dan takvog sidra
    //   MORA ući, jer ga to sidro obuhvaća. Isto pravilo, dva sidra, suprotan ishod
    //   (SPEC §4.2) — najvjerojatnije mjesto na kojem će se pogriješiti.
    anchorsInWindow: sorted.slice(0, idx).map(info),
  };
}
