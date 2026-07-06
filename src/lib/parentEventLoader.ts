/**
 * parentEventLoader.ts
 * =====================
 * Shared service za učitavanje atributa parent evenata (Activity, Gym itd.)
 * za dani leaf event. Koriste ga ViewDetailsPage i EditActivityPage.
 *
 * ZAŠTO SHARED SERVICE:
 *   Jedan servis = jedan izvor istine za parent event logiku.
 *   Sve stranice (View, Edit, Add) pišu chain_key, ovaj servis ga čita.
 *
 * DISAMBIGUATION ALGORITAM (BUG-G fix v2):
 *   1. Primary:  chain_key = leafCategoryId  (migration 004 — čist sistemski field)
 *   2. Fallback: chain_key IS NULL + samo 1 kandidat (legacy / predmigracijsko)
 *
 * chain_key vs comment:
 *   chain_key = SISTEMSKI UUID, nikad prikazati korisniku
 *   comment   = KORISNIČKA bilješka, slobodan tekst
 *
 * KRITIČNO — sessionStart format:
 *   Uvijek prosljeđuj session_start DIREKTNO IZ BAZE (events[0].session_start),
 *   NE iz URL decode. URL format (.000Z) i Supabase format (+00:00) ne matchiraju
 *   pouzdano u eq() filterima. DB format garantira match.
 */

import { supabase } from '@/lib/supabaseClient';
import { VALUE_COLUMNS } from '@/lib/constants';
import { getCategoryMap } from '@/lib/categoryCache';
import type { UUID } from '@/types';

// ─── Javni tipovi ─────────────────────────────────────────────────────────────

export interface ParentAttrValue {
  value: string | number | boolean | null;
  dataType: string;
}

/** Jedan atribut za upsertParentEvent() — definitionId + vrijednost + tip (za value column mapping). */
export interface ParentAttrWrite {
  definitionId: string;
  value: string | number | boolean | null | undefined;
  dataType: string;
}

/** attrDefinitionId → { value, dataType } */
export type ParentAttrMap = Map<string, ParentAttrValue>;

// ─── Interni tip za Supabase join ─────────────────────────────────────────────

