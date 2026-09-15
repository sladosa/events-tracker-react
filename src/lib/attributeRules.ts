/**
 * attributeRules.ts — Faza 2b Post-Finish automatika (AUTOMATION_SPEC.md)
 *
 * `set_attribute` pravila: deriviraj vrijednost atributa iz vrijednosti drugog
 * atributa (npr. Datum naplate iz Izvor + session date). Konfiguracija živi u
 * `area.settings.automations.attribute_rules` (JSONB) — kod je generičan,
 * sva specifičnost (slugovi, mape) je podatak po Arei.
 *
 * Vokabular date_map vrijednosti (mali i fiksni — NE izrazi/DSL):
 *   'same'        → target = session date
 *   'next:N'      → N-ti dan sljedećeg mjeseca od session date
 *   'cutoff:B:D'  → prva pojava dana D na ili nakon sljedećeg dana B
 *
 * KOJE PRAVILO ZA KOJU KARTICU — kartica ima TRI datuma i lako se zamijene:
 *     zatvaranje izvoda (B)  →  terećenje računa (D)  →  dospijeće
 * `Datum naplate` znači TEREĆENJE. Za novu karticu se oba IZMJERE, ne pogađaju:
 *     D je u SLJEDEĆEM mjesecu od B  →  next:D        (Mastercard: next:11)
 *     D je u ISTOM mjesecu kao B     →  cutoff:B:D    (Visa: cutoff:3:5)
 *
 * ⚠ Zašto Visa nije `next:5`: transakcija 04.06. pripada izvodu koji se zatvara
 *   02.07. i tereti se ~05.07.; `next:5` bi je stavila na 05.06. — mjesec prerano.
 *   `next:3` bi pogodio mjesec, ali upisao 3., a tada novac još nije otišao.
 *   Izmjereno na PROD-u (S137): zatvaranje 2.–3., terećenje 4.–7. (36 od 41
 *   naplate), dospijeće 11. (32/32 izvoda). Mastercardu se sva tri poklapaju.
 */

import type { AttributeDefinition } from '@/types';
import type { AttributeRuleConfig } from '@/types/database';

export type { AttributeRuleConfig };

const RE_NEXT = /^next:(\d{1,2})$/;
const RE_CUTOFF = /^cutoff:(\d{1,2}):(\d{1,2})$/;

const inMonth = (n: number) => n >= 1 && n <= 31;

/** Valid rule string? ('same' | 'next:N' | 'cutoff:B:D', dani 1–31) */
export function isValidDateRule(rule: string): boolean {
  if (rule === 'same') return true;
  const c = RE_CUTOFF.exec(rule);
  if (c) return inMonth(parseInt(c[1], 10)) && inMonth(parseInt(c[2], 10));
  const m = RE_NEXT.exec(rule);
  if (!m) return false;
  return inMonth(parseInt(m[1], 10));
}

/**
 * Evaluate a date rule against a base date. Returns null for unknown rules.
 * 'next:N' guards month-overflow the same way as generateRataDates
 * (day reset to 1 before month increment, e.g. Jan 31 → Feb N, not Mar N).
 */
