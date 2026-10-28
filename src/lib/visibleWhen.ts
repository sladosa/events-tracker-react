/**
 * visibleWhen.ts — „polje vidljivo samo uz vrijednost X atributa Y" (S187, korak 2).
 *
 * ZASTO POSTOJI
 *   Model treninga (`TRENING_MIGRACIJA.md` „Dogovor 28.10."): jedan leaf `Gym`, a
 *   `vrsta` odlučuje koja su polja na ekranu (serije samo uz Snagu, sprava uz Z2…).
 *   `depends_on` to već radi za brojeve/boolean/datum, ali za TEKST samo filtrira
 *   opcije — i ne može ovisiti o jednom atributu za izbornik, a o drugom za vidljivost.
 *
 * PRAVILO (`validation_rules.visible_when = { attribute_slug, values }`)
 *   - za svaki tip polja; `values` je POPIS, bez razlike velikih/malih slova;
 *   - Y je na ISTOM eventu ili PRETKU (lanac prema gore), nikad na djetetu —
 *     roditelj ima 1 event po treningu, leaf N; isti slug na dvije razine ⇒ najbliži;
 *   - Y kojeg u lancu nema ⇒ polje se PRIKAZUJE (pokvaren config ne smije sakriti
 *     podatak; uvoz takvo pravilo ionako odbije);
 *   - skriveno pravilom se ne sprema; „Show all" ga ne otkriva (kao `depends_on`).
 *
 * ⚠ OVO JE JEDINO MJESTO S TIM UVJETOM. Zovu ga forma, provjera obaveznih polja,
 *   spremanje u Addu, Structure uvoz i panel. Kopija uvjeta = prilika da se raziđu
 *   (forma sakrije polje, a provjera ga traži — razred `missingRequired`, S131).
 */

export interface VisibleWhen {
  attributeSlug: string;
  values: string[];
}

/** Ono što ova datoteka treba od definicije atributa. */
export interface VisibleWhenDef {
  id: string;
  slug: string;
  validation_rules?: unknown;
}

/** Razina lanca: kategorija i njeni atributi. Lanac ide od LEAFA prema korijenu. */
export interface ChainLevel<D extends VisibleWhenDef = VisibleWhenDef> {
  categoryId: string;
  defs: D[];
}

export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[-_]/g, '_');
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

/** `visible_when` iz SIROVOG pravila (baza). Neispravan oblik ⇒ `null` (nema pravila). */
export function readVisibleWhen(rawRules: unknown): VisibleWhen | null {
  const vw = asObject(asObject(rawRules)?.visible_when);
  if (!vw || typeof vw.attribute_slug !== 'string' || !vw.attribute_slug.trim()) return null;
  const values = Array.isArray(vw.values)
    ? vw.values.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim())
    : [];
  if (values.length === 0) return null;
  return { attributeSlug: vw.attribute_slug.trim(), values };
}

export function visibleWhenToRaw(vw: VisibleWhen): { attribute_slug: string; values: string[] } {
  return { attribute_slug: vw.attributeSlug, values: vw.values };
}

// ---------------------------------------------------------------------------
// Ćelija `VisibleWhen` u Structure Excelu: `vrsta = Cardio | Outdoor`
// ⚠ Pisač i čitač su JEDAN PAR (zamka S186, `:-|`): vrijednosti se dijele na
//   ` | ` S RAZMACIMA, pa vrijednost koja sama nosi `|` bez razmaka preživi.
// ---------------------------------------------------------------------------

export function serializeVisibleWhen(vw: VisibleWhen | null | undefined): string {
  if (!vw) return '';
  return `${vw.attributeSlug} = ${vw.values.join(' | ')}`;
}

export type VisibleWhenCell =
  | { ok: true; value: VisibleWhen | null }
  | { ok: false; error: string };

export function parseVisibleWhenCell(cell: unknown): VisibleWhenCell {
  const text = cell == null ? '' : String(cell).trim();
  if (text === '' || text === '_') return { ok: true, value: null };
  const eq = text.indexOf('=');
  if (eq < 0) return { ok: false, error: `"${text}" — expected "attribute = value | value"` };
  const attributeSlug = text.slice(0, eq).trim();
  const values = text.slice(eq + 1).split(/\s+\|\s+/).map(v => v.trim()).filter(v => v !== '');
  if (!attributeSlug) return { ok: false, error: `"${text}" — attribute missing before "="` };
  if (values.length === 0) return { ok: false, error: `"${text}" — no value after "="` };
  return { ok: true, value: { attributeSlug, values } };
}