interface RawAttrRow {
  id: string;
  attribute_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
  attribute_definitions: {
    id: string;
    name: string;
    data_type: string;
    category_id: string;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Gradi listu parent category ID-ova od leaf-a prema root-u (bez leafa).
 * Vraća niz npr. [gymUUID, activityUUID].
 */
export async function buildParentChainIds(leafCategoryId: UUID): Promise<UUID[]> {
  const catMap = await getCategoryMap();
  const parentChainIds: UUID[] = [];
  let currentId: UUID | null = catMap.get(leafCategoryId)?.parent_category_id ?? null;

  while (currentId && parentChainIds.length < 15) { // max level je 10 — guard protiv ciklusa
    parentChainIds.push(currentId);
    currentId = catMap.get(currentId)?.parent_category_id ?? null;
  }

  return parentChainIds;
}

/**
 * Nalazi DB event ID parent eventa za jednu kategoriju/razinu, za dani lanac (leaf) i sesiju.
 * Single source of truth za disambiguation algoritam (BUG-G fix v2) — koriste ga
 * loadParentAttrs, upsertParentEvent, excelImport.ts i EditActivityPage load path.
 *
 *   1. Primary:  chain_key = leafCategoryId  (migration 004 — čist sistemski field)
 *   2. Fallback: chain_key IS NULL + samo 1 kandidat (legacy / predmigracijsko)
 *
 * @param categoryId      - category_id parent razine koju tražimo
 * @param sessionStart    - session_start DIREKTNO IZ BAZE (ne URL-decode!)
 * @param leafCategoryId  - category_id leaf eventa (chain_key marker)
 * @param userId          - user_id
 */
export async function findParentEventByChain(
  categoryId: UUID,
  sessionStart: string,
  leafCategoryId: UUID,
  userId: string
): Promise<UUID | null> {
  // ── Korak 1: Primary — chain_key marker (sistemski field, migration 004) ──
  const { data: byChainKey } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('session_start', sessionStart)   // DB format — kritično!
    .eq('chain_key', leafCategoryId)
    .limit(1);

  if (byChainKey && byChainKey.length > 0) {
    return (byChainKey[0] as { id: UUID }).id;
  }

  // ── Korak 2: Fallback — legacy data (chain_key IS NULL) ───────────────────
  // Pre-migration eventi nemaju chain_key. Sigurno je uzeti jedini kandidat (length === 1).
  const { data: legacy } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('session_start', sessionStart)
    .is('chain_key', null);

  if (legacy && legacy.length === 1) {
    return (legacy[0] as { id: UUID }).id;
  }

  // length > 1: više kandidata bez markera → ne možemo sigurno disambiguirati
  return null;
}

/**
 * Piše (upsert) 1 parent event za jednu kategoriju/razinu, za dani lanac i sesiju.
 * Single source of truth za parent-event write logiku (S104 unifikacija — Fable I.2,
 * vidi docs/FABLE_PLAN.md). Koriste ga AddActivityPage, EditActivityPage i excelImport.ts
 * (create + update tok) — bila su 4 odvojena copy-paste mjesta prije ovog refaktora.
 *
 * Ponašanje (hibrid odabran u S104):
 *   - P2 anchor: parent event UVIJEK se kreira ako ne postoji, čak i s 0 atributa —
 *     bez toga chain_key veza ne postoji i drugi flowovi ne mogu locirati lanac.
 *   - P3 attribute write: per-attribute upsert (update ako postoji, insert ako ne);
 *     prazne vrijednosti se PRESKAČU i nikad ne brišu postojeću ne-praznu vrijednost
 *     (nema delete-all-then-reinsert — to je bio EditActivityPage P3 gap prije fixa).
 *
 * @returns event ID postojećeg ili novokreiranog parent eventa
 */
export async function upsertParentEvent(
  categoryId: UUID,
  leafCategoryId: UUID,
  sessionISO: string,
  eventDate: string,
  userId: string,
  attrs: ParentAttrWrite[]
): Promise<UUID> {
  const nonEmptyAttrs = attrs.filter(a => a.value != null && a.value !== '');

  const existingId = await findParentEventByChain(categoryId, sessionISO, leafCategoryId, userId);

  if (existingId) {
    // Header polja moraju ostati u sync-u (Edit flow može pomaknuti session_start).
    // Idempotentno za pozivatelje koji ne mijenjaju vrijeme (Import) — no-op update.
    const { error: updateError } = await supabase
      .from('events')
      .update({ event_date: eventDate, session_start: sessionISO, edited_at: new Date().toISOString() })
      .eq('id', existingId);
    if (updateError) throw updateError;

    if (nonEmptyAttrs.length > 0) {
      const { data: existingAttrRows } = await supabase
        .from('event_attributes')
        .select('id, attribute_definition_id')
        .eq('event_id', existingId);

      const existingMap = new Map<string, string>(
        ((existingAttrRows ?? []) as { id: string; attribute_definition_id: string }[])
          .map(r => [r.attribute_definition_id, r.id])
      );

      for (const attr of nonEmptyAttrs) {
        const valueColumn = VALUE_COLUMNS[attr.dataType] || 'value_text';
        const record = {
          event_id: existingId,
          user_id: userId,
          attribute_definition_id: attr.definitionId,
          [valueColumn]: attr.value,
        };

        if (existingMap.has(attr.definitionId)) {
          const { error } = await supabase
            .from('event_attributes')
            .update(record)
            .eq('id', existingMap.get(attr.definitionId)!)
            .eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('event_attributes').insert(record);
          if (error) throw error;
        }
      }
    }

    return existingId;
  }

  // Nema postojećeg parent eventa za ovaj lanac — INSERT novi (P2 anchor, čak i s 0 atributa).
  const { data: newParent, error: insertError } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      category_id: categoryId,
      event_date: eventDate,
      session_start: sessionISO,
      chain_key: leafCategoryId,
      created_at: sessionISO,
    })
    .select('id')
    .single();

  if (insertError || !newParent) throw insertError ?? new Error('Parent event insert failed');

