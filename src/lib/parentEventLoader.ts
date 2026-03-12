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
import type { UUID } from '@/types';

// ─── Javni tipovi ─────────────────────────────────────────────────────────────

export interface ParentAttrValue {
  value: string | number | boolean | null;
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
  const parentChainIds: UUID[] = [];
  let currentId: UUID | null = null;

  const { data: leafCat } = await supabase
    .from('categories')
    .select('parent_category_id')
    .eq('id', leafCategoryId)
    .single() as { data: { parent_category_id: string | null } | null };

  currentId = (leafCat?.parent_category_id as UUID | null) ?? null;

  while (currentId) {
    parentChainIds.push(currentId);
    const { data: parentCat } = await supabase
      .from('categories')
      .select('parent_category_id')
      .eq('id', currentId)
      .single() as { data: { parent_category_id: string | null } | null };
    currentId = (parentCat?.parent_category_id as UUID | null) ?? null;
  }

  return parentChainIds;
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

  for (const catId of parentChainIds) {

    // ── Korak 1: Primary — chain_key marker (sistemski field, migration 004) ──
    const { data: byChainKey } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('category_id', catId)
      .eq('session_start', sessionStart)   // DB format — kritično!
      .eq('chain_key', leafCategoryId)
      .limit(1);

    let parentEventId: UUID | null = null;

    if (byChainKey && byChainKey.length > 0) {
      parentEventId = (byChainKey[0] as { id: UUID }).id;
    } else {
      // ── Korak 2: Fallback — legacy data (chain_key IS NULL) ───────────────
      // Pre-migration eventos nemaju chain_key.
      // Sigurno je uzeti jedini kandidat (length === 1).
      const { data: legacy } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .eq('category_id', catId)
        .eq('session_start', sessionStart)
        .is('chain_key', null);

      if (legacy && legacy.length === 1) {
        parentEventId = (legacy[0] as { id: UUID }).id;
      }
      // length > 1: više kandidata bez markera → ne možemo sigurno disambiguirati
    }

    if (!parentEventId) continue;

    // ── Korak 3: Učitaj atribute ──────────────────────────────────────────────
    const { data: attrs } = await supabase
      .from('event_attributes')
      .select('id, attribute_definition_id, value_text, value_number, value_datetime, value_boolean, attribute_definitions(id, name, data_type, category_id)')
      .eq('event_id', parentEventId);

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
  }

  return result;
}
