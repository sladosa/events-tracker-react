/**
 * uniqueValue.ts — pravilo „vrijednost atributa je jedinstvena u kategoriji" (S190, katalog vježbi).
 *
 * `validation_rules.unique`:
 *   true            — dva zapisa iste kategorije ne smiju imati istu vrijednost
 *   { from: 'name' } — isto, i forma PREDLAŽE vrijednost iz atributa `name` dok je čovjek ne promijeni
 *
 * ZAŠTO
 *   Slug vježbe je trajni ključ: trening pamti slug, ne ime. Baza (EAV) jedinstvenost ne može
 *   jamčiti, pa je čuvaju forma (Add/Edit Save) i Excel uvoz — oba kroz ovaj file.
 *   Usporedba je bez razlike velikih/malih slova i razmaka na rubovima: `Pull_m` i `pull_m`
 *   u katalogu bi bili dvije vježbe koje čovjek ne razlikuje.
 *
 * Structure Excel: kolona `Unique` — prazno | TRUE | `from: <slug>`. Nema kolone ⇒ baza ostaje.
 */

export interface UniqueRule {
  /** Slug atributa iz kojeg se predlaže vrijednost (npr. `name`), ili null. */
  from: string | null;
}

export function readUnique(raw: unknown): UniqueRule | null {
  const rules = asObject(raw);
  const u = rules?.unique;
  if (u === true) return { from: null };
  if (u && typeof u === 'object' && !Array.isArray(u)) {
    const from = (u as Record<string, unknown>).from;
    return { from: typeof from === 'string' && from.trim() ? from.trim() : null };
  }
  return null;
}

export function uniqueToRaw(u: UniqueRule): true | { from: string } {
  return u.from ? { from: u.from } : true;
}

export function serializeUnique(u: UniqueRule | null): string {
  if (!u) return '';
  return u.from ? `from: ${u.from}` : 'TRUE';
}

export type UniqueCell = { ok: true; value: UniqueRule | null } | { ok: false; error: string };

/** Ćelija `Unique`: prazno / FALSE ⇒ nema pravila; TRUE ⇒ jedinstveno; `from: name` ⇒ i prijedlog. */
export function parseUniqueCell(cell: string): UniqueCell {
  const s = cell.trim();
  if (!s || s.toUpperCase() === 'FALSE') return { ok: true, value: null };
  if (s.toUpperCase() === 'TRUE') return { ok: true, value: { from: null } };
  const m = /^from\s*:?\s*([A-Za-z0-9_-]+)$/i.exec(s);
  if (m) return { ok: true, value: { from: m[1].toLowerCase() } };
  return { ok: false, error: `"${s}" is not TRUE, FALSE or "from: <attribute slug>"` };
}

/** Ključ za usporedbu duplikata. */
export function uniqueKey(v: unknown): string {
  return v == null ? '' : String(v).trim().toLowerCase();
}

/** Bez kvačica i velikih slova: `Čučanj` ⇒ `cucanj`. */
export function foldText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/**
 * Prijedlog vrijednosti iz teksta: prve dvije riječi bez zagrada i kvačica, spojene `_`,
 * najviše 16 znakova (`Hand lateral raises` ⇒ `hand_lateral`). Samo prijedlog — čovjek ga mijenja.
 */
export function proposeKey(text: string): string {
  const words = foldText(text.replace(/\(.*?\)/g, ' ')).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join('_').slice(0, 16).replace(/_+$/, '');
}

export interface UniqueRecord {
  eventId: string;
  /** Vrijednost jedinstvenog atributa. */
  key: string;
  /** Ostale tekstualne vrijednosti zapisa (ime, skupina…) — za prikaz i sličnost. */
  texts: string[];
}

const tokens = (s: string) => foldText(s).split(/[^a-z0-9]+/).filter(t => t.length >= 4);

/**
 * Postojeći zapisi SLIČNI onome što čovjek upisuje (bilo koje tekstualno polje forme).
 * Riječ ≥ 4 slova kojoj se prvih 5 slova poklapa s početkom riječi zapisa, ili upisani ključ
 * sadržan u ključu zapisa. Svrha: vidjeti postoji li vježba već, prije nego nastane druga.
 */
export function similarRecords(
  typed: string[],
  typedKey: string,
  records: UniqueRecord[],
  ownEventId: string | null,
  max = 5,
): UniqueRecord[] {
  const want = typed.flatMap(tokens);
  const k = uniqueKey(typedKey);
  return records.filter(r => {
    if (r.eventId === ownEventId) return false;
    if (k && uniqueKey(r.key) === k) return false;          // točan duplikat se javlja zasebno
    const have = [r.key.replace(/_/g, ' '), ...r.texts].flatMap(tokens);
    return want.some(t => have.some(x => x.startsWith(t.slice(0, 5)) || t.startsWith(x.slice(0, 5))))
      || (k.length >= 3 && uniqueKey(r.key).includes(k));
  }).slice(0, max);
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}