  const parentId = (newParent as { id: UUID }).id;

  if (nonEmptyAttrs.length > 0) {
    const records = nonEmptyAttrs.map(attr => {
      const valueColumn = VALUE_COLUMNS[attr.dataType] || 'value_text';
      return {
        event_id: parentId,
        user_id: userId,
        attribute_definition_id: attr.definitionId,
        [valueColumn]: attr.value,
      };
    });
    const { error: attrError } = await supabase.from('event_attributes').insert(records);
    if (attrError) throw attrError;
  }

  return parentId;
}

/**
 * Učitava atribute parent evenata za danu leaf sesiju.
 *
 * @param leafCategoryId  - category_id leaf eventa (chain_key marker)
 * @param sessionStart    - session_start DIREKTNO IZ BAZE (ne URL-decode!)
 * @param userId          - user_id
 * @returns Map<attrDefinitionId, {value, dataType}>
 */
export async function loadParentAttrs(
  leafCategoryId: UUID,
  sessionStart: string,
  userId: string
): Promise<ParentAttrMap> {
  const result: ParentAttrMap = new Map();

  const parentChainIds = await buildParentChainIds(leafCategoryId);
  if (parentChainIds.length === 0) return result;

  // ── Batch lookup parent evenata: 1 upit za sve razine (umjesto 1-2 po razini) ──
  // Isti disambiguation algoritam kao findParentEventByChain, samo batched:
  //   1. Primary:  chain_key = leafCategoryId
  //   2. Fallback: chain_key IS NULL + točno 1 kandidat po kategoriji (legacy)
  const { data: primary } = await supabase
    .from('events')
    .select('id, category_id')
    .eq('user_id', userId)
    .in('category_id', parentChainIds)
    .eq('session_start', sessionStart)   // DB format — kritično!
    .eq('chain_key', leafCategoryId);

  const eventIdByCategory = new Map<string, UUID>();
  for (const row of (primary ?? []) as { id: UUID; category_id: string }[]) {
    if (!eventIdByCategory.has(row.category_id)) eventIdByCategory.set(row.category_id, row.id);
  }

  const missingCatIds = parentChainIds.filter(id => !eventIdByCategory.has(id));
  if (missingCatIds.length > 0) {
    const { data: legacy } = await supabase
      .from('events')
      .select('id, category_id')
      .eq('user_id', userId)
      .in('category_id', missingCatIds)
      .eq('session_start', sessionStart)
      .is('chain_key', null);

    const candidates = new Map<string, UUID[]>();
    for (const row of (legacy ?? []) as { id: UUID; category_id: string }[]) {
      const list = candidates.get(row.category_id) || [];
      list.push(row.id);
      candidates.set(row.category_id, list);
    }
    // >1 kandidata bez markera → ne možemo sigurno disambiguirati, preskačemo razinu
    for (const [catId, ids] of candidates) {
      if (ids.length === 1) eventIdByCategory.set(catId, ids[0]);
    }
  }

  const parentEventIds = [...eventIdByCategory.values()];
  if (parentEventIds.length === 0) return result;

  // ── Učitaj atribute svih parent evenata odjednom ──────────────────────────
  // Jedan parent event po kategoriji + attr defs pripadaju točno jednoj kategoriji,
  // pa flat merge po attribute_definition_id ne može kolidirati.
  const { data: attrs } = await supabase
    .from('event_attributes')
    .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
    .in('event_id', parentEventIds);

  for (const raw of (attrs || []) as unknown as RawAttrRow[]) {
    if (!raw.attribute_definitions) continue;
    const { data_type } = raw.attribute_definitions;
    let value: string | number | boolean | null = null;

    if (data_type === 'number'   && raw.value_number   !== null) value = raw.value_number;
    else if (data_type === 'boolean'  && raw.value_boolean  !== null) value = raw.value_boolean;
    else if (data_type === 'datetime' && raw.value_datetime !== null) value = raw.value_datetime;
    else if (raw.value_text !== null) value = raw.value_text;

    if (value !== null) {
      result.set(raw.attribute_definition_id, { value, dataType: data_type });
    }
  }

  return result;
}
