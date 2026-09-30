// ============================================================
// dueConfirm.ts — „Dospjelo → potvrdi", faza 2 (DOSPJELO_SPEC §5)
// ============================================================
// Čitanje i upis iza trake „Čeka potvrdu". Odluke su u `dueBaskets.ts` (čiste
// funkcije, testirane); ovdje je samo I/O.
//
// REDOSLIJED UPISA JE NAMJERAN: prvo skupni redak, pa statusi.
//   Padne li prebacivanje statusa nakon što je skupni redak upisan, košara
//   ostaje u traci SA skupnim retkom ⇒ traka sljedeći put nudi samo „prebaci
//   statuse" (`flip`), bez drugog retka. Obrnuti redoslijed bi pad ostavio
//   s retcima `Izvrsen` a bez naplate — saldo bi bio kriv, a traka prazna.
//
// ⚠ Upis ide kroz RLS, ne kroz SECURITY DEFINER: baza sama brani D5
//   (vlasnica Aree smije mijenjati atribute tuđih redaka, `043`). I zato se
//   BROJI koliko je redaka stvarno promijenjeno — RLS-blokiran UPDATE
//   „uspije" s 0 redaka (S133).
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import { withRetryQuery } from '@/lib/retry';
import { localYmd } from '@/lib/localDate';
import { buildParentChainIds } from '@/lib/parentEventLoader';
import { computeSetAttributeValue, findDefBySlug } from '@/lib/attributeRules';
import { findFreeSessionStart, insertEntry, type EntryAttr } from '@/lib/insertEntry';
import {
  SETTLE_WINDOW_DAYS, basketNetCents, matchSettleRow, settleValues,
  type SettleCandidate, type SettleMatch,
} from '@/lib/dueBaskets';
import type { AttributeDefinition } from '@/types';
import type { AreaSettings, BalanceByGroupWidget, DueConfig, UUID } from '@/types/database';

type Widget = BalanceByGroupWidget & { due: DueConfig };

function browserTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** `YYYY-MM-DD` ± n dana, stringovno (UTC podne — bez DST pomaka). */
function shiftYmd(ymd: string, n: number): string {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), 12));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface BasketMember {
  event_id: UUID;
  user_id: UUID;
  category_id: UUID;
  status: string | null;
  plus_v: number | null;
  minus_v: number | null;
}

/** Retci jedne košare (sql/055) — ISTA definicija košare kao Σ u traci. */
export async function fetchBasketMembers(areaId: UUID, w: Widget, basket: string, dueDate: string): Promise<BasketMember[]> {
  const { data } = await withRetryQuery(() => supabase.rpc('rpc_area_due_basket_members', {
    p_area_id: areaId,
    p_basket_slug: w.due.basket_by,
    p_due_slug: w.due.due_slug,
    p_status_slug: w.due.status_slug,
    p_plus_slug: w.plus ?? null,
    p_minus_slug: w.minus ?? null,
    p_basket: basket,
    p_due_date: dueDate,
    p_tz: browserTz(),
  }));
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    event_id: r.event_id as UUID,
    user_id: r.user_id as UUID,
    category_id: r.category_id as UUID,
    status: (r.status as string | null) ?? null,
    plus_v: r.plus_v == null ? null : Number(r.plus_v),
    minus_v: r.minus_v == null ? null : Number(r.minus_v),
  }));
}

/**
 * Pravilo B: postoji li već skupni redak košare. Neuspjelo čitanje BACA —
 * „nisam uspio pogledati" pročitano kao „nema ga" nudi DRUGI skupni redak.
 */
