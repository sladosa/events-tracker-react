/**
 * catalogOptions.ts — I/O izbornika iz zapisa druge Aree (S190; model je `catalogPicker.ts`,
 * pravilo `options_from` je `optionsFrom.ts`).
 *
 * Katalog se traži PO IMENU Aree i puta kategorije među Areama koje korisnik smije čitati
 * (RLS: vlastite + podijeljene). Dvije vidljive Aree istog imena ⇒ vlastita pobjeđuje.
 *
 * Keš je po modulu (isto kao `categoryCache`), jer izbornik se otvara iznova za svaki redak
 * treninga. ⚠ Neuspjelo čitanje BACA — prazan izbornik bi izgledao kao „katalog je prazan" (S121).
 */
import { supabase } from '@/lib/supabaseClient';
import { fetchAllPaged, fetchAllPagedIn } from '@/lib/supabasePaging';
import type { AttributeDefinition } from '@/types';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';
import type { OptionsFrom } from '@/lib/optionsFrom';
import { usageFrom, type CatalogItem, type Usage } from '@/lib/catalogPicker';
import { todayLocalYmd } from '@/lib/localDate';

export interface Catalog {
  areaId: string;
  areaName: string;
  categoryId: string;
  defs: AttributeDefinition[];
  items: CatalogItem[];
  /** Redoslijed skupina = popis opcija atributa skupine. */
  groupOrder: string[];
  /** Smije li korisnik uređivati zapise kataloga (vlasnik Aree). */
  canEdit: boolean;
}

type Val = string | number | boolean | null;

const cache = new Map<string, Promise<Catalog>>();
const keyOf = (of: OptionsFrom) => JSON.stringify(of);

function fail(what: string, error: unknown): never {
  const msg = (error as { message?: string })?.message ?? String(error);
  throw new Error(`Katalog: ${what} — ${msg}`);
}

export function loadCatalog(of: OptionsFrom, force = false): Promise<Catalog> {
  const k = keyOf(of);
  if (!force && cache.has(k)) return cache.get(k)!;
  const p = fetchCatalog(of);
  cache.set(k, p);
  p.catch(() => cache.delete(k));                     // pad se ne pamti
  return p;
}

/** Struktura se promijenila (Structure panel/uvoz) ⇒ katalog iznova. Razina MODULA (S133). */
if (typeof window !== 'undefined') {
  window.addEventListener('areas-changed', () => cache.clear());
}

async function fetchCatalog(of: OptionsFrom): Promise<Catalog> {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? null;

  const { data: areas, error: aErr } = await supabase.from('areas').select('id, name, user_id').eq('name', of.area);
  if (aErr) fail('Area', aErr);
  const area = (areas ?? []).find(a => a.user_id === uid) ?? (areas ?? [])[0];
  if (!area) throw new Error(`Katalog: Area „${of.area}" ne postoji ili nije podijeljena s tobom.`);

  const { data: cats, error: cErr } = await supabase
    .from('categories').select('id, name, parent_category_id').eq('area_id', area.id);
  if (cErr) fail('kategorije', cErr);
  let parent: string | null = null;
  let leafId: string | null = null;
  for (const seg of of.category.split('>').map(s => s.trim().toLowerCase())) {
    const hit = (cats ?? []).find(c => c.parent_category_id === parent && c.name.trim().toLowerCase() === seg);
    if (!hit) throw new Error(`Katalog: kategorija „${of.category}" ne postoji u Arei „${of.area}".`);
    parent = hit.id;
    leafId = hit.id;
  }
  const categoryId = leafId!;

  const { data: defs, error: dErr } = await supabase
    .from('attribute_definitions')
    .select('id, user_id, category_id, name, slug, description, data_type, unit, is_required, default_value, validation_rules, sort_order, created_at, updated_at')
    .eq('category_id', categoryId).order('sort_order');
  if (dErr) fail('atributi', dErr);
  const defList = (defs ?? []) as AttributeDefinition[];
  const keyDef = defList.find(d => d.slug === of.attribute);
  if (!keyDef) throw new Error(`Katalog: kategorija „${of.category}" nema atribut „${of.attribute}".`);

  const evRes = await fetchAllPaged<{ id: string; user_id: string }>((from, to) => supabase
    .from('events').select('id, user_id').eq('category_id', categoryId).order('id').range(from, to));
  if (evRes.error) fail('zapisi', evRes.error);
  const eventIds = evRes.data.map(e => e.id);

  const [valRes, phRes] = await Promise.all([
    fetchAllPagedIn<{ id: string; event_id: string; attribute_definition_id: string; value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_datetime: string | null }>(
      eventIds, (chunk, from, to) => supabase.from('event_attributes')
        .select('id, event_id, attribute_definition_id, value_text, value_number, value_boolean, value_datetime')
        .in('event_id', chunk).order('id').range(from, to)),
    fetchAllPagedIn<{ id: string; event_id: string; url: string; filename: string | null }>(
      eventIds, (chunk, from, to) => supabase.from('event_attachments')
        .select('id, event_id, url, filename').in('event_id', chunk).eq('type', 'image').order('id').range(from, to)),
  ]);
  if (valRes.error) fail('vrijednosti', valRes.error);
  if (phRes.error) fail('slike', phRes.error);

  const slugById = new Map(defList.map(d => [d.id, d.slug]));
  const items = new Map<string, CatalogItem>();
  for (const e of evRes.data) {
    items.set(e.id, { eventId: e.id, ownerId: e.user_id, value: '', label: '', group: null, group2: null, values: {}, rowIds: {}, photos: [] });
  }
  for (const r of valRes.data) {
    const it = items.get(r.event_id);
    const slug = slugById.get(r.attribute_definition_id);
    if (!it || !slug) continue;
    it.values[slug] = r.value_text ?? r.value_number ?? r.value_boolean ?? r.value_datetime ?? null;
    it.rowIds[slug] = r.id;
  }
  for (const ph of phRes.data) items.get(ph.event_id)?.photos.push({ id: ph.id, url: ph.url, filename: ph.filename });

  const str = (v: Val | undefined) => (v == null || v === '' ? null : String(v));
  const list = [...items.values()]
    .map(it => ({
      ...it,
      value: str(it.values[of.attribute]) ?? '',
      label: str(of.label ? it.values[of.label] : null) ?? str(it.values[of.attribute]) ?? '',
      group: str(of.group ? it.values[of.group] : null),
      group2: str(of.group2 ? it.values[of.group2] : null),
    }))
    .filter(it => it.value);

  const groupDef = of.group ? defList.find(d => d.slug === of.group) : undefined;
  const groupOrder = groupDef ? parseValidationRules(groupDef.validation_rules).options : [];

  return { areaId: area.id, areaName: area.name, categoryId, defs: defList, items: list, groupOrder, canEdit: area.user_id === uid };
}

