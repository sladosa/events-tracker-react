import { useState, useMemo, useCallback, useEffect } from 'react';
import type { AttributeDefinition, Category } from '@/types';
import { AttributeInput } from './AttributeInput';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';
import { controllingDef, fieldsToClear, isHiddenByRule } from '@/lib/visibleWhen';
import { proposeKey, readUnique } from '@/lib/uniqueValue';
import { UniqueHint } from './UniqueHint';

// ---- localStorage helpers ----
// Key per category UUID: 'attrExpanded:<uuid>' → 'true' | 'false'
// null = no preference stored → use default

function getStoredExpanded(categoryId: string): boolean | null {
  try {
    const val = localStorage.getItem(`attrExpanded:${categoryId}`);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function setStoredExpanded(categoryId: string, expanded: boolean): void {
  try {
    localStorage.setItem(`attrExpanded:${categoryId}`, expanded ? 'true' : 'false');
  } catch {
    // ignore — storage might be full or disabled
  }
}

interface AttributeValue {
  definitionId: string;
  value: string | number | boolean | null;
  touched: boolean;
}

interface AttributeChainFormProps {
  categoryChain: Category[];  // Od leaf (index 0) do root (zadnji)
  attributesByCategory: Map<string, AttributeDefinition[]>;
  values: Map<string, AttributeValue>;
  onChange: (definitionId: string, value: string | number | boolean | null) => void;
  onTouch: (definitionId: string) => void;
  disabled?: boolean;
  expandedByDefault?: boolean;
  // Callback kada korisnik unese novu "Other" vrijednost — parent je zadužen za persist
  onNewOption?: (definitionId: string, newOption: string, dependencyValue?: string | null) => void;
  /** S160: grantee ne dodaje opcije — v. `AttributeInput.noNewOptionsHint`. */
  noNewOptionsHint?: string | null;
  /** S187 (Edit): atributi koji imaju vrijednost SPREMLJENU U BAZI. Pravilo
   *  vidljivosti (`visible_when`) takvo polje ne skriva dok čovjek ne promijeni
   *  atribut o kojem ovisi — inače bi otvaranje + Save starog retka tiho obrisalo
   *  podatak (skriveno se ne sprema). Add ga ne šalje. */
  storedAttrIds?: ReadonlySet<string>;
  /** S190 (Edit): zapis koji se uređuje — `unique` ga ne smije prijaviti kao vlastiti duplikat. */
  currentEventId?: string | null;
}

// Check if attribute is a dropdown type (should be sticky in leaf)
function isDropdownAttribute(attr: AttributeDefinition): boolean {
  const parsed = parseValidationRules(attr.validation_rules);
  return parsed.type === 'suggest' || parsed.type === 'enum' || !!parsed.dependsOn;
}

export function AttributeChainForm({
  categoryChain,
  attributesByCategory,
  values,
  onChange,
  onTouch,
  disabled,
  expandedByDefault = false,
  onNewOption,
  noNewOptionsHint = null,
  storedAttrIds,
  currentEventId = null,
}: AttributeChainFormProps) {
  // Track which categories are expanded (leaf is always expanded)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // „Show all": otkriva polja skrivena zastavicom `hidden_in_add`.
  // ⚠ S187 (d1, Saša): polje na svom defaultu se VIŠE NE SKRIVA. Do tada je
  //   forma (S117 „hide-at-default") skrivala svako polje čija je vrijednost
  //   jednaka `default_value` — pravilo koje nitko nije postavio nego ga je
  //   forma izvodila sama, pa je u Fitnessu sakrivalo intensity, Cardio_type,
  //   equipment… Vidljivost sada određuju samo `hidden_in_add` i `depends_on`.
  const [showAll, setShowAll] = useState(false);
  /** Pojedinačno otkrivena polja — klik na IME u sažetoj liniji (S136).
   *  ⚠ Postoji zato što je „Show all" sve-ili-ništa: da otvoriš jedno polje,
   *  morao si otvoriti sva, pa ih zatvoriti natrag. */
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  /** Atributi koje je ČOVJEK promijenio u ovoj formi (S187). Samo za iznimku
   *  Edita (`storedAttrIds`): spremljena vrijednost izvan pravila ostaje vidljiva
   *  dok se ne promijeni atribut o kojem polje ovisi. */
  const [userChangedIds, setUserChangedIds] = useState<Set<string>>(new Set());

  // Reset when user selects a different category — or (Edit) a different event
  const chainKey = useMemo(() => categoryChain.map(c => c.id).join(','), [categoryChain]);
  const storedKey = useMemo(() => (storedAttrIds ? [...storedAttrIds].sort().join(',') : ''), [storedAttrIds]);
  const leafId = categoryChain[0]?.id ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-na-promjenu-ulaza: kategorija se promijenila => stanje forme se mora ocistiti; nema ga sto izvesti iz rendera
    setShowAll(false);
  }, [chainKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-na-promjenu-ulaza: drugi kategorija ili event (tab u Editu) => „čovjek je promijenio" više ne vrijedi
    setUserChangedIds(new Set());
  }, [chainKey, storedKey]);

  // Restore expanded state from localStorage when chain changes.
  // Per-category preference overrides the default (leaf open, parents closed).
  // ⚠ S154: LEAF SE UVIJEK OTVARA. Zapamćeno zatvaranje vrijedilo je trajno, po
  //   pregledniku — pa je jedan slučajan dodir na naslov Koki (mali iPhone, slaba
  //   rasvjeta) ostavio `Transakcija` zatvorenu u svakom sljedećem unosu, bez
  //   ijednog polja za upis i bez vidljivog razloga. Leaf su polja koja se
  //   upisuju; zatvaranje unutar jednog unosa i dalje radi, samo se ne pamti.
  //   Pamćenje ostaje za roditeljske razine.
  useEffect(() => {
    if (categoryChain.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- citanje-okoline: `localStorage` se ne smije citati tijekom rendera
      setExpandedCategories(() => {
        const next = new Set<string>();
        for (const cat of categoryChain) {
          const isLeaf = cat.id === categoryChain[0].id;
          const stored = isLeaf ? null : getStoredExpanded(cat.id);
          if (stored !== null) {
            if (stored) next.add(cat.id);
            // stored=false → don't add (collapsed)
          } else if (isLeaf || expandedByDefault) {
            next.add(cat.id);
          }
        }
        return next;
      });
    }
  }, [categoryChain, expandedByDefault]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      const willExpand = !next.has(categoryId);
      if (willExpand) next.add(categoryId); else next.delete(categoryId);
      if (categoryId !== leafId) setStoredExpanded(categoryId, willExpand);   // leaf se ne pamti (S154)
      return next;
    });
  }, [leafId]);

  // Normalize slug for consistent lookup
  const normalizeSlug = useCallback((slug: string): string => {
    return slug.toLowerCase().replace(/[-_]/g, '_');
  }, []);

  // Svi atributi u chainu (za dependency clear)
  const allAttributes = useMemo(() => {
    const all: AttributeDefinition[] = [];
    for (const category of categoryChain) {
      const attrs = attributesByCategory.get(category.id) || [];
      all.push(...attrs);
    }
    return all;
  }, [categoryChain, attributesByCategory]);

  /** Lanac za pravilo vidljivosti: od leafa prema korijenu (`visibleWhen.ts`). */
  const chainLevels = useMemo(
    () => categoryChain.map(c => ({ categoryId: c.id, defs: attributesByCategory.get(c.id) || [] })),
    [categoryChain, attributesByCategory],
  );
  const valueOf = useCallback((id: string) => values.get(id)?.value, [values]);

  /** S187: pravilo `visible_when` skriva — ali NE spremljenu vrijednost u Editu
   *  dok čovjek ne promijeni atribut o kojem polje ovisi (v. `storedAttrIds`). */
  const isOutOfRule = useCallback((attr: AttributeDefinition): boolean => {
    if (!storedAttrIds?.has(attr.id) || !isHiddenByRule(attr, chainLevels, valueOf)) return false;
    const ctrl = controllingDef(attr, chainLevels);
    const v = valueOf(attr.id);
    return !!ctrl && !userChangedIds.has(ctrl.id) && v != null && v !== '';
  }, [storedAttrIds, chainLevels, valueOf, userChangedIds]);

  // onChange koji automatski cleara dependent atribute kad se parent promijeni.
  // Primjer: kad Strength_type promijeni vrijednost, exercise_name se resetira na null.
  const handleChangeWithClearDependents = useCallback((attrId: string, value: string | number | boolean | null) => {
    // 1. Promijeni vrijednost samog atributa
    onChange(attrId, value);
    setUserChangedIds(prev => (prev.has(attrId) ? prev : new Set(prev).add(attrId)));

    // 1b. S187: polja koja ova promjena SKRIJE (`visible_when`) gube vrijednost —
    //   skriveno se ne sprema, a bez ovoga bi Cardio dio spremio serije upisane
    //   dok je vrsta bila Snaga. Okidač je ovaj potez, nikad otvaranje forme (S127).
    // „Bilo na ekranu" = stanje ovog rendera (vrijednosti još nisu promijenjene),
    // uključujući Edit iznimku „izvan pravila".
    const cleared = new Set(fieldsToClear(attrId, value, chainLevels, valueOf,
      d => !isHiddenByRule(d, chainLevels, valueOf) || isOutOfRule(d as AttributeDefinition)));
    for (const id of cleared) onChange(id, null);

    // 2. Nadji slug atributa koji se promijenio
    const changedAttr = allAttributes.find(a => a.id === attrId);
    if (!changedAttr) return;
    const changedSlug = changedAttr.slug;

    // 2b. S190: `unique: {from}` — prijedlog vrijednosti (slug iz imena) dok je čovjek sam
    //   ne promijeni. Nikad preko vrijednosti iz baze (Edit): slug postojećeg zapisa je u
    //   svakom zapisu koji ga citira, pa se mijenja alatom, ne usput.
    for (const d of allAttributes) {
      if (readUnique(d.validation_rules)?.from !== changedSlug) continue;
      if (userChangedIds.has(d.id) || storedAttrIds?.has(d.id)) continue;
      onChange(d.id, proposeKey(value != null ? String(value) : '') || null);
    }

    // 3. Pronadji sve atribute koji ovise o ovom slug-u i postavi default_map ili cleari
    const parentVal = value != null ? String(value) : null;
    for (const attr of allAttributes) {
      // Skriveno pravilom (1b) ne dobiva ni `default_map` — ostaje prazno.
      if (cleared.has(attr.id)) continue;
      const parsed = parseValidationRules(attr.validation_rules);
      if (!parsed.dependsOn) continue;
      const depSlug = parsed.dependsOn.attributeSlug;
      if (
        depSlug === changedSlug ||
        normalizeSlug(depSlug) === normalizeSlug(changedSlug)
      ) {
        const mappedDefault = parentVal && parsed.dependsOn.defaultMap
          ? (parsed.dependsOn.defaultMap[parentVal] ?? parsed.dependsOn.defaultMap['*'] ?? null)
          : null;
        onChange(attr.id, mappedDefault);
      }
    }
  }, [onChange, allAttributes, normalizeSlug, chainLevels, valueOf, isOutOfRule, userChangedIds, storedAttrIds]);

  // Build a map of attribute slugs to their current values
  const attributeValuesBySlug = useMemo(() => {
    const map = new Map<string, string | null>();
    
    const allAttributes: AttributeDefinition[] = [];
    for (const category of categoryChain) {
      const attrs = attributesByCategory.get(category.id) || [];
      allAttributes.push(...attrs);
    }
    
    for (const attr of allAttributes) {
      const val = values.get(attr.id);
      const stringVal = val?.value != null ? String(val.value) : null;
      map.set(attr.slug, stringVal);
      map.set(normalizeSlug(attr.slug), stringVal);
    }
    
    return map;
  }, [categoryChain, attributesByCategory, values, normalizeSlug]);

  // For non-text types (number, boolean, datetime): depends_on acts as visibility
  // control — field is hidden until the parent value matches a non-'*' WhenValue key.
  const isDependencyHidden = useCallback((attr: AttributeDefinition): boolean => {
    const parsed = parseValidationRules(attr.validation_rules);
    if (!parsed.dependsOn || attr.data_type === 'text') return false;
    const depSlug = parsed.dependsOn.attributeSlug;
    const dependencyValue = attributeValuesBySlug.get(depSlug)
      ?? attributeValuesBySlug.get(normalizeSlug(depSlug))
      ?? null;
    if (!dependencyValue) return true;
    const depUpper = dependencyValue.toUpperCase();
    return !Object.keys(parsed.dependsOn.optionsMap)
      .filter(k => k !== '*')
      .some(k => k.toUpperCase() === depUpper);
  }, [attributeValuesBySlug, normalizeSlug]);

  /** Nosi li polje zastavicu `hidden_in_add` koja stvarno vrijedi (S117).
   *  ⚠ Obavezno polje se NE skriva, ma što `hidden_in_add` govorio. Dvije
   *  zastavice tvrde suprotno o istom polju — „mora se ispuniti" i „točna
   *  mu je vrijednost prazna" — pa je kombinacija besmislena, a ne samo
   *  nezgodna. Panel je od S131 ne da složiti; ovo hvata ono što dođe
   *  Excel uvozom, gdje panela nema. Invarijanta, ne disciplina: bez nje
   *  bi korisnik dobio poruku o polju kojeg na ekranu nema. */
  const hasHiddenFlag = useCallback((attr: AttributeDefinition): boolean =>
    !attr.is_required && parseValidationRules(attr.validation_rules).hiddenInAdd,
  []);

  // Explicitly hidden for this Area (S117). "Show all" reveals these too — the
  // flag is tidiness, not a lock, and a stranded depends_on parent must stay reachable.
  const isHiddenExplicitly = useCallback((attr: AttributeDefinition): boolean => {
    if (showAll || revealedIds.has(attr.id)) return false;
    return hasHiddenFlag(attr);
  }, [showAll, revealedIds, hasHiddenFlag]);

  /** Revealed only because "Show all" is on — i.e. what "Hide again" will take
   *  away. Without marking these, the toggle is a leap: you see fields appear
   *  but not which ones are about to vanish. */
  const isRevealedOnly = useCallback((attr: AttributeDefinition): boolean => {
    // ⚠ Pojedinačno otkriveno polje nosi ISTU oznaku (S136): ono je i dalje
    //   polje koje normalno nije na ekranu, pa bi bez oznake izgledalo kao da
    //   je oduvijek bilo ondje — a onda „Hide again" odnese nešto što korisnik
    //   ne očekuje da će nestati.
    if (revealedIds.has(attr.id)) return true;
    // Isti uvjet kao skrivanje (`hasHiddenFlag`) — obavezno polje nije skriveno,
    // pa ga ni „Show all" ne otkriva i ne smije nositi oznaku.
    return showAll && hasHiddenFlag(attr);
  }, [showAll, revealedIds, hasHiddenFlag]);

  const isRuleHidden = useCallback((attr: AttributeDefinition): boolean =>
    isHiddenByRule(attr, chainLevels, valueOf) && !isOutOfRule(attr),
  [chainLevels, valueOf, isOutOfRule]);

  /** Any reason this attribute is not on screen right now. */
  const isHidden = useCallback((attr: AttributeDefinition): boolean =>
    isDependencyHidden(attr) || isRuleHidden(attr) || isHiddenExplicitly(attr),
  [isDependencyHidden, isRuleHidden, isHiddenExplicitly]);

  /** Skrivena polja, IMENOVANA (S136, Sašin nalaz) — ne brojač: „1 field hidden"
   *  ne kaže što je unutra, pa da otvoriš jedno polje moraš otvoriti sva.
   *
   *  ⚠ `depends_on`-skrivena polja se IZOSTAVLJAJU. „Show all" ih
   *  namjerno ne otkriva (dropdown bez roditeljske vrijednosti nema što ponuditi),
   *  pa bi ih nabrajanje obećalo — izmjereno kao „3 fields hidden" koje otkrije
   *  dva, uz `Stanje` skriveno na OBA načina. Isto za `visible_when` (S187):
   *  polje za snagu nema smisla uz Cardio, pa ga „Show all" ne otkriva.
   */
  const hiddenExplicit = useMemo(
    () => allAttributes.filter(a => !isDependencyHidden(a) && !isRuleHidden(a) && isHiddenExplicitly(a)),
    [allAttributes, isDependencyHidden, isRuleHidden, isHiddenExplicitly]
  );

  const revealOne = useCallback((id: string) => {
    setRevealedIds(prev => new Set(prev).add(id));
  }, []);

  /**
   * Suprotno od `revealOne` — ali SAMO za polje otkriveno pojedinačno.
   *
   * ⚠ Polje otkriveno preko „Show all" NIJE u `revealedIds`, pa bi mu
   *   „sakrij" bio **tihi no-op**: korisnik klikne, ništa se ne dogodi, i
   *   nigdje ne piše zašto. Zato je oznaka klikabilna samo kad klik ima
   *   učinka; inače ostaje običan natpis, a kontrola je „Hide again".
   *   (Isti razred kao S134 `assertWrote()`: tiho neuspjelo > glasno odbijeno.)
   */
  const hideOne = useCallback((id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Render attributes for a single category
  const renderCategoryAttributes = (category: Category, isLeaf: boolean) => {
    const attributes = attributesByCategory.get(category.id) || [];
    
    if (attributes.length === 0) {
      return (
        <p className="text-sm text-gray-400 italic">No attributes defined</p>
      );
    }

    // All attributes hidden (hidden_in_add / dependency) → say so instead of rendering
    // an empty box that looks like the category "won't open"
    if (attributes.every(isHidden)) {
      return (
        <p className="text-sm text-gray-400 italic">
          All fields hidden — use "Show all" below
        </p>
      );
    }

    // For leaf category, separate dropdown and non-dropdown attributes
    if (isLeaf) {
      const dropdownAttrs = attributes.filter(isDropdownAttribute);
      const otherAttrs = attributes.filter(a => !isDropdownAttribute(a));

      return (
        <div className="space-y-3">
          {/* Dropdown attributes - sticky */}
          {dropdownAttrs.length > 0 && (
            <div className="bg-blue-50/95 -mx-4 px-4 py-2 border-b border-blue-100 space-y-3">
              {dropdownAttrs.map(attr => renderAttribute(attr))}
            </div>
          )}
          
          {/* Other attributes - normal scroll */}
          {otherAttrs.map(attr => renderAttribute(attr))}
        </div>
      );
    }

    // Non-leaf categories - render normally
    return (
      <div className="space-y-4">
        {attributes.map(attr => renderAttribute(attr))}
      </div>
    );
  };

  // Render single attribute
  const renderAttribute = (attr: AttributeDefinition) => {
    const currentValue = values.get(attr.id);
    
    const parsed = parseValidationRules(attr.validation_rules);
    let dependencyValue: string | null = null;
    
    if (parsed.dependsOn) {
      const depSlug = parsed.dependsOn.attributeSlug;
      dependencyValue = attributeValuesBySlug.get(depSlug)
        ?? attributeValuesBySlug.get(normalizeSlug(depSlug))
        ?? null;
    }

    if (isHidden(attr)) return null;

    const revealed = isRevealedOnly(attr);
    const outOfRule = isOutOfRule(attr);
    // Klik na oznaku smije sakriti samo ono što je klik i otkrio.
    const canHide = revealedIds.has(attr.id);
    const input = (
      <AttributeInput
        key={attr.id}
        definition={attr}
        value={currentValue?.value ?? null}
        onChange={(val) => handleChangeWithClearDependents(attr.id, val)}
        onTouched={() => onTouch(attr.id)}
        dependencyValue={dependencyValue}
        disabled={disabled}
        onNewOption={onNewOption}
        noNewOptionsHint={noNewOptionsHint}
      />
    );

    // ⚠ OMOTAC SE UVIJEK RENDERIRA, i kad nema sto oznaciti (S131).
    //   Prije je `revealed` biralo IZMEDJU dva razlicita elementa — goli
    //   `AttributeInput` ili `<div>` oko njega. React na promjeni TIPA elementa
    //   na istom mjestu odmontira cijelo podstablo i montira novo, pa se `<input>`
    //   DOM cvor UNISTI I STVORI NANOVO — a s njim se gubi FOKUS.
    //
    //   Tada se `revealed` prevrtao na PRVI utipkani znak (skrivanje na defaultu,
    //   ukinuto S187), dakle tocno usred tipkanja: u „Show all" modu upises `2,8`,
    //   a ostane `2` (Sasa, 08.09.). Danas se prevrce na klik „skriveno ✕" /
    //   „Hide again" — i svaki buduci uvjet vidljivosti (S187 `visible_when`)
    //   moze ga opet prevrnuti usred unosa. Zato omotac ostaje uvijek.
    //
    //   `{revealed && ...}` drzi stabilan slot djeteta: `false` zauzme mjesto,
    //   pa `input` ostaje na istom indeksu i nikad se ne remonta.
    return (
      <div
        key={attr.id}
        className={revealed ? 'relative pl-2 border-l-2 border-dashed border-gray-300'
          : outOfRule ? 'relative pl-2 border-l-2 border-dashed border-amber-300' : undefined}
      >
        {outOfRule && !revealed && (
          <span
            className="absolute -top-0.5 right-0 text-[10px] text-amber-600 italic"
            title="Pravilo vidljivosti ovo polje uz ovu vrijednost skriva, ali u bazi ima vrijednost — zato je ovdje. Promijeniš li atribut o kojem ovisi, polje nestaje i vrijednost se briše."
          >
            izvan pravila
          </span>
        )}
        {revealed && (canHide ? (
          <button
            type="button"
            onClick={() => hideOne(attr.id)}
            title="Sakrij ovo polje"
            className="absolute -top-0.5 right-0 text-[10px] text-gray-400 italic hover:text-gray-600 hover:not-italic"
          >
            skriveno ✕
          </button>
        ) : (
          <span className="absolute -top-0.5 right-0 text-[10px] text-gray-400 italic">
            skriveno
          </span>
        ))}
        {input}
        {readUnique(attr.validation_rules) && (
          <UniqueHint
            definition={attr}
            textDefs={(attributesByCategory.get(attr.category_id ?? '') || []).filter(d => d.data_type === 'text' && d.id !== attr.id)}
            valueOf={valueOf}
            ownEventId={currentEventId}
          />
        )}
      </div>
    );
  };

  if (categoryChain.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select a category to see attributes
      </div>
    );
  }

  // Render in hierarchy order: root/parents first (collapsed), leaf last (expanded)
  // Chain comes as: [leaf, parent1, parent2, ..., root]
  // We want to show: root → ... → parent1 → leaf
  // A4: Filter out categories with 0 attributes (except leaf) to save screen space
  const displayOrder = [...categoryChain]
    .reverse()
    .filter((category) => {
      const isLeaf = category.id === categoryChain[0].id;
      const attributes = attributesByCategory.get(category.id) || [];
      // Keep leaf always, keep others only if they have attributes
      return isLeaf || attributes.length > 0;
    });
  
  return (
    <div className="space-y-2">
      {displayOrder.map((category) => {
        const isLeaf = category.id === categoryChain[0].id; // First in original chain is leaf
        const isExpanded = expandedCategories.has(category.id);
        const attributes = attributesByCategory.get(category.id) || [];
        // P1: count attrs with no meaningful value (null, undefined, empty string)
        const emptyCount = attributes.filter(a => {
          const v = values.get(a.id)?.value;
          return v === null || v === undefined || v === '';
        }).length;
        
        return (
          <div
            key={category.id}
            className={`border rounded-lg overflow-hidden ${
              isLeaf ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={`w-full px-4 py-2.5 flex items-center justify-between text-left ${
                isLeaf 
                  ? 'bg-blue-50 hover:bg-blue-100' 
                  : 'bg-gray-50 hover:bg-gray-100'
              } transition-colors`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className={`font-medium ${isLeaf ? 'text-blue-800' : 'text-gray-700'}`}>
                  {category.name}
                </span>
                {isLeaf && (
                  <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">
                    leaf
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  ({attributes.length} attrs
                  {emptyCount > 0 && (
                    <span className="text-amber-600"> / {emptyCount} empty</span>
                  )})
                </span>
              </div>
            </button>

            {/* Category Attributes */}
            {isExpanded && (
              <div className={`px-4 py-3 border-t ${isLeaf ? 'border-blue-100' : 'border-gray-100'}`}>
                {renderCategoryAttributes(category, isLeaf)}
              </div>
            )}
          </div>
        );
      })}

      {/* Polja skrivena zastavicom `hidden_in_add` — imenovana, s „Show all" */}
      {!showAll && hiddenExplicit.length > 0 && (
        <div className="px-3 py-2 rounded-lg border border-dashed border-gray-200 space-y-1">
          <div className="flex items-start gap-1.5 text-xs text-gray-500">
            <span className="text-gray-400 leading-5">▸</span>
            <span className="leading-5 shrink-0">prazna po pravilu</span>
            <span className="flex flex-wrap gap-x-1.5 gap-y-1">
              {hiddenExplicit.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => revealOne(a.id)}
                  title="Otvori samo ovo polje"
                  className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {a.name}
                </button>
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full text-right text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
          >
            Show all
          </button>
        </div>
      )}
      {/* ⚠ Uvjet nosi i `revealedIds.size` (S136): otkriješ li polja pojedinačno,
          gornji blok nestane (nema više skrivenih) — a s njim bi nestao i jedini
          put natrag. Polje bi ostalo otvoreno do kraja sesije, bez ičega što kaže
          kako ga vratiti. */}
      {(showAll || revealedIds.size > 0) && (
        <button
          type="button"
          onClick={() => { setShowAll(false); setRevealedIds(new Set()); }}
          className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg border border-dashed border-gray-200 transition-colors flex items-center gap-1.5"
        >
          <span>▴</span>
          <span>Hide again (polja označena <span className="italic">skriveno</span>)</span>
        </button>
      )}
    </div>
  );
}