export async function findSettleRow(areaId: UUID, w: Widget, basket: string, dueDate: string): Promise<SettleMatch | null> {
  const cfg = w.due.baskets[basket];
  if (!cfg?.text || !w.due.settle) return null;

  const { data: evs } = await withRetryQuery(() => supabase
    .from('events')
    .select('id, event_date, comment, categories!inner(area_id)')
    .eq('categories.area_id', areaId)
    .eq('comment', cfg.text!)
    .is('chain_key', null)
    .gte('event_date', shiftYmd(dueDate, -SETTLE_WINDOW_DAYS))
    .lte('event_date', shiftYmd(dueDate, SETTLE_WINDOW_DAYS))
    .order('id'));
  const rows = (evs ?? []) as { id: string; event_date: string; comment: string | null }[];
  if (rows.length === 0) return null;

  const { data: attrs } = await withRetryQuery(() => supabase
    .from('event_attributes')
    .select('event_id, value_text, value_number, attribute_definitions!inner(slug)')
    .in('event_id', rows.map(r => r.id))
    .order('id'));

  const byEvent = new Map<string, SettleCandidate['values']>();
  for (const a of (attrs ?? []) as unknown as {
    event_id: string; value_text: string | null; value_number: number | null;
    attribute_definitions: { slug: string } | { slug: string }[];
  }[]) {
    const def = Array.isArray(a.attribute_definitions) ? a.attribute_definitions[0] : a.attribute_definitions;
    if (!def) continue;
    const vals = byEvent.get(a.event_id) ?? {};
    vals[def.slug] = a.value_number != null ? Number(a.value_number) : a.value_text;
    byEvent.set(a.event_id, vals);
  }

  return matchSettleRow(
    rows.map(r => ({ ...r, values: byEvent.get(r.id) ?? {} })),
    {
      text: cfg.text, account: cfg.account, groupSlug: w.group_by, settle: w.due.settle,
      plusSlug: w.plus, minusSlug: w.minus, dueDate,
    },
  );
}

/** Skupni `Racun` redak: vrijednosti iz configa + bankin iznos i dan. */
async function createSettleRow(p: {
  areaId: UUID; w: Widget; basket: string; leafCategoryId: UUID;
  bankDate: string; amountCents: number; userId: string;
}): Promise<UUID> {
  const { w } = p;
  const cfg = w.due.baskets[p.basket];
  if (!cfg?.text) throw new Error(`Config košare "${p.basket}" nema strojni tekst (\`text\`) — skupni redak bez njega traka ne bi prepoznala.`);
  if (!w.due.settle) throw new Error('Config nema `settle` — ne znam kakav je skupni redak.');
  if (!w.due.done) throw new Error('Config nema `done` — ne znam u što prebaciti status.');

  const parentIds = await buildParentChainIds(p.leafCategoryId);
  const catIds = [p.leafCategoryId, ...parentIds];
  const { data: defRows } = await withRetryQuery(() => supabase
    .from('attribute_definitions')
    .select('id, slug, data_type, category_id')
    .in('category_id', catIds)
    .order('id'));
  const defs = (defRows ?? []) as AttributeDefinition[];

  const bySlug = settleValues({
    settle: w.due.settle, groupSlug: w.group_by, account: cfg.account,
    statusSlug: w.due.status_slug, done: w.due.done,
    plusSlug: w.plus, minusSlug: w.minus, amountCents: p.amountCents,
  });

  // Izvedeni atributi (npr. `Datum naplate` iz `Izvor`a) — isto pravilo kao
  // Add, nad istim trenutkom. Vrijednost koju config već nosi se ne dira.
  const desired = new Date(`${p.bankDate}T12:00:00`);
  const { data: areaRow } = await withRetryQuery(() => supabase
    .from('areas').select('settings').eq('id', p.areaId).single());
  const rules = ((areaRow as { settings: AreaSettings | null } | null)?.settings?.automations?.attribute_rules) ?? [];
  const derived: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.action !== 'set_attribute' || rule.target_slug in bySlug) continue;
    const mapVal = bySlug[rule.map_slug];
    const v = computeSetAttributeValue(rule, mapVal == null ? null : String(mapVal), desired);
    if (v) derived[rule.target_slug] = v;
  }

  const attrs: EntryAttr[] = [];
  for (const [slug, value] of Object.entries({ ...bySlug, ...derived })) {
    const def = findDefBySlug(defs, slug);
    if (!def) throw new Error(`Atribut "${slug}" iz configa ne postoji u kategoriji košare — skupni redak nije upisan.`);
    attrs.push({ definitionId: def.id, value, dataType: def.data_type });
  }
  const catOf = new Map(defs.map(d => [d.id, d.category_id as UUID]));

  const sessionStartIso = await findFreeSessionStart(p.userId, p.leafCategoryId, desired, p.bankDate);
  return insertEntry({
    userId: p.userId,
    leafCategoryId: p.leafCategoryId,
    parentCategoryIds: parentIds,
    eventDate: p.bankDate,
    sessionStartIso,
    comment: cfg.text,
    attrs,
    categoryOf: id => catOf.get(id),
  });
}

