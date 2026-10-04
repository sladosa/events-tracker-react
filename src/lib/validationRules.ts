/**
 * validationRules.ts — JEDAN graditelj `attribute_definitions.validation_rules` (S152).
 *
 * ZASTO POSTOJI
 *   Pravila je pisalo CETIRI mjesta, svako u svom obliku:
 *     Structure uvoz  -> {type, depends_on}
 *     Panel           -> {type, suggest: [], allow_other: true, depends_on}
 *     Add/Edit „Other" -> gradilo IZ NULE, iz parsiranog oblika
 *   Posljedice (BUG-S117-RULESHAPE i dva nalaza iz S152):
 *   (1) Svaki uvoz nakon spremanja panela javljao je „Attributes updated 9"
 *       bez ijedne promjene -- brojac koji je jedini signal je li uvoz nesto
 *       dirnuo pokazivao je sum.
 *   (2) /!\ „Other" put je BRISAO sve sto nije popis opcija: `default_map`
 *       (`Status`: Mastercard -> Planiran) i `hidden_in_add` (`Stanje`,
 *       `Valuta`). Jedan upis nove vrijednosti kroz „Other" pod vlasnikom
 *       Aree bio bi dovoljan.
 *   (3) /!\ Rename fixup u panelu je sirio PARSIRANI objekt (`optionsMap`,
 *       camelCase) umjesto sirovog, pa bi ovisni atribut na drugom cvoru ostao
 *       bez `options_map`.
 *
 * KANONSKI OBLIK
 *   depends_on: { type:'suggest', depends_on:{ attribute_slug, options_map, default_map? } }
 *   suggest:    { type:'suggest', suggest:[...], max? }
 *   ostalo:     {}
 *   + `hidden_in_add: true` ortogonalno, na bilo kojem od njih.
 *   `allow_other` se ne pise: odsutnost = true (`parseValidationRules`).
 *   Top-level `suggest` uz `depends_on` („Default options" u panelu) se vise ne
 *   pise: izvoz ga nikad nije nosio, pa ga je prvi roundtrip brisao; redak
 *   `WhenValue = *` radi isto i putuje Excelom. Izmjereno S152: 0 od 13
 *   `depends_on` atributa na PROD-u ga je imalo nepraznog.
 */

export type Rules = Record<string, unknown>;

export interface RuleSpec {
  /** Popis opcija za obican suggest. Prazan => nema pravila tipa. */
  options?: string[];
  dependsOn?: {
    parentSlug: string;
    optionsMap: Record<string, string[]>;
    defaultMap?: Record<string, string>;
  };
  max?: unknown;
  hiddenInAdd?: boolean;
}

export function buildRules(spec: RuleSpec): Rules {
  let rules: Rules = {};
  if (spec.dependsOn) {
    const dep: Rules = {
      attribute_slug: spec.dependsOn.parentSlug,
      options_map: spec.dependsOn.optionsMap,
    };
    if (spec.dependsOn.defaultMap && Object.keys(spec.dependsOn.defaultMap).length > 0) {
      dep.default_map = spec.dependsOn.defaultMap;
    }
    rules = { type: 'suggest', depends_on: dep };
  } else if (spec.options && spec.options.length > 0) {
    rules = { type: 'suggest', suggest: spec.options };
    if (spec.max !== undefined && spec.max !== null && spec.max !== '') rules.max = spec.max;
  }
  // Ortogonalno tipu — dodaje se poslije svih grana, pa prezivi svaku.
  if (spec.hiddenInAdd) rules.hidden_in_add = true;
  return rules;
}

function asObject(raw: unknown): Rules | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p) ? p as Rules : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw as Rules : null;
}

/**
 * Oblik za USPOREDBU, ne za pisanje: mice razlike koje ne mijenjaju ponasanje
 * aplikacije (`allow_other: true`, prazan `suggest` uz `depends_on`, prazan
 * `default_map`, `hidden_in_add: false`, suggest bez ijedne opcije).
 * Sve ostalo ostaje doslovno — nepoznat kljuc je razlika, jer ne znamo sto znaci.
 */
