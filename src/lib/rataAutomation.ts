import type { AttributeDefinition } from '@/types';
import type { RataAutomationConfig } from '@/types/database';

export type { RataAutomationConfig };

export interface RataInfo {
  count: number;
  amountPerRata: number;
  totalAmount: number;
  dateMapValue: string;
  dates: Date[];
  originalComment: string | null;
}

interface RataAttrInput {
  definitionId: string;
  value: string | number | boolean | null;
}

const TRUTHY_VALUES = new Set(['true', 'da', 'yes', '1', 'ja']);

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

  let dateMapValue = '';
  if (dateMapDef) {
    const dmAttr = attrByDefId.get(dateMapDef.id);
    dateMapValue = String(dmAttr?.value ?? '');
  }

  return { count, amountPerRata, totalAmount, dateMapValue, dates: [], originalComment: null };
}

export function generateRataDates(
  sessionStart: Date,
  count: number,
  dateMapValue: string,
  config: RataAutomationConfig
): Date[] {
  const dayOfMonth = config.date_map[dateMapValue] ?? 15;
  const dates: Date[] = [];

  for (let i = 1; i <= count; i++) {
    const d = new Date(sessionStart);
    d.setDate(1); // reset day first to avoid month-overflow (e.g. Jan 31 → Mar 3)
    d.setMonth(d.getMonth() + i);
    d.setDate(dayOfMonth);
    d.setHours(12, 0, 0, 0);
    dates.push(d);
  }

  return dates;
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
