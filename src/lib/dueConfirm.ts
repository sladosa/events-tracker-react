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
import { VALUE_COLUMNS } from '@/lib/constants';
import {
  SETTLE_WINDOW_DAYS, adoptChanges, basketNetCents, findSuspectSettleRows, matchSettleRow, settleValues,
  type AdoptChange, type SettleCandidate, type SettleMatch,
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
/**
 * Leaf eventi Aree u prozoru [centar ± SETTLE_WINDOW_DAYS], s vrijednostima
 * po slugu. `comment` sužava upit (pravilo B); bez njega se čita cijeli
 * prozor (pravilo C — ručni redak može imati bilo kakav opis).
 */
async function loadCandidates(areaId: UUID, centerYmd: string, comment?: string): Promise<SettleCandidate[]> {
  // ⚠ `events` ima DVA FK-a prema `categories` (`category_id`, `chain_key`) ⇒
  //   embed bez imena veze PostgREST odbija (PGRST201, HTTP 300).
  let q = supabase
    .from('events')
    .select('id, event_date, comment, categories!events_category_id_fkey!inner(area_id)')
    .eq('categories.area_id', areaId)
    .is('chain_key', null)
    .gte('event_date', shiftYmd(centerYmd, -SETTLE_WINDOW_DAYS))
    .lte('event_date', shiftYmd(centerYmd, SETTLE_WINDOW_DAYS));
  if (comment != null) q = q.eq('comment', comment);
  const { data: evs } = await withRetryQuery(() => q.order('id'));
  const rows = (evs ?? []) as { id: string; event_date: string; comment: string | null }[];
  if (rows.length === 0) return [];

  // Prozor od 7 dana na jednoj Arei je desetci redaka × ~12 atributa — ispod
  // 1000 (PostgREST reže bez greške), ali se ipak paginira u blokovima.
  const byEvent = new Map<string, SettleCandidate['values']>();
  for (let i = 0; i < rows.length; i += 60) {
    const chunk = rows.slice(i, i + 60).map(r => r.id);
    const { data: attrs } = await withRetryQuery(() => supabase
      .from('event_attributes')
      .select('event_id, value_text, value_number, attribute_definitions!inner(slug)')
      .in('event_id', chunk)
      .order('id'));
    const list = (attrs ?? []) as unknown as {
      event_id: string; value_text: string | null; value_number: number | null;
      attribute_definitions: { slug: string } | { slug: string }[];
    }[];
    if (list.length >= 1000) throw new Error('Previše atributa u prozoru naplate — upit bi bio odrezan.');
    for (const a of list) {
      const def = Array.isArray(a.attribute_definitions) ? a.attribute_definitions[0] : a.attribute_definitions;
      if (!def) continue;
      const vals = byEvent.get(a.event_id) ?? {};
      vals[def.slug] = a.value_number != null ? Number(a.value_number) : a.value_text;
      byEvent.set(a.event_id, vals);
    }
  }
  return rows.map(r => ({ ...r, values: byEvent.get(r.id) ?? {} }));
}

export async function findSettleRow(areaId: UUID, w: Widget, basket: string, dueDate: string): Promise<SettleMatch | null> {
  const cfg = w.due.baskets[basket];
  if (!cfg?.text || !w.due.settle) return null;

  const cands = await loadCandidates(areaId, dueDate, cfg.text);
  if (cands.length === 0) return null;

  return matchSettleRow(
    cands,
    {
      text: cfg.text, account: cfg.account, groupSlug: w.group_by, settle: w.due.settle,
      plusSlug: w.plus, minusSlug: w.minus, dueDate,
    },
  );
}

/** Ručni redak koji izgleda kao naplata (pravilo C) + što bi ga ispravak promijenio. */
export interface SuspectRow {
  id: UUID;
  date: string;
  comment: string;
  /** Vrijednosti `settle` atributa kakve sad jesu (za prikaz). */
  values: SettleCandidate['values'];
  changes: AdoptChange[];
}

/**
 * Pravilo C: prije upisa skupnog retka — postoji li već redak istog iznosa na
 * računu, ma kako opisan? Neuspjelo čitanje BACA (isti razlog kao pravilo B).
 */
export async function findSuspectRows(
  areaId: UUID, w: Widget, basket: string, bankCents: number, bankDate: string,
): Promise<SuspectRow[]> {
  const cfg = w.due.baskets[basket];
  if (!cfg?.text || !w.due.settle || !w.due.done) return [];
  const cands = await loadCandidates(areaId, bankDate);
  return findSuspectSettleRows(cands, {
    account: cfg.account, groupSlug: w.group_by, filters: w.filters ?? [],
    statusSlug: w.due.status_slug, plusSlug: w.plus, minusSlug: w.minus,
    bankCents, bankDate,
  }).map(c => ({
    id: c.id as UUID,
    date: c.event_date.slice(0, 10),
    comment: c.comment ?? '',
    values: c.values,
    changes: adoptChanges(c, { text: cfg.text!, settle: w.due.settle!, statusSlug: w.due.status_slug, done: w.due.done! }),
  }));
}

/** Imena atributa po slugu — za tekst ispravka („Podtip: … → …"). */
export async function attributeNames(areaId: UUID, slugs: string[]): Promise<Record<string, string>> {
  if (slugs.length === 0) return {};
  const { data } = await withRetryQuery(() => supabase
    .from('attribute_definitions')
    .select('slug, name, categories!inner(area_id)')
    .eq('categories.area_id', areaId)
    .in('slug', slugs)
    .order('id'));
  return Object.fromEntries(((data ?? []) as { slug: string; name: string }[]).map(d => [d.slug, d.name]));
}

/**
 * „Da, to je ona": ručni redak postaje skupni redak koji pravilo B prepozna
 * (opis = strojni tekst, `settle` atributi, status `done`). Iznos i račun se
 * ne diraju. Prije upisa se pravilo C pušta PONOVO — redak se mogao
 * promijeniti dok je pitanje stajalo otvoreno.
 *
 * ⚠ Redoslijed: atributi pa opis. Pad između ostavlja redak koji pravilo B
 *   još ne vidi, a pravilo C i dalje vidi ⇒ traka ponovo pita, ne nudi drugi.
 * ⚠ Atributi se pišu pod AUTOROM eventa (S123: Edit isto), `edited_by` = tko
 *   je ispravio. Broji se promijenjeno — RLS-blokiran write „uspije" s 0 (S133).
 */
export async function adoptSettleRow(p: {
  areaId: UUID; w: Widget; basket: string; eventId: UUID; bankCents: number; bankDate: string;
}): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nisi prijavljen.');
  const fresh = (await findSuspectRows(p.areaId, p.w, p.basket, p.bankCents, p.bankDate)).find(s => s.id === p.eventId);
  if (!fresh) throw new Error('Redak se promijenio otkad je traka pitala — osvježi (↻).');

  const { data: ev } = await withRetryQuery(() => supabase
    .from('events').select('id, user_id, category_id').eq('id', p.eventId).single());
  const event = ev as { id: UUID; user_id: UUID; category_id: UUID };
  const attrChanges = fresh.changes.filter(c => c.slug !== null);
  if (attrChanges.length > 0) {
    const { data: defRows } = await withRetryQuery(() => supabase
      .from('attribute_definitions')
      .select('id, slug, data_type, category_id')
      .eq('category_id', event.category_id)
      .in('slug', attrChanges.map(c => c.slug!))
      .order('id'));
    const defs = (defRows ?? []) as { id: UUID; slug: string; data_type: string }[];
    for (const c of attrChanges) {
      const def = defs.find(d => d.slug === c.slug);
      if (!def) throw new Error(`Atribut "${c.slug}" nije na kategoriji retka — ispravi redak ručno (Edit).`);
      const col = VALUE_COLUMNS[def.data_type] || 'value_text';
      const { data: upd, error } = await supabase
        .from('event_attributes')
        .update({ [col]: c.to })
        .eq('event_id', p.eventId)
        .eq('attribute_definition_id', def.id)
        .select('id');
      if (error) throw error;
      if ((upd ?? []).length === 0) {
        const { data: ins, error: insErr } = await supabase
          .from('event_attributes')
          .insert({ event_id: p.eventId, user_id: event.user_id, attribute_definition_id: def.id, [col]: c.to })
          .select('id');
        if (insErr) throw insErr;
        if ((ins ?? []).length === 0) throw new Error(`"${c.slug}" nije upisan (prava?) — redak nije ispravljen do kraja.`);
      }
    }
  }

  const text = p.w.due.baskets[p.basket]?.text;
  const { data: upd, error } = await supabase
    .from('events')
    .update({ comment: text, edited_at: new Date().toISOString(), edited_by: user.id })
    .eq('id', p.eventId)
    .select('id');
  if (error) throw error;
  if ((upd ?? []).length === 0) throw new Error('Opis retka nije promijenjen (prava?) — osvježi (↻).');
  return fresh.changes.length;
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
    .select('id, slug, data_type, category_id, validation_rules')
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

  const all = { ...bySlug, ...derived };
  const attrs: EntryAttr[] = [];
  for (const [slug, value] of Object.entries(all)) {
    const def = findDefBySlug(defs, slug);
    if (!def) throw new Error(`Atribut "${slug}" iz configa ne postoji u kategoriji košare — skupni redak nije upisan.`);
    // ⚠ S157 (T-S157-2): `isplata` ovisi o `smjer` (`depends_on`). Bez roditelja
    //   forma polje NE PRIKAZUJE — iznos je u bazi, a u Editu ga nema. Na PROD-u
    //   svaki redak s iznosom nosi `Smjer` (5.292/5.292); traka je bila prva
    //   koja ga nije upisala. Zato: roditelj mora biti u configu (`due.settle`).
    const parent = (def.validation_rules as { depends_on?: { attribute_slug?: string } } | null)
      ?.depends_on?.attribute_slug;
    if (parent && (all[parent] == null || all[parent] === '')) {
      throw new Error(`"${slug}" ovisi o "${parent}", a config košare (due.settle) ga ne postavlja — `
        + 'redak bi u formi bio bez tog polja. Skupni redak nije upisan.');
    }
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
  /** Pravilo C: čovjek je za svaki sumnjiv redak rekao „to je nešto drugo". */
  suspectsDismissed?: UUID[];
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
    // Brana, ne samo ekran: novi skupni redak uz ručni istog iznosa = saldo dvaput.
    const suspects = await findSuspectRows(p.areaId, p.w, p.basket, p.bankCents, p.bankDate);
    const open = suspects.filter(s => !(p.suspectsDismissed ?? []).includes(s.id));
    if (open.length > 0) {
      throw new Error(`Na računu već postoji isplata istog iznosa (${open[0].date}) — osvježi (↻) i odgovori je li to ova naplata.`);
    }
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