// ---------------------------------------------------------------------------
// Procjena
// ---------------------------------------------------------------------------

/** Vrijednost kako je pravilo uspoređuje: boolean ⇒ TRUE/FALSE, prazno ⇒ null. */
export function valueToken(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function matchesVisibleWhen(vw: VisibleWhen, value: unknown): boolean {
  const token = valueToken(value);
  if (token === null) return false;
  const t = token.toUpperCase();
  return vw.values.some(v => v.toUpperCase() === t);
}

/**
 * Atribut Y o kojem `attr` ovisi: prvo na kategoriji samog atributa, pa prema
 * korijenu. Na djetetu se NE traži — ni kad ga lanac ne sadrži, ni kad sadrži.
 */
export function controllingDef<D extends VisibleWhenDef>(
  attr: VisibleWhenDef,
  chain: ChainLevel<D>[],
  vw: VisibleWhen | null = readVisibleWhen(attr.validation_rules),
): D | null {
  if (!vw) return null;
  const start = chain.findIndex(l => l.defs.some(d => d.id === attr.id));
  if (start < 0) return null;
  const want = normalizeSlug(vw.attributeSlug);
  for (let i = start; i < chain.length; i++) {
    const hit = chain[i].defs.find(d => d.id !== attr.id && normalizeSlug(d.slug) === want);
    if (hit) return hit;
  }
  return null;
}

/** Skriva li pravilo polje uz trenutne vrijednosti. Bez pravila / bez Y ⇒ `false`. */
export function isHiddenByRule(
  attr: VisibleWhenDef,
  chain: ChainLevel[],
  valueOf: (definitionId: string) => unknown,
): boolean {
  const vw = readVisibleWhen(attr.validation_rules);
  if (!vw) return false;
  const ctrl = controllingDef(attr, chain, vw);
  if (!ctrl) return false;
  return !matchesVisibleWhen(vw, valueOf(ctrl.id));
}

/** Svi atributi lanca koje pravilo trenutno skriva. */
export function ruleHiddenIds(
  chain: ChainLevel[],
  valueOf: (definitionId: string) => unknown,
): Set<string> {
  const out = new Set<string>();
  for (const level of chain) {
    for (const d of level.defs) if (isHiddenByRule(d, chain, valueOf)) out.add(d.id);
  }
  return out;
}

/**
 * Polja koja promjena `changedId` na `newValue` SKRIJE, a imaju vrijednost — njih
 * forma isprazni (skriveno se ne sprema). Ide i dalje niz lanac: ispražnjeno polje
 * koje je samo Y nekom trećem skrije i njega.
 *
 * Okidač je ČOVJEKOV POTEZ (razred S127): forma ovo zove samo iz promjene polja,
 * nikad pri otvaranju retka — inače bi samo otvaranje starog retka obrisalo podatak.
 *
 * ⚠ Prazni se samo polje koje je BILO NA EKRANU (`wasShown`), a promjena ga je
 *   skrila. Polje skriveno od prije (npr. `sprava` s defaultom `orb` dok vrsta nije
 *   izabrana) zadržava vrijednost — inače bi Snaga obrisala default, a Z2 poslije
 *   pokazao prazno polje (izmjereno E2E S187). Ne sprema se ionako: Add filtrira
 *   skriveno pri spremanju (`ruleHiddenIds`). Zadano: vidljivost po pravilu prije
 *   promjene; Edit forma dodaje „izvan pravila" (vrijednost iz baze je na ekranu).
 */
export function fieldsToClear(
  changedId: string,
  newValue: unknown,
  chain: ChainLevel[],
  valueOf: (definitionId: string) => unknown,
  wasShown: (def: VisibleWhenDef) => boolean = d => !isHiddenByRule(d, chain, valueOf),
): string[] {
  const overrides = new Map<string, unknown>([[changedId, newValue]]);
  const read = (id: string) => (overrides.has(id) ? overrides.get(id) : valueOf(id));
  const cleared: string[] = [];
  const queue = [changedId];
  while (queue.length > 0) {
    const yId = queue.shift()!;
    for (const level of chain) {
      for (const d of level.defs) {
        if (overrides.has(d.id)) continue;
        const ctrl = controllingDef(d, chain);
        if (!ctrl || ctrl.id !== yId) continue;
        if (!isHiddenByRule(d, chain, read)) continue;
        if (!wasShown(d)) continue;                        // skriveno od prije: zadrži
        if (valueToken(read(d.id)) === null) continue;   // prazno nema što izgubiti
        overrides.set(d.id, null);
        cleared.push(d.id);
        queue.push(d.id);
      }
    }
  }
  return cleared;
}
