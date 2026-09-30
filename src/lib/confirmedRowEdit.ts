// ============================================================
// confirmedRowEdit.ts — mijenja li Edit BANKIN podatak na potvrđenom retku?
// ============================================================
// C3c (S155, Sašina odluka): Excel put je imao zaštitu (kolona `Potvrda`,
// zasebna kvačica na uvozu, S143), a Edit u aplikaciji nikakvu — a Koka od
// S151 radi upravo kroz Edit, na mobitelu.
//
// DVA ŽIGA, i ne znače isto:
//   · redak — atribut `lock_slug` iz `set_attribute` pravila nije prazan
//     (Financije: `izvod_opis` ⇒ redak je sparen s retkom izvoda);
//   · razdoblje — sidro salda obuhvaća redak (`findCoveringAnchor`, ISTA
//     funkcija kao uvoz — dvije kopije pravila se jednom raziđu).
//
// KOJA SU POLJA „BANKINA" — izvedeno iz configa koji već postoji, bez novog
// ključa: datum retka · `plus`/`minus`/`group_by`/`filters` pločice salda
// (sve što odlučuje ulazi li redak u saldo i s kojim iznosom — dakle i
// `Izvor`, Sašina odluka S155) · target i sam žig svakog zaključanog pravila.
// Sve ostalo (`Tip`, `Podtip`, opis) je NAŠE i mijenja se slobodno —
// na tome počiva reklasifikacija.
//
// ⚠ NE BLOKIRA. Legitiman ispravak postoji (izvod krivo prepisan); traži se
//   samo vlastita potvrda, odvojena od svega drugog — isto načelo kao uvoz.
// ⚠ Račun i datum za sidro čitaju se iz IZVORNOG retka: pitanje je je li
//   potvrđeno ono što već stoji u bazi (isto kao uvoz, S143).
// ============================================================

import type { AreaSettings, WidgetFilter } from '@/types/database';
import { findCoveringAnchor, type AnchorLike, type ConfirmedMark } from '@/lib/confirmedPeriod';
import { localYmd } from '@/lib/localDate';

/** Ključ pod kojim se u usporedbi vodi datum retka (nije slug atributa). */
export const EVENT_DATE_KEY = '@event_date';

export interface BankFieldSpec {
  /** Slugovi čija izmjena na potvrđenom retku traži potvrdu. */
  slugs: string[];
  /** Slugovi žiga (`lock_slug` pravila). */
  lockSlugs: string[];
  /** Po čemu su sidra spremljena (`group_by` pločice); `null` = nema sidara. */
  groupSlug: string | null;
  /**
   * Filtri pločice: koji retci UOPĆE ulaze u saldo. Sidro potvrđuje samo njih.
   * ⚠ S155, izmjereno u T-S155-4: kartični redak (`Izvor = Mastercard`) datiran
   *   prije ZABA sidra dobio je okvir „izmjena ne pomiče saldo, razliku pokazuje
   *   kontrolna točka" — neistina, jer kartični redak saldo nikad ni ne broji.
   *   Upozorenje koje laže nauči se otklikati (S143).
   */
  filters: WidgetFilter[];
}

export function bankFieldSpec(settings: AreaSettings | null | undefined): BankFieldSpec {
  const slugs = new Set<string>();
  const lockSlugs = new Set<string>();
  const widget = settings?.dashboard?.widgets?.find(w => w.type === 'balance_by_group');
  if (widget) {
    if (widget.plus) slugs.add(widget.plus);
    if (widget.minus) slugs.add(widget.minus);
    if (widget.group_by) slugs.add(widget.group_by);
    for (const f of widget.filters ?? []) slugs.add(f.slug);
  }
  for (const r of settings?.automations?.attribute_rules ?? []) {
    if (r.action !== 'set_attribute' || !r.lock_slug) continue;
    lockSlugs.add(r.lock_slug);
    slugs.add(r.lock_slug);
    slugs.add(r.target_slug);
  }
  return {
    slugs: [...slugs], lockSlugs: [...lockSlugs],
    groupSlug: widget?.group_by ?? null, filters: widget?.filters ?? [],
  };
}

