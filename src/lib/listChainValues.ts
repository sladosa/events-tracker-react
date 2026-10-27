/**
 * listChainValues.ts — vrijednosti kolona liste iz CIJELOG lanca retka (S186).
 *
 * ZAŠTO
 *   Lista ima jedan redak po LEAF sesiji, a kolona `attr` je vrijednost tražila
 *   samo na leaf eventima. Atribut roditeljske razine (P1: `Fitness_Garmin >
 *   Activity.mood`, `duration`, `kcal`) živi na P2 roditeljskom eventu, pa je
 *   kolona uvijek pisala `—` — iako ga View istog retka pokazuje (T-S185-2,
 *   izmjereno 27.10.2026.: View `mood` 4, lista `—`). Financije to nisu mogle
 *   pokazati: leaf im je na L1, roditelja nema.
 *
 * IDENTITET RODITELJA — isti kao `parentEventLoader.loadParentAttrs` (View/Edit)
 *   isti korisnik + isti `session_start` + kategorija je PREDAK leafa, i
 *   1. `chain_key = leaf` (od migracije 004), ili
 *   2. `chain_key IS NULL` i TOČNO JEDAN takav kandidat za tu kategoriju
 *      (stari zapisi; PROD `Fitness` ih ima 6 od 182, backup 22.10.).
 *   Lista koja bi ih preskočila pokazala bi `—` gdje View pokazuje vrijednost.
 *
 * KOJA RAZINA POBJEĐUJE
 *   Leaf, pa najbliži roditelj, pa dalje prema korijenu. Slug koji je jedna
 *   razina dala, viša razina više ne dira.
 *   ⚠ Roditeljski broj se NE ZBRAJA: na leafu se zbraja preko N eventa sesije
 *   (`pair`, iznos), a roditelj je jedan po sesiji — uzima se jednom. Zbroj
 *   preko razina bi `duration` na `Activity` i na leafu brojao dvaput.
 *
 * Čisto ⇒ testirano bez baze (`listChainValues.test.mjs`).
 */

export interface ChainRowValues {
  /** slug → first non-empty text value. */
  text: Map<string, string>;
  /** slug → numeric value (summed across the LEAF events of the session only). */
  num: Map<string, number>;
}

export interface ListAttrRow {
  event_id: string;
  attribute_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_datetime: string | null;
  value_boolean: boolean | null;
}

export interface ParentCandidate {
  id: string;
  category_id: string;
  chain_key: string | null;
  user_id: string;
  session_start: string | null;
}

export interface ListRowRef {
  sessionKey: string;
  /** Leaf category of the row. */
  category_id: string;
  user_id: string;
  /** DB format — compared as a string with the parent's, both come from the DB. */
  session_start: string | null;
}

/**
 * Za svaki redak: id-jevi roditeljskih eventa, NAJBLIŽI PRVI.
 * `ancestorsOf(leaf)` vraća pretke bez samog leafa, najbliži prvi
 * (`categoryTree.ancestorIds(map, leaf).slice(1)`).
 */
export function matchParentEvents(
  rows: ListRowRef[],
  parents: ParentCandidate[],
  ancestorsOf: (leafId: string) => string[],
): Map<string, string[]> {
  // user + session_start + category → kandidati
  const idx = new Map<string, ParentCandidate[]>();
  for (const p of parents) {
    if (!p.session_start) continue;
    const k = `${p.user_id}|${p.session_start}|${p.category_id}`;
    const arr = idx.get(k);
    if (arr) arr.push(p); else idx.set(k, [p]);
  }

  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.session_start) continue;
    const ids: string[] = [];
    for (const catId of ancestorsOf(r.category_id)) {
      const cands = idx.get(`${r.user_id}|${r.session_start}|${catId}`) ?? [];
      const chained = cands.find(c => c.chain_key === r.category_id);
      if (chained) { ids.push(chained.id); continue; }
      const legacy = cands.filter(c => c.chain_key == null);
      if (legacy.length === 1) ids.push(legacy[0].id);
    }
    if (ids.length) out.set(r.sessionKey, ids);
  }
  return out;
}

function displayText(a: ListAttrRow): string | null {
  return a.value_text
    ?? (a.value_datetime ? a.value_datetime.slice(0, 10) : null)
    ?? (a.value_boolean != null ? (a.value_boolean ? 'DA' : 'NE') : null)
    ?? (a.value_number != null ? String(a.value_number) : null);
}

/**
 * Vrijednosti jednog retka. `levels[0]` = leaf eventi sesije, zatim po jedan
 * roditeljski event po razini, najbliži prvi.
 */
export function combineChainValues(
  levels: string[][],
  perEvent: Map<string, ListAttrRow[]>,
  slugById: Map<string, string>,
): ChainRowValues {
  const text = new Map<string, string>();
  const num = new Map<string, number>();

  levels.forEach((eventIds, depth) => {
    // Slugovi koje je dala bliža razina — ova ih ne dira.
    const taken = new Set<string>([...text.keys(), ...num.keys()]);
    for (const id of eventIds) {
      for (const a of perEvent.get(id) ?? []) {
        const slug = slugById.get(a.attribute_definition_id);
        if (!slug || taken.has(slug)) continue;

        if (a.value_number != null) {
          const n = Number(a.value_number);
          // Leaf: zbroj preko eventa sesije. Roditelj: jedan event, uzima se jednom.
          num.set(slug, depth === 0 ? (num.get(slug) ?? 0) + n : (num.get(slug) ?? n));
        }
        // First non-empty wins for display. The list is one row per session,
        // so a second differing value would not fit the cell anyway.
        if (!text.has(slug)) {
          const t = displayText(a);
          if (t != null && t !== '') text.set(slug, t);
        }
      }
    }
  });

  return { text, num };
}
