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
      const hiddenByDefault = attr.default_value != null
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
    if (showAllDefaults || attr.default_value == null || userEditedIds.has(attr.id)) return false;
    if (requiredParentSlugs.has(normalizeSlug(attr.slug))) return false;
    const currentValue = values.get(attr.id);
    const currentStr = currentValue?.value != null ? String(currentValue.value) : '';
    return currentStr === attr.default_value;
  }, [showAllDefaults, userEditedIds, requiredParentSlugs, values, normalizeSlug]);

  // Count attributes currently hidden because they match their default value
  const hiddenByDefaultCount = useMemo(
    () => allAttributes.filter(isHiddenByDefault).length,
    [allAttributes, isHiddenByDefault]
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
    if (attributes.every(a => isDependencyHidden(a) || isHiddenByDefault(a))) {
      return (
        <p className="text-sm text-gray-400 italic">
          All fields hidden (at default values) — use "Show all" below
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

    if (isDependencyHidden(attr) || isHiddenByDefault(attr)) return null;

    return (
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
            {hiddenByDefaultCount} {hiddenByDefaultCount === 1 ? 'field' : 'fields'} hidden (at default)
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
          <span>Hide fields at default</span>
        </button>
      )}
    </div>
  );
}
