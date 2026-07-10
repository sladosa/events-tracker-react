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
