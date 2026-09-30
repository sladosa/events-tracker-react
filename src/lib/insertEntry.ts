// ============================================================
// insertEntry.ts — upis JEDNOG unosa izvan Add forme (S156)
// ============================================================
// Add Activity je do sada bio jedino mjesto koje stvara event iz aplikacije.
// „Dospjelo → potvrdi" (DOSPJELO_SPEC §5) mora stvoriti skupni `Racun` redak
// iz trake na Overviewu — i to po ISTIM pravilima kao Add:
//
//   • slobodna minuta za `session_start` (S117): `useActivities` grupira po
//     korisnik + kategorija + `session_start`, pa bi dva retka iste minute
//     bila JEDAN redak liste;
//   • P2: svaka roditeljska kategorija dobiva točno jedan event po sesiji
//     (`upsertParentEvent`, `chain_key = leaf`), i kad nema nijedan atribut;
//   • leaf event + njegovi atributi, u stupcu po tipu (`VALUE_COLUMNS`).
//
// ⚠ Zato je to OVDJE, a Add ga zove: kopija ovog bloka u traci bi se prvom
//   izmjenom Add toka razišla — isti razred kao `canUpdateExisting` (S125).
// ============================================================

import { supabase } from '@/lib/supabaseClient';
import { VALUE_COLUMNS } from '@/lib/constants';
import { upsertParentEvent, type ParentAttrWrite } from '@/lib/parentEventLoader';
import type { UUID } from '@/types';

/** Isti oblik kao roditeljski upis (`ParentAttrWrite`) — jedan tip za obje razine. */
export type EntryAttr = ParentAttrWrite;

/** First free minute at or after `desired`, for this user + category + day.
 *
 *  One query, then a scan in memory — the day's rows for a single category are
 *  few. Gives up after an hour of candidates rather than looping: a category
 *  with sixty entries in one hour is a different problem, and a silent infinite
 *  retry would hide it.
 *
 *  ⚠ A failed read THROWS (S156). Read as "nothing taken", it would hand out a
 *    minute that is in fact taken — and two entries would silently merge into
 *    one list row (S121: a failed read is not "nothing there"). */
export async function findFreeSessionStart(
  userId: string, categoryId: string, desired: Date, eventDate: string,
): Promise<string> {
  const dayStart = new Date(`${eventDate}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data, error } = await supabase
    .from('events')
    .select('session_start')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .gte('session_start', dayStart.toISOString())
    .lt('session_start', dayEnd.toISOString());
  if (error) throw error;

  // Compare as instants, not as strings: the DB answers "+00:00" while JS
  // produces ".000Z" for the very same moment (CLAUDE.md, session_start format).
  const taken = new Set((data ?? []).map(r => new Date(r.session_start as string).getTime()));

  const candidate = new Date(desired);
  candidate.setSeconds(0, 0);
  for (let i = 0; i < 60; i++) {
    if (!taken.has(candidate.getTime())) return candidate.toISOString();
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return candidate.toISOString();
}

/** Leaf event + its attribute rows. Returns the new event id. */
export async function insertLeafEvent(p: {
  userId: string;
  leafCategoryId: UUID;
  eventDate: string;
  sessionStartIso: string;
  comment: string | null;
  createdAt: Date;
  attrs: EntryAttr[];
}): Promise<UUID> {
  const { data: leafEvent, error: leafEventError } = await supabase
    .from('events')
    .insert({
      user_id: p.userId,
      category_id: p.leafCategoryId,
      event_date: p.eventDate,
      session_start: p.sessionStartIso,
      comment: p.comment,
      created_at: p.createdAt.toISOString(),
    })
    .select('id')
    .single();
  if (leafEventError) throw leafEventError;
  const id = (leafEvent as { id: UUID }).id;

  if (p.attrs.length > 0) {
    const records = p.attrs.map(attr => ({
      event_id: id,
      user_id: p.userId,
      attribute_definition_id: attr.definitionId,
      [VALUE_COLUMNS[attr.dataType] || 'value_text']: attr.value,
    }));
    const { error: attrError } = await supabase.from('event_attributes').insert(records);
    if (attrError) throw attrError;
  }
  return id;
}

/**
 * Cijeli jedan unos: P2 roditelji pa leaf. Atributi se raspoređuju po
 * kategoriji svoje definicije (`categoryOf`) — roditeljski idu u roditeljski
 * event, kao u Addu (P1: svaka razina smije imati atribute).
 *
 * ⚠ `sessionStartIso` mora već biti slobodna minuta (`findFreeSessionStart`).
 */
export async function insertEntry(p: {
  userId: string;
  leafCategoryId: UUID;
  parentCategoryIds: UUID[];
  eventDate: string;
  sessionStartIso: string;
  comment: string | null;
  attrs: EntryAttr[];
  categoryOf: (definitionId: string) => UUID | undefined;
}): Promise<UUID> {
  for (const parentId of p.parentCategoryIds) {
    const own = p.attrs.filter(a => p.categoryOf(a.definitionId) === parentId);
    await upsertParentEvent(parentId, p.leafCategoryId, p.sessionStartIso, p.eventDate, p.userId, own);
  }
  return insertLeafEvent({
    userId: p.userId,
    leafCategoryId: p.leafCategoryId,
    eventDate: p.eventDate,
    sessionStartIso: p.sessionStartIso,
    comment: p.comment,
    createdAt: new Date(),
    attrs: p.attrs.filter(a => p.categoryOf(a.definitionId) === p.leafCategoryId),
  });
}
