import type { AttributeDefinition } from '@/types';
import type { RataAutomationConfig } from '@/types/database';

export type { RataAutomationConfig };

export interface RataInfo {
  count: number;
  /** Zaokruzeni iznos JEDNE rate — samo za naslov modala. */
  amountPerRata: number;
  /**
   * Iznos SVAKE rate, 1..count. Zbroj je **tocno** `totalAmount`.
   *
   * ⚠ BUG-S145-RATASPLIT: prije je svaka rata dobivala isti
   *   `amountPerRata`, pa je zbroj bio manji od ukupnog kad dijeljenje
   *   nije tocno. Izmjereno na PROD-u 22.09.2026.: `117,32 / 6` dalo je
   *   6 x `19,55` = `117,30`, manjak `0,02`, dok komentar svakog retka
   *   i dalje pise `19.55 od 117.32`. Saldo to ne otkriva (karticni retci
   *   ga ne micu) — vidjelo bi se tek kad stigne izvod, kao razlika
   *   izmedju Σ kosare i iznosa terecenja, dakle kao greska u SPARIVANJU.
   */
  amounts: number[];
  totalAmount: number;
  dateMapValue: string;
  /**
   * Datumi NAPLATE rata (1..count) — idu u `Datum naplate` atribut.
   * NE u `event_date`: sve rate jedne kupovine dijele event_date = dan kupnje
   * (v. FINANCIJE_MIGRACIJA D1). Kartična kupovina na rate ponaša se identično
   * kao obična kartična kupovina, samo ima više datuma naplate.
   */
  chargeDates: Date[];
  originalComment: string | null;
}

interface RataAttrInput {
  definitionId: string;
  value: string | number | boolean | null;
}

const TRUTHY_VALUES = new Set(['true', 'da', 'yes', '1', 'ja']);

/**
 * Razdijeli iznos na `count` rata tako da im je zbroj **tocno** `total`.
 *
 * Ostatak zaokruzivanja nosi PRVA rata — isto kao banka: izmjereno na
 * 62 plana s >=3 rate, **23** ih ima prvu ratu razlicitu od ostalih
 * (`rate_alat.py`). Dakle poklapamo se s izvorom umjesto da od njega
 * odstupamo, a kontrola kosare (Σ == iznos terecenja) ostaje upotrebljiva.
 *
 * ⚠ Racuna se u LIPAMA (cijeli brojevi). Zbrajanje decimalnih brojeva
 *   nosi gresku binarnog zapisa (~1e-13), a novac se usporeduje s nulom
 *   — isti razlog zbog kojeg kontrolne celije u Excelu idu kroz ROUND
 *   (S112).
 * ⚠ `Math.trunc`, ne `Math.floor`: kod negativnog iznosa (povrat) floor
 *   vuce od nule pa bi ostatak promijenio predznak.
 */
export function splitRataAmounts(total: number, count: number): number[] {
  if (!Number.isFinite(total) || !Number.isInteger(count) || count < 1) return [];
  const cents = Math.round(total * 100);
  const per = Math.trunc(cents / count);
  const rest = cents - per * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push((i === 0 ? per + rest : per) / 100);
  return out;
}

export function detectRata(
  attrs: RataAttrInput[],
  attrDefs: AttributeDefinition[],
  config: RataAutomationConfig
): RataInfo | null {
  const defBySlug = new Map(attrDefs.map(d => [d.slug, d]));
  const attrByDefId = new Map(attrs.map(a => [a.definitionId, a]));

  const triggerDef = defBySlug.get(config.trigger_slug);
  const countDef = defBySlug.get(config.count_slug);
  const amountDef = defBySlug.get(config.amount_slug);
  const dateMapDef = config.date_map_slug ? defBySlug.get(config.date_map_slug) : undefined;

  if (!triggerDef || !countDef || !amountDef) return null;

  const triggerAttr = attrByDefId.get(triggerDef.id);
  if (!triggerAttr) return null;
  if (!TRUTHY_VALUES.has(String(triggerAttr.value ?? '').toLowerCase().trim())) return null;

  const countAttr = attrByDefId.get(countDef.id);
  const count = parseInt(String(countAttr?.value ?? '0'), 10);
  if (!countAttr || isNaN(count) || count <= 1) return null;

  const amountAttr = attrByDefId.get(amountDef.id);
  const totalAmount = parseFloat(String(amountAttr?.value ?? '0'));
  if (!amountAttr || isNaN(totalAmount) || totalAmount === 0) return null;

  const amountPerRata = Math.round((totalAmount / count) * 100) / 100;
  const amounts = splitRataAmounts(totalAmount, count);

  let dateMapValue = '';
  if (dateMapDef) {
    const dmAttr = attrByDefId.get(dateMapDef.id);
    dateMapValue = String(dmAttr?.value ?? '');
  }

  return { count, amountPerRata, amounts, totalAmount, dateMapValue,
           chargeDates: [], originalComment: null };
}

/**
 * Datumi naplate rata 1..count: N-ti dan svakog sljedećeg mjeseca od kupnje.
 * Podne (12:00) je namjerno — izbjegava pomak dana po vremenskoj zoni, isto
 * kao `evaluateDateRule` u attributeRules.ts.
 */
export function generateRataChargeDates(
  purchaseDate: Date,
  count: number,
  dateMapValue: string,
  config: RataAutomationConfig
): Date[] {
  const dayOfMonth = config.date_map[dateMapValue] ?? 15;
  const dates: Date[] = [];

  for (let i = 1; i <= count; i++) {
    const d = new Date(purchaseDate);
    d.setDate(1); // reset day first to avoid month-overflow (e.g. Jan 31 → Mar 3)
    d.setMonth(d.getMonth() + i);
    d.setDate(dayOfMonth);
    d.setHours(12, 0, 0, 0);
    dates.push(d);
  }

  return dates;
}

/**
 * `session_start` za rate 2..count — base + 1 min po rati.
 *
 * Sve rate dijele `event_date`, a `useActivities.ts` grupira listu po
 * user+category+session_start. Bez pomaka bi se cijela kupovina slijepila u
 * JEDAN redak u listi. Sekunde se nuliraju — collision detekcija ovisi o tome
 * da je `session_start` zaokružen na minutu.
 */
export function rataSessionStarts(base: Date, count: number): Date[] {
  const out: Date[] = [];
  for (let i = 1; i < count; i++) {
    const d = new Date(base);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + i);
    out.push(d);
  }
  return out;
}

export function buildRataComment(
  index: number,
  total: number,
  originalComment: string | null,
  amountPerRata?: number,
  totalAmount?: number
): string {
  const base = originalComment?.trim() ? `${originalComment.trim()} · ` : '';
  const amountPart = amountPerRata !== undefined && totalAmount !== undefined
    ? ` · ${amountPerRata} od ${totalAmount}`
    : '';
  return `${base}rata ${index}/${total}${amountPart}`;
}
