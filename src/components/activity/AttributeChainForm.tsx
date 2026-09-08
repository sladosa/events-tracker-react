import { useState, useMemo, useCallback, useEffect } from 'react';
import type { AttributeDefinition, Category } from '@/types';
import { AttributeInput } from './AttributeInput';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';

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
}: AttributeChainFormProps) {
  // Track which categories are expanded (leaf is always expanded)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Whether to show attributes that are currently at their default value
  const [showAllDefaults, setShowAllDefaults] = useState(false);

  // Tracks which attributes the user has explicitly changed this session.
  // Separate from `touched` (which is used for save logic) — pre-filled defaults
  // set touched:true for saving but should not count as user-edited for hiding purposes.
  const [userEditedIds, setUserEditedIds] = useState<Set<string>>(new Set());

  // Reset both states when user selects a different category
  const chainKey = useMemo(() => categoryChain.map(c => c.id).join(','), [categoryChain]);
  useEffect(() => {
    setShowAllDefaults(false);
    setUserEditedIds(new Set());
  }, [chainKey]);

  // Restore expanded state from localStorage when chain changes.
  // Per-category preference overrides the default (leaf open, parents closed).
  useEffect(() => {
    if (categoryChain.length > 0) {
      setExpandedCategories(() => {
        const next = new Set<string>();
        for (const cat of categoryChain) {
          const stored = getStoredExpanded(cat.id);
          const isLeaf = cat.id === categoryChain[0].id;
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
      setStoredExpanded(categoryId, willExpand);
      return next;
    });
  }, []);

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

  // onChange koji automatski cleara dependent atribute kad se parent promijeni.
  // Primjer: kad Strength_type promijeni vrijednost, exercise_name se resetira na null.
  const handleChangeWithClearDependents = useCallback((attrId: string, value: string | number | boolean | null) => {
    // 1. Promijeni vrijednost samog atributa
    onChange(attrId, value);
    setUserEditedIds(prev => { const next = new Set(prev); next.add(attrId); return next; });

    // 2. Nadji slug atributa koji se promijenio
    const changedAttr = allAttributes.find(a => a.id === attrId);
    if (!changedAttr) return;
    const changedSlug = changedAttr.slug;

    // 3. Pronadji sve atribute koji ovise o ovom slug-u i postavi default_map ili cleari
    const parentVal = value != null ? String(value) : null;
    for (const attr of allAttributes) {
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
  }, [onChange, allAttributes, normalizeSlug]);

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

  // Slugs whose dropdown must stay visible because a VISIBLE attribute depends on
  // them — hiding the parent (e.g. Strength_type at default) would strand the
  // dependent field (exercise_name) with no way to see/change what drives it.
  const requiredParentSlugs = useMemo(() => {
    const required = new Set<string>();
    if (showAllDefaults) return required;
    for (const attr of allAttributes) {
      const parsed = parseValidationRules(attr.validation_rules);
      if (!parsed.dependsOn || isDependencyHidden(attr)) continue;
      const currentValue = values.get(attr.id);
      const currentStr = currentValue?.value != null ? String(currentValue.value) : '';
      // ⚠ TRECE mjesto s istim uvjetom (S131) — `!!attr.default_value`, ne
      //   `!= null`. Ovdje bi razilazenje bilo najtise: polje bi se skrivalo po
      //   jednom pravilu, a njegov roditelj se drzao vidljivim po drugom.
      const hiddenByDefault = !!attr.default_value
        && !userEditedIds.has(attr.id)
        && currentStr === attr.default_value;
      if (!hiddenByDefault) required.add(normalizeSlug(parsed.dependsOn.attributeSlug));
    }
    return required;
  }, [showAllDefaults, allAttributes, values, userEditedIds, isDependencyHidden, normalizeSlug]);

  // Attribute is hidden because it sits at its default value and the user hasn't
  // explicitly changed it this session. "Show all" overrides; depends_on parents of
  // visible fields are exempt. Note: `touched` is not used here — pre-fill sets
  // touched:true for save logic, but that must not prevent hiding.
  const isHiddenByDefault = useCallback((attr: AttributeDefinition): boolean => {
    // ⚠ `!attr.default_value`, ne `== null` (S131). Prazan string NIJE default
    //   nego njegov izostanak, a `'' == null` je u JS-u `false` — pa je uvjet
    //   propustao svako prazno polje s `default_value = ''` i proglasavao ga
    //   „na svom defaultu" (`'' === ''`). Time je skrivanje-na-defaultu radilo
    //   posao zbog kojeg je `hidden_in_add` uopce izmisljen, i tiho ponistavalo
    //   podjelu odlucenu u S117:
    //     hide-at-default  → polje koje IMA vrijednost jednaku defaultu
    //     hidden_in_add    → polje cija je ISPRAVNA vrijednost prazna
    //   Izmjereno na PROD-u 08.09.: 14 atributa s `''`, svi u `Fitness`; nijedan
    //   od njih nema `hidden_in_add`, a sva tri `hidden_in_add` su u Financijama.
    //   Dakle mehanizmi se nigdje ne preklapaju — preklapao ih je samo ovaj uvjet.
    if (showAllDefaults || !attr.default_value || userEditedIds.has(attr.id)) return false;
    if (requiredParentSlugs.has(normalizeSlug(attr.slug))) return false;
    const currentValue = values.get(attr.id);
    const currentStr = currentValue?.value != null ? String(currentValue.value) : '';
    return currentStr === attr.default_value;
  }, [showAllDefaults, userEditedIds, requiredParentSlugs, values, normalizeSlug]);

  // Explicitly hidden for this Area (S117). Independent of hide-at-default,
  // which needs a value to compare against and so cannot touch a field whose
  // correct state is empty. "Show all" reveals these too — the flag is
  // tidiness, not a lock, and a stranded depends_on parent must stay reachable.
  const isHiddenExplicitly = useCallback((attr: AttributeDefinition): boolean => {
    if (showAllDefaults) return false;
    // ⚠ Obavezno polje se NE skriva, ma što `hidden_in_add` govorio. Dvije
    //   zastavice tvrde suprotno o istom polju — „mora se ispuniti" i „točna
    //   mu je vrijednost prazna" — pa je kombinacija besmislena, a ne samo
    //   nezgodna. Panel je od S131 ne da složiti; ovo hvata ono što dođe
    //   Excel uvozom, gdje panela nema. Invarijanta, ne disciplina: bez nje
    //   bi korisnik dobio poruku o polju kojeg na ekranu nema.
    if (attr.is_required) return false;
    return parseValidationRules(attr.validation_rules).hiddenInAdd;
  }, [showAllDefaults]);

  /** Revealed only because "Show all" is on — i.e. what "Hide again" will take
   *  away. Without marking these, the toggle is a leap: you see fields appear
   *  but not which ones are about to vanish. */
  const isRevealedOnly = useCallback((attr: AttributeDefinition): boolean => {
    if (!showAllDefaults) return false;
    if (parseValidationRules(attr.validation_rules).hiddenInAdd) return true;
    // Isti uvjet kao u `isHiddenByDefault` — mijenjaju se ZAJEDNO. Raziđu li se,
    // polje bude skriveno po jednom pravilu a oznaceno po drugom.
    if (!attr.default_value || userEditedIds.has(attr.id)) return false;
    const currentValue = values.get(attr.id);
    const currentStr = currentValue?.value != null ? String(currentValue.value) : '';
    return currentStr === attr.default_value;
  }, [showAllDefaults, userEditedIds, values]);

  /** Any reason this attribute is not on screen right now. */
  const isHidden = useCallback((attr: AttributeDefinition): boolean =>
    isDependencyHidden(attr) || isHiddenByDefault(attr) || isHiddenExplicitly(attr),
  [isDependencyHidden, isHiddenByDefault, isHiddenExplicitly]);

  // Count attributes currently hidden because they match their default value
  const hiddenByDefaultCount = useMemo(
    // Dependency-hidden fields are excluded: "Show all" deliberately does not
    // reveal them (a dropdown with no parent value has nothing to offer), so
    // counting them would promise more than the button delivers — measured as
    // "3 fields hidden" revealing two, `Stanje` being hidden BOTH ways.
    () => allAttributes.filter(a =>
      !isDependencyHidden(a) && (isHiddenByDefault(a) || isHiddenExplicitly(a))).length,
    [allAttributes, isDependencyHidden, isHiddenByDefault, isHiddenExplicitly]
  );

  // Render attributes for a single category
  const renderCategoryAttributes = (category: Category, isLeaf: boolean) => {
    const attributes = attributesByCategory.get(category.id) || [];
    
    if (attributes.length === 0) {
      return (
        <p className="text-sm text-gray-400 italic">No attributes defined</p>
      );
    }

    // All attributes hidden (defaults / dependency) → say so instead of rendering
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
      />
    );

    // ⚠ OMOTAC SE UVIJEK RENDERIRA, i kad nema sto oznaciti (S131).
    //   Prije je `revealed` biralo IZMEDJU dva razlicita elementa — goli
    //   `AttributeInput` ili `<div>` oko njega. React na promjeni TIPA elementa
    //   na istom mjestu odmontira cijelo podstablo i montira novo, pa se `<input>`
    //   DOM cvor UNISTI I STVORI NANOVO — a s njim se gubi FOKUS.
    //
    //   `revealed` se prevrce na PRVI utipkani znak (`userEditedIds` dobije
    //   atribut, a i vrijednost prestane biti jednaka defaultu), dakle tocno
    //   usred tipkanja. Posljedica koju je Sasa izmjerio 08.09.: u „Show all"
    //   modu upises `2,8` u prazno polje, a ostane `2` — prvi znak srusi polje,
    //   ostatak tipkanja ode u prazno. Drugi pokusaj radi, jer atribut je vec
    //   u `userEditedIds` pa se nista ne prevrce. Zato je izgledalo nasumicno.
    //
    //   ⚠ Nije bug polja za broj — pogadja SVAKI tip atributa (tekst jednako),
    //   samo se na broju vidi kao izgubljena decimala umjesto kao skraceni tekst.
    //
    //   `{revealed && ...}` drzi stabilan slot djeteta: `false` zauzme mjesto,
    //   pa `input` ostaje na istom indeksu i nikad se ne remonta.
    return (
      <div
        key={attr.id}
        className={revealed ? 'relative pl-2 border-l-2 border-dashed border-gray-300' : undefined}
      >
        {revealed && (
          <span className="absolute -top-0.5 right-0 text-[10px] text-gray-400 italic">
            skriveno
          </span>
        )}
        {input}
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

      {/* Toggle for attributes hidden because they match their default value */}
      {!showAllDefaults && hiddenByDefaultCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllDefaults(true)}
          className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border border-dashed border-gray-200 transition-colors flex items-center gap-1.5"
        >
          <span className="text-gray-400">▸</span>
          <span>
            {hiddenByDefaultCount} {hiddenByDefaultCount === 1 ? 'field' : 'fields'} hidden
          </span>
          <span className="ml-auto text-blue-500 font-medium">Show all</span>
        </button>
      )}
      {showAllDefaults && (
        <button
          type="button"
          onClick={() => setShowAllDefaults(false)}
          className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg border border-dashed border-gray-200 transition-colors flex items-center gap-1.5"
        >
          <span>▴</span>
          <span>Hide again (polja označena <span className="italic">skriveno</span>)</span>
        </button>
      )}
    </div>
  );
}
