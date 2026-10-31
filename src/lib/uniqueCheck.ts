/**
 * uniqueCheck.ts — I/O za pravilo `unique` (S190; pravilo i čiste funkcije su u `uniqueValue.ts`).
 *
 * Dva pitanja, dva upita:
 *   - pri SPREMANJU (Add Finish, Edit Save): postoji li vrijednost već u kategoriji — upit u
 *     bazu tog trena, ne keš forme (drugi korisnik ili druga kartica je mogla upisati isto);
 *   - dok čovjek TIPKA: popis postojećih zapisa za „slično u katalogu" (`loadUniqueRecords`).
 *
 * ⚠ Neuspjelo čitanje NIJE „nema duplikata" (razred S121): `findUniqueConflicts` baca, pa
 *   pozivatelj javlja grešku umjesto da tiho spremi duplikat.
 */
import { supabase } from '@/lib/supabaseClient';
import { fetchAllPaged } from '@/lib/supabasePaging';
import type { AttributeDefinition } from '@/types';
import { readUnique, uniqueKey, type UniqueRecord } from '@/lib/uniqueValue';

/** `%`, `_` i `\` su u ILIKE posebni — slug `pull_m` bi inače pogodio i `pullxm`. */
function likeLiteral(v: string): string {
  return v.replace(/[\\%_]/g, ch => '\\' + ch);
}

/**
 * Poruke za vrijednosti koje već postoje u istoj kategoriji. Prazno = sve je u redu.
 * `ownEventIds` = zapisi koji se upravo uređuju (Edit) — oni ne smiju biti sami sebi duplikat.
 */
export async function findUniqueConflicts(
  defs: AttributeDefinition[],
  valueOf: (definitionId: string) => unknown,
  ownEventIds: string[] = [],
): Promise<string[]> {
  const out: string[] = [];
  for (const d of defs) {
    if (!readUnique(d.validation_rules)) continue;
    const v = valueOf(d.id);
    const key = uniqueKey(v);
    if (!key) continue;
    const { data, error } = await supabase
      .from('event_attributes')
      .select('event_id')
      .eq('attribute_definition_id', d.id)
      .ilike('value_text', likeLiteral(String(v).trim()))
      .limit(5);
    if (error) throw new Error(`Provjera jedinstvenosti (${d.name}) nije uspjela: ${error.message}`);
    const others = (data ?? []).filter(r => !ownEventIds.includes(r.event_id as string));
    if (others.length > 0) out.push(`${d.name} „${String(v).trim()}" već postoji — izaberi drugu vrijednost.`);
  }
  return out;
}

/**
 * Svi zapisi kategorije s vrijednošću jedinstvenog atributa i ostalim tekstom (ime, skupina…).
 * Samo atributi te kategorije, samo tekst — za katalog od ~60 zapisa to je par stotina redaka.
 */
export async function loadUniqueRecords(
  uniqueDef: AttributeDefinition,
  textDefs: AttributeDefinition[],
): Promise<UniqueRecord[]> {
  const ids = [uniqueDef.id, ...textDefs.filter(d => d.id !== uniqueDef.id).map(d => d.id)];
  const { data, error } = await fetchAllPaged<{ event_id: string; attribute_definition_id: string; value_text: string | null }>(
    (from, to) => supabase
      .from('event_attributes')
      .select('event_id, attribute_definition_id, value_text')
      .in('attribute_definition_id', ids)
      .not('value_text', 'is', null)
      .order('id')
      .range(from, to),
  );
  if (error) throw error instanceof Error ? error : new Error(String((error as { message?: string }).message ?? error));
  const byEvent = new Map<string, UniqueRecord>();
  for (const r of data) {
    const rec = byEvent.get(r.event_id) ?? { eventId: r.event_id, key: '', texts: [] };
    if (r.attribute_definition_id === uniqueDef.id) rec.key = r.value_text ?? '';
    else if (r.value_text) rec.texts.push(r.value_text);
    byEvent.set(r.event_id, rec);
  }
  return [...byEvent.values()].filter(r => r.key);
}