export function evaluateDateRule(rule: string, base: Date): Date | null {
  if (rule === 'same') {
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // 'cutoff:B:D' — dva koraka, jer granica ciklusa i dan naplate NISU isti dan.
  //   1. nađi sljedeću pojavu dana B (granica: na dan B izvod se još zatvara,
  //      pa transakcija OD TOG DANA pripada sljedećem ciklusu — zato `> B`)
  //   2. uzmi dan D u mjesecu te granice
  // ⚠ `base` na sam dan B ide u TEKUĆI ciklus (izvod se zatvara na kraju tog
  //   dana), pa je usporedba `>` a ne `>=`. Izmjereno: zadnja transakcija na
  //   izvodu pada baš na 2.–3., dakle dan granice je još „unutra".
  const c = RE_CUTOFF.exec(rule);
  if (c) {
    const b = parseInt(c[1], 10);
    const dd = parseInt(c[2], 10);
    if (!inMonth(b) || !inMonth(dd)) return null;
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    // 1. mjesec granice: dan > B ⇒ granica je tek sljedeći mjesec
    const afterBoundary = d.getDate() > b;
    d.setDate(1);                       // month-overflow guard, kao kod 'next:N'
    if (afterBoundary) d.setMonth(d.getMonth() + 1);
    // 2. dan D u tom mjesecu; ako D nije NAKON granice, ide mjesec dalje
    //    ⚠ pokriva i karticu koja se zatvara kasno a tereti rano (B=25, D=5):
    //      bez ovoga bi naplata ispala PRIJE zatvaranja izvoda.
    if (dd <= b) d.setMonth(d.getMonth() + 1);
    d.setDate(dd);
    return d;
  }

  const m = RE_NEXT.exec(rule);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Local-time 'YYYY-MM-DDTHH:mm' — the format datetime-local inputs use. */
export function formatForDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Compute the target value for one set_attribute rule.
 * Returns null when the map value has no entry in date_map (rule skipped) —
 * the caller must then leave the target untouched.
 */
export function computeSetAttributeValue(
  rule: AttributeRuleConfig,
  mapValue: string | null,
  sessionStart: Date,
): string | null {
  if (mapValue == null || mapValue === '') return null;
  const dateRule = rule.date_map[mapValue];
  if (!dateRule) return null;
  const result = evaluateDateRule(dateRule, sessionStart);
  return result ? formatForDatetimeInput(result) : null;
}

/** Slug match tolerant to -/_ differences (same normalisation as default_map lookup). */
function slugKey(slug: string): string {
  return slug.toLowerCase().replace(/[-_]/g, '_');
}

export function findDefBySlug(
  defs: AttributeDefinition[],
  slug: string,
): AttributeDefinition | undefined {
  return defs.find(d => d.slug === slug)
    ?? defs.find(d => slugKey(d.slug) === slugKey(slug));
}

// ============================================
// Izvedeni atributi — što forma RAČUNA, a ne čita od čovjeka
// ============================================
// Snimka shortcuta (`activity_presets.default_attributes`) sprema doslovne
// vrijednosti. Za izvedeni atribut to je zamrznut REZULTAT jednog trenutka, a
// ne unos — i gori je od nepostojećeg, jer poslije blokira pravilo koje bi ga
// ispravilo: `set_attribute` čuva ručni unos tako da preskoči target koji već
// ima vrijednost koju samo nije upisalo (`userOwned`), a preset izgleda točno
// tako. Izmjereno na PROD-u 04.09.2026.: preset `Isplata` (spremljen 02.09. uz
// `Izvor = Mastercard`) nosio je `datum_naplate = 2026-10-11`, pa je `Izvor =
// Racun` — koji traži isti dan — ostao bez ijednog učinka i bez poruke.
//
// Dvije vrste, i NE liječe se isto:
//   `computed` — target `set_attribute` pravila. Pravilo je JEDINI izvor, pa ga
//                ne smije zasjeniti ni preset ni `default_value`.
//   `mapped`   — atribut s `depends_on.default_map` (npr. Status iz Izvora).
//                Puni se iz roditelja — pri učitavanju defaulta i pri svakoj
//                promjeni roditelja — pa preset ne smije zamrznuti vrijednost,
//                ali `default_value` ostaje legitiman dok roditelj nema vrijednost.

export interface RuleManagedIds {
  /** `set_attribute` targets — ni preset ni `default_value` ih ne smiju sijati. */
  computed: Set<string>;
  /** `depends_on.default_map` targets — preset ih ne smije zamrznuti. */
  mapped: Set<string>;
  /** Unija — ovo shortcut snimka izostavlja. */
  all: Set<string>;
}

/**
 * Which attribute ids does the Add form derive on its own?
 *
 * `getDefaultMap` is passed in rather than parsed here: `validation_rules` has
 * three historical shapes and exactly one parser (`parseValidationRules`) —
 * a second reader would be a second thing to keep in sync.
 */
export function collectRuleManagedIds(
  defs: AttributeDefinition[],
  automations: { attribute_rules?: AttributeRuleConfig[] } | undefined,
  getDefaultMap: (def: AttributeDefinition) => Record<string, string> | undefined,
): RuleManagedIds {
  const computed = new Set<string>();
  const mapped = new Set<string>();

  for (const rule of automations?.attribute_rules ?? []) {
    if (rule.action !== 'set_attribute') continue;
    const target = findDefBySlug(defs, rule.target_slug);
    if (target) computed.add(target.id);
  }

  for (const def of defs) {
    if (computed.has(def.id)) continue;
    const map = getDefaultMap(def);
    // Prazna mapa nije mapa — atribut bez ijednog para ništa ne izvodi.
    if (map && Object.keys(map).length > 0) mapped.add(def.id);
  }

  return { computed, mapped, all: new Set([...computed, ...mapped]) };
}