export interface RowConfirmation {
  /** Žigovi retka: slug + vrijednost (npr. tekst s izvoda). */
  stamps: { slug: string; value: string }[];
  /** Sidro koje obuhvaća redak, ili `null`. */
  anchor: ConfirmedMark | null;
}

/**
 * Je li redak potvrđen — i čime. `null` = nije.
 * @param original vrijednosti IZVORNOG retka po slugu
 * @param anchors  `null` = sidra nisu učitana (neuspjelo čitanje NIJE „nema
 *                 sidara", S121) — tada se sidro ne tvrdi ni u jednom smjeru
 */
export function rowConfirmation(
  spec: BankFieldSpec,
  original: ReadonlyMap<string, unknown>,
  anchors: readonly AnchorLike[] | null,
  eventDate: string,
): RowConfirmation | null {
  const stamps: { slug: string; value: string }[] = [];
  for (const slug of spec.lockSlugs) {
    const v = original.get(slug);
    if (v != null && String(v).trim() !== '') stamps.push({ slug, value: String(v).trim() });
  }
  const group = spec.groupSlug ? original.get(spec.groupSlug) : null;
  const anchor = anchors && group != null && passesFilters(spec.filters, original)
    ? findCoveringAnchor(anchors, String(group), eventDate)
    : null;
  if (stamps.length === 0 && !anchor) return null;
  return { stamps, anchor };
}

/**
 * Ulazi li redak u saldo — ISTA semantika kao `p_filters` u `sql/035`
 * (`in`: vrijednost je u popisu; `not_in`: nije, uključujući prazno).
 */
export function passesFilters(filters: readonly WidgetFilter[], row: ReadonlyMap<string, unknown>): boolean {
  return filters.every(f => {
    const v = row.get(f.slug);
    const hit = v != null && f.values.includes(String(v));
    return f.op === 'not_in' ? !hit : hit;
  });
}

/**
 * Oblik vrijednosti za usporedbu. Tri izvora iste vrijednosti moraju dati
 * isti niz: baza (`2026-09-20T10:00:00+00:00`, `45.94`), forma
 * (`2026-09-20T12:00`, `45.94` kao broj ili tekst), prazno (`null`/`''`).
 * Datum se uspoređuje po DANU koji čovjek vidi — sat na `Datum naplate` nije
 * podatak (pravilo upisuje podne, uvoz ponoć).
 */
export function canonValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = String(v).trim();
  if (s === '') return '';
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    if (s.length === 10) return s;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? localYmd(d) : s;
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}

export interface FieldChange {
  /** Slug atributa, ili `EVENT_DATE_KEY`. */
  key: string;
  from: string;
  to: string;
}

/** Koja se bankina polja razlikuju između izvornog i sadašnjeg retka. */
export function bankFieldChanges(
  spec: BankFieldSpec,
  before: ReadonlyMap<string, unknown>,
  after: ReadonlyMap<string, unknown>,
  dateBefore: string,
  dateAfter: string,
): FieldChange[] {
  const out: FieldChange[] = [];
  if (dateBefore !== dateAfter) out.push({ key: EVENT_DATE_KEY, from: dateBefore, to: dateAfter });
  for (const slug of spec.slugs) {
    const from = canonValue(before.get(slug));
    const to = canonValue(after.get(slug));
    if (from !== to) out.push({ key: slug, from, to });
  }
  return out;
}

/** Otisak skupa izmjena — potvrda vrijedi SAMO za izmjene koje je čovjek vidio. */
export function changesSignature(changes: readonly { id: string; list: readonly FieldChange[] }[]): string {
  return changes.map(c => c.id + ':' + c.list.map(f => `${f.key}=${f.from}>${f.to}`).join(',')).join('|');
}
