import { useState, useMemo, useCallback, useEffect } from 'react';
import type { AttributeDefinition, Category } from '@/types';
import { AttributeInput } from './AttributeInput';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';

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

  // Update expanded categories when chain changes
  useEffect(() => {
    if (categoryChain.length > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        // Leaf always expanded
        next.add(categoryChain[0].id);
        // Optionally expand all
        if (expandedByDefault) {
          categoryChain.forEach(c => next.add(c.id));
        }
        return next;
      });
    }
  }, [categoryChain, expandedByDefault]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
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

    // 2. Nadji slug atributa koji se promijenio
    const changedAttr = allAttributes.find(a => a.id === attrId);
    if (!changedAttr) return;
    const changedSlug = changedAttr.slug;

    // 3. Pronadji sve atribute koji ovise o ovom slug-u i cleari ih
    for (const attr of allAttributes) {
      const parsed = parseValidationRules(attr.validation_rules);
      if (!parsed.dependsOn) continue;
      const depSlug = parsed.dependsOn.attributeSlug;
      if (
        depSlug === changedSlug ||
        normalizeSlug(depSlug) === normalizeSlug(changedSlug)
      ) {
        onChange(attr.id, null); // reset dependent na null
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

  // Render attributes for a single category
  const renderCategoryAttributes = (category: Category, isLeaf: boolean) => {
    const attributes = attributesByCategory.get(category.id) || [];
    
    if (attributes.length === 0) {
      return (
        <p className="text-sm text-gray-400 italic">No attributes defined</p>
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
    </div>
  );
}
