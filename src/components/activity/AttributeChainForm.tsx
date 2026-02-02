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
}

export function AttributeChainForm({
  categoryChain,
  attributesByCategory,
  values,
  onChange,
  onTouch,
  disabled,
  expandedByDefault = false,
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
  // Handles: "Strength_type" vs "strength-type" vs "strength_type"
  const normalizeSlug = useCallback((slug: string): string => {
    return slug.toLowerCase().replace(/[-_]/g, '_');
  }, []);

  // Build a map of attribute slugs to their current values
  // Used for dependency resolution
  const attributeValuesBySlug = useMemo(() => {
    const map = new Map<string, string | null>();
    
    // Flatten all attributes
    const allAttributes: AttributeDefinition[] = [];
    for (const category of categoryChain) {
      const attrs = attributesByCategory.get(category.id) || [];
      allAttributes.push(...attrs);
    }
    
    // Map BOTH original and normalized slug to current value
    for (const attr of allAttributes) {
      const val = values.get(attr.id);
      const stringVal = val?.value != null ? String(val.value) : null;
      map.set(attr.slug, stringVal);                    // original: "Strength_type"
      map.set(normalizeSlug(attr.slug), stringVal);     // normalized: "strength_type"
    }
    
    return map;
  }, [categoryChain, attributesByCategory, values, normalizeSlug]);

  // Render attributes for a single category
  const renderCategoryAttributes = (category: Category) => {
    const attributes = attributesByCategory.get(category.id) || [];
    
    if (attributes.length === 0) {
      return (
        <p className="text-sm text-gray-400 italic">No attributes defined</p>
      );
    }

    return (
      <div className="space-y-4">
        {attributes.map(attr => {
          const currentValue = values.get(attr.id);
          
          // Check for dependency
          const parsed = parseValidationRules(attr.validation_rules);
          let dependencyValue: string | null = null;
          
          if (parsed.dependsOn) {
            // Try exact match first, then normalized
            const depSlug = parsed.dependsOn.attributeSlug;
            dependencyValue = attributeValuesBySlug.get(depSlug) 
              ?? attributeValuesBySlug.get(normalizeSlug(depSlug)) 
              ?? null;
            // DEBUG: Log dependency resolution
            console.log(`[AttrChainForm] "${attr.slug}" depends on "${depSlug}" (normalized: "${normalizeSlug(depSlug)}") → value: "${dependencyValue}"`);
            console.log(`[AttrChainForm] attributeValuesBySlug keys:`, [...attributeValuesBySlug.keys()]);
          }
          
          return (
            <AttributeInput
              key={attr.id}
              definition={attr}
              value={currentValue?.value ?? null}
              onChange={(val) => onChange(attr.id, val)}
              onTouched={() => onTouch(attr.id)}
              dependencyValue={dependencyValue}
              disabled={disabled}
            />
          );
        })}
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

  return (
    <div className="space-y-4">
      {categoryChain.map((category, index) => {
        const isLeaf = index === 0;
        const isExpanded = expandedCategories.has(category.id);
        const attributes = attributesByCategory.get(category.id) || [];
        const touchedCount = attributes.filter(a => values.get(a.id)?.touched).length;
        
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
              className={`w-full px-4 py-3 flex items-center justify-between text-left ${
                isLeaf ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
              } transition-colors`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className={`font-medium ${isLeaf ? 'text-blue-800' : 'text-gray-700'}`}>
                  {category.name}
                </span>
                {isLeaf && (
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                    leaf
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {touchedCount > 0 && (
                  <span className="text-green-600">{touchedCount} filled</span>
                )}
                <span>({attributes.length} attrs)</span>
              </div>
            </button>

            {/* Category Attributes */}
            {isExpanded && (
              <div className="px-4 py-4 border-t border-gray-100">
                {renderCategoryAttributes(category)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