/**
 * Korištenje vrijednosti polja `definitionId` kod prijavljenog korisnika u zadnjih 12 mjeseci
 * (broj različitih dana + zadnji dan). Čita samo njegove zapise.
 */
export async function loadUsage(definitionId: string): Promise<Map<string, Usage>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Map();
  const today = todayLocalYmd();
  const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  // `events` je many-to-one ⇒ objekt; tipovi supabase-js ga opisuju kao niz, pa se čita oboje.
  const res = await fetchAllPaged<{ value_text: string | null; events: unknown }>((from, to) => supabase
    .from('event_attributes')
    .select('value_text, events!inner(event_date)')
    .eq('attribute_definition_id', definitionId)
    .eq('user_id', user.id)
    .gte('events.event_date', since)
    .order('id').range(from, to));
  if (res.error) fail('korištenje', res.error);
  const dayOf = (ev: unknown): string => {
    const one = (Array.isArray(ev) ? ev[0] : ev) as { event_date?: string } | null | undefined;
    return one?.event_date ?? '';
  };
  return usageFrom(res.data.map(r => ({ value: r.value_text, day: dayOf(r.events) })).filter(r => r.day));
}

/**
 * Spremi izmjene jednog zapisa kataloga (uređivanje iz kartice). `changes`: slug ⇒ nova vrijednost
 * (null/'' = obriši). Ključni atribut (`of.attribute`) se ovdje NE mijenja — u svakom je zapisu
 * koji ga citira (alat za preuređivanje).
 * ⚠ Svaki upis broji retke: RLS-blokiran upis „uspije" s 0 redaka (S134 `assertWrote`).
 */
export async function saveCatalogItem(
  of: OptionsFrom,
  catalog: Catalog,
  item: CatalogItem,
  changes: Record<string, Val>,
): Promise<void> {
  for (const [slug, raw] of Object.entries(changes)) {
    if (slug === of.attribute) continue;
    const def = catalog.defs.find(d => d.slug === slug);
    if (!def) continue;
    const empty = raw == null || raw === '';
    const col = def.data_type === 'number' ? 'value_number'
      : def.data_type === 'boolean' ? 'value_boolean'
      : def.data_type === 'datetime' ? 'value_datetime' : 'value_text';
    const rowId = item.rowIds[slug];
    let res;
    if (rowId && empty) {
      res = await supabase.from('event_attributes').delete().eq('id', rowId).select('id');
    } else if (rowId) {
      res = await supabase.from('event_attributes').update({ [col]: raw }).eq('id', rowId).select('id');
    } else if (!empty) {
      // Pod AUTOROM zapisa, ne pod onim tko uređuje (isto kao Edit, S123).
      res = await supabase.from('event_attributes')
        .insert({ event_id: item.eventId, user_id: item.ownerId, attribute_definition_id: def.id, [col]: raw })
        .select('id');
    } else continue;
    if (res.error) fail(`spremanje „${def.name}"`, res.error);
    if (!res.data || res.data.length === 0) throw new Error(`Katalog: „${def.name}" nije spremljeno (nemaš pravo pisati u katalog).`);
  }
  cache.delete(keyOf(of));
}