/** `Planiran → Izvrsen` na zadanim retcima; baca ako nije promijenjen SVAKI. */
async function flipStatuses(areaId: UUID, w: Widget, eventIds: UUID[]): Promise<number> {
  if (!w.due.done) throw new Error('Config nema `done` — ne znam u što prebaciti status.');
  const { data: defRows } = await withRetryQuery(() => supabase
    .from('attribute_definitions')
    .select('id, categories!inner(area_id)')
    .eq('slug', w.due.status_slug)
    .eq('categories.area_id', areaId)
    .order('id'));
  const statusDefIds = ((defRows ?? []) as { id: string }[]).map(d => d.id);
  if (statusDefIds.length === 0) throw new Error(`Atribut "${w.due.status_slug}" nije nađen u ovoj Arei.`);

  let changed = 0;
  for (let i = 0; i < eventIds.length; i += 100) {
    const chunk = eventIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from('event_attributes')
      .update({ value_text: w.due.done })
      .in('event_id', chunk)
      .in('attribute_definition_id', statusDefIds)
      .eq('value_text', w.due.pending)
      .select('id');
    if (error) throw error;
    changed += (data ?? []).length;
  }
  return changed;
}

export interface SettleResult {
  settleRowId: UUID | null;
  flipped: number;
}

/**
 * Izvrši ono što je traka ponudila. Prije svakog upisa se stanje ČITA
 * PONOVO: traka je mogla stajati otvorena satima, a Σ koji je Koka vidjela
 * mora biti Σ nad kojim se potvrđuje (inače bi potvrdila košaru koju nije
 * vidjela).
 */
export async function settleBasket(p: {
  areaId: UUID;
  w: Widget;
  basket: string;
  dueDate: string;
  kind: 'confirm' | 'record' | 'flip';
  /** Σ koji je traka pokazala — mora se poklopiti sa svježim čitanjem. */
  shownSumCents: number;
  /** Za `confirm`/`record`: bankin broj i dan. */
  bankCents?: number;
  bankDate?: string;
}): Promise<SettleResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nisi prijavljen.');

  const members = await fetchBasketMembers(p.areaId, p.w, p.basket, p.dueDate);
  const fresh = basketNetCents({
    gross_plus: members.reduce((s, m) => s + (m.plus_v ?? 0), 0),
    gross_minus: members.reduce((s, m) => s + (m.minus_v ?? 0), 0),
  });
  if (fresh !== p.shownSumCents) {
    throw new Error('Košara se promijenila otkad je traka učitana — osvježi (↻) i provjeri ponovo.');
  }
  const pending = members.filter(m => m.status === p.w.due.pending).map(m => m.event_id);

  const existing = await findSettleRow(p.areaId, p.w, p.basket, p.dueDate);
  let settleRowId: UUID | null = null;

  if (p.kind === 'confirm' || p.kind === 'record') {
    if (existing) throw new Error('Skupni redak za ovu naplatu već postoji — osvježi (↻).');
    if (p.bankCents == null || !p.bankDate) throw new Error('Nedostaje bankin iznos ili dan.');
    if (p.bankDate > localYmd(new Date())) throw new Error('Dan naplate je u budućnosti.');
    const cats = [...new Set(members.map(m => m.category_id))];
    if (cats.length !== 1) {
      throw new Error(`Košara je u ${cats.length} kategorija — ne znam u koju upisati skupni redak.`);
    }
    settleRowId = await createSettleRow({
      areaId: p.areaId, w: p.w, basket: p.basket, leafCategoryId: cats[0],
      bankDate: p.bankDate, amountCents: p.bankCents, userId: user.id,
    });
  } else if (!existing || existing.amountCents !== fresh) {
    throw new Error('Skupni redak se promijenio otkad je traka učitana — osvježi (↻).');
  }

  let flipped = 0;
  if (p.kind === 'confirm' || p.kind === 'flip') {
    flipped = await flipStatuses(p.areaId, p.w, pending);
    if (flipped !== pending.length) {
      throw new Error(
        `Potvrđeno ${flipped} od ${pending.length} redaka — ostali nisu promijenjeni (prava ili istovremena izmjena). `
        + (settleRowId ? 'Skupni redak je upisan; ' : '')
        + 'osvježi (↻) i potvrdi ostatak.',
      );
    }
  }
  return { settleRowId, flipped };
}
