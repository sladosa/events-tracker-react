/**
 * attributeRules.ts — Faza 2b Post-Finish automatika (AUTOMATION_SPEC.md)
 *
 * `set_attribute` pravila: deriviraj vrijednost atributa iz vrijednosti drugog
 * atributa (npr. Datum naplate iz Izvor + session date). Konfiguracija živi u
 * `area.settings.automations.attribute_rules` (JSONB) — kod je generičan,
 * sva specifičnost (slugovi, mape) je podatak po Arei.
 *
 * Vokabular date_map vrijednosti (mali i fiksni — NE izrazi/DSL):
 *   'same'    → target = session date
 *   'next:N'  → N-ti dan sljedećeg mjeseca od session date
 */

import type { AttributeDefinition } from '@/types';
import type { AttributeRuleConfig } from '@/types/database';

export type { AttributeRuleConfig };

const RE_NEXT = /^next:(\d{1,2})$/;

/** Valid rule string? ('same' | 'next:N', 1 ≤ N ≤ 31) */
export function isValidDateRule(rule: string): boolean {
  if (rule === 'same') return true;
  const m = RE_NEXT.exec(rule);
  if (!m) return false;
  const day = parseInt(m[1], 10);
  return day >= 1 && day <= 31;
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