export function canonicalRules(raw: unknown): Rules {
  const src = asObject(raw);
  if (!src) return {};
  const out: Rules = { ...src };

  if (out.allow_other === true) delete out.allow_other;
  if (out.hidden_in_add === false) delete out.hidden_in_add;

  const dep = asObject(out.depends_on);
  if (dep) {
    const d: Rules = { ...dep };
    const dm = asObject(d.default_map);
    if (!dm || Object.keys(dm).length === 0) delete d.default_map;
    if (Array.isArray(out.suggest) && out.suggest.length === 0) delete out.suggest;
    // Prazan `*` bez fallback liste = isto kao da ga nema (oba daju nula opcija,
    // `getOptionsForDependency`). Izvoz ga DOPISE sam kad ga nema, pa bi bez
    // ovoga prvi uvoz atributa napravljenog u panelu bio „promjena".
    const om = asObject(d.options_map);
    if (om && Array.isArray(om['*']) && (om['*'] as unknown[]).length === 0 && !out.suggest) {
      const rest = { ...om };
      delete rest['*'];
      d.options_map = rest;
    }
    out.depends_on = d;
  } else if (out.type === 'suggest' && (!Array.isArray(out.suggest) || out.suggest.length === 0)) {
    // `{type:'suggest', suggest:[]}` i `{}` se u formi ponasaju jednako (nema opcija).
    delete out.type;
    delete out.suggest;
  }
  return out;
}

/** Jesu li dva pravila ista PO ZNACENJU (redoslijed kljuceva nebitan, opcija bitan). */
export function sameRules(a: unknown, b: unknown): boolean {
  return stableStringify(canonicalRules(a)) === stableStringify(canonicalRules(b));
}

/** Sve opcije pravila: `suggest` + svaka lista u `depends_on.options_map`. */
export function allOptions(raw: unknown): Set<string> {
  const src = asObject(raw);
  const out = new Set<string>();
  if (!src) return out;
  if (Array.isArray(src.suggest)) for (const o of src.suggest) if (typeof o === 'string') out.add(o);
  const om = asObject(asObject(src.depends_on)?.options_map);
  if (om) for (const list of Object.values(om)) {
    if (Array.isArray(list)) for (const o of list) if (typeof o === 'string') out.add(o);
  }
  return out;
}

/**
 * Opcije koje nakon zamjene pravila NESTAJU iz izbornika (K-1, S160).
 *
 * ⚠ Po UNIJI svih lista: opcija koja se samo preseli pod drugi `WhenValue`
 *   ovdje nije „uklonjena" — retci s njom pod starim roditeljem time postaju
 *   siročad para, a to ova brana ne hvata (K0 inventar hoće).
 */
export function removedOptions(before: unknown, after: unknown): string[] {
  const next = allOptions(after);
  return [...allOptions(before)].filter(o => !next.has(o));
}

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Rules;
  return '{' + Object.keys(o).sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

/**
 * Doda novu opciju upisanu kroz „Other" — MIJENJA SAMO POPIS OPCIJA.
 * Vraca `null` ako opcija vec postoji (nista za pisati).
 *
 * /!\ Krece od SIROVOG pravila, ne od parsiranog: parsirani oblik ne nosi
 *     `default_map` ni `hidden_in_add` na mjestu gdje ih baza drzi, pa je
 *     gradnja iz njega te kljuceve tiho brisala.
 */
export function addOptionToRules(
  raw: unknown,
  newOption: string,
  dependencyValue: string | null,
  parsedOptions?: string[],
): Rules | null {
  const src = asObject(raw) ?? {};
  const dep = asObject(src.depends_on);

  if (dependencyValue && dep) {
    const map = { ...(asObject(dep.options_map) as Record<string, string[]> | null ?? {}) };
    const opts = Array.isArray(map[dependencyValue]) ? map[dependencyValue] : [];
    if (opts.includes(newOption)) return null;
    map[dependencyValue] = [...opts, newOption];
    return { ...src, depends_on: { ...dep, options_map: map } };
  }

  // `parsedOptions` samo za pravilo bez `suggest` kljuca (stari `dropdown`
  // format; izmjereno S152: 0 takvih u obje baze) — da ga prvi „Other" ne svede
  // na jednu opciju.
  const existing = Array.isArray(src.suggest) ? src.suggest as string[] : (parsedOptions ?? []);
  if (existing.includes(newOption)) return null;
  return { ...src, type: src.type ?? 'suggest', suggest: [...existing, newOption] };
}

/**
 * Preusmjeri `depends_on` na novi slug roditelja (rename u panelu).
 * Vraca `null` ako pravilo ne ovisi o `fromSlug`.
 */
export function renameDependsOnParent(raw: unknown, fromSlug: string, toSlug: string): Rules | null {
  const src = asObject(raw);
  const dep = asObject(src?.depends_on);
  if (!src || !dep || dep.attribute_slug !== fromSlug) return null;
  return { ...src, depends_on: { ...dep, attribute_slug: toSlug } };
}
