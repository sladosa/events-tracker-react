import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AttributeDefinition, UUID } from '@/types';

interface UseAttributeDefinitionsReturn {
  attributes: AttributeDefinition[];
  attributesByCategory: Map<string, AttributeDefinition[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Dohvaća attribute definitions za listu kategorija.
 * Sortira po sort_order unutar svake kategorije.
 */
export function useAttributeDefinitions(categoryIds: UUID[]): UseAttributeDefinitionsReturn {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAttributes = useCallback(async () => {
    if (categoryIds.length === 0) {
      setAttributes([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('attribute_definitions')
        .select('id, user_id, category_id, name, slug, description, data_type, unit, is_required, default_value, validation_rules, sort_order, created_at, updated_at')
        .in('category_id', categoryIds)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setAttributes(data || []);
    } catch (err) {
      console.error('Error fetching attribute definitions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch attributes'));
    } finally {
      setLoading(false);
    }
  }, [categoryIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  // Grupiraj atribute po kategoriji
  const attributesByCategory = useMemo(() => {
    const map = new Map<string, AttributeDefinition[]>();
    for (const attr of attributes) {
      if (!attr.category_id) continue;
      const existing = map.get(attr.category_id) || [];
      map.set(attr.category_id, [...existing, attr]);
    }
    return map;
  }, [attributes]);

  return { attributes, attributesByCategory, loading, error, refetch: fetchAttributes };
}

/**
 * Dohvaća lookup vrijednosti za suggest/enum tipove.
 * Uključuje i template user vrijednosti.
 */
export function useLookupValues(lookupName: string, parentKey?: string | null): {
  values: string[];
  loading: boolean;
  error: Error | null;
} {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchValues = async () => {
      if (!lookupName) {
        setValues([]);
        return;
      }

      setLoading(true);
      try {
        let query = supabase
          .from('lookup_values')
          .select('value, sort_order')
          .eq('lookup_name', lookupName)
          .order('sort_order', { ascending: true });

        // Ako ima parent_key, filtriraj po njemu
        if (parentKey !== undefined) {
          if (parentKey === null) {
            query = query.is('parent_key', null);
          } else {
            query = query.eq('parent_key', parentKey);
          }
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        // Unique values, održavaj sort order
        const uniqueValues = [...new Set(data?.map(d => d.value) || [])];
        setValues(uniqueValues);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch lookup values'));
      } finally {
        setLoading(false);
      }
    };

    fetchValues();
  }, [lookupName, parentKey]);

  return { values, loading, error };
}

/**
 * Parsira opcije iz validation_rules.
 * Podržava:
 * - suggest: string[] (static options from Excel import)
 * - enum: string[] (fixed options)
 * - depends_on: { attribute_slug, options_map }
 */
export interface ParsedAttributeOptions {
  type: 'none' | 'suggest' | 'enum';
  options: string[];
  allowOther: boolean;
  dependsOn?: {
    attributeSlug: string;
    optionsMap: Record<string, string[]>;
  };
}

export function parseValidationRules(
  validationRules: AttributeDefinition['validation_rules']
): ParsedAttributeOptions {
  const result: ParsedAttributeOptions = {
    type: 'none',
    options: [],
    allowOther: true,
  };

  if (!validationRules) return result;

  // Handle string JSON (Supabase may return jsonb as string)
  let rules: Record<string, unknown>;
  if (typeof validationRules === 'string') {
    try {
      rules = JSON.parse(validationRules);
    } catch {
      console.warn('Failed to parse validation_rules:', validationRules);
      return result;
    }
  } else if (typeof validationRules === 'object' && validationRules !== null) {
    rules = validationRules as Record<string, unknown>;
  } else {
    return result;
  }

  // Check for type field (from V3 export)
  if ('type' in rules) {
    const vr = rules as {
      type?: string;
      suggest?: string[];
      enum?: string[];
      depends_on?: {
        attribute_slug: string;
        options_map: Record<string, string[]>;
      };
      allow_other?: boolean;
    };

    if (vr.type === 'suggest' && vr.suggest) {
      result.type = 'suggest';
      result.options = vr.suggest;
    } else if (vr.type === 'enum' && vr.enum) {
      result.type = 'enum';
      result.options = vr.enum;
      result.allowOther = false;
    }

    if (vr.depends_on) {
      result.dependsOn = {
        attributeSlug: vr.depends_on.attribute_slug,
        optionsMap: vr.depends_on.options_map,
      };
    }

    if (vr.allow_other !== undefined) {
      result.allowOther = vr.allow_other;
    }
  }

  // Check for dropdown field (from original format)
  if ('dropdown' in rules) {
    const dropdown = (rules as { dropdown?: { type?: string; options?: string[]; allow_custom?: boolean } }).dropdown;
    if (dropdown?.type === 'static' && dropdown.options) {
      result.type = 'suggest';
      result.options = dropdown.options;
    }
    if (dropdown?.allow_custom !== undefined) {
      result.allowOther = dropdown.allow_custom;
    }
  }

  return result;
}

/**
 * Dohvaća opcije za atribut uzimajući u obzir dependency.
 */
export function getOptionsForDependency(
  parsed: ParsedAttributeOptions,
  dependencyValue: string | null
): string[] {
  // Ako nema dependency ili dependency value, vrati defaultne opcije
  if (!parsed.dependsOn || !dependencyValue) {
    return parsed.options;
  }

  // Pronađi opcije za trenutnu dependency vrijednost
  const specificOptions = parsed.dependsOn.optionsMap[dependencyValue];
  if (specificOptions) {
    return specificOptions;
  }

  // Ako postoji wildcard (*), koristi te opcije
  const wildcardOptions = parsed.dependsOn.optionsMap['*'];
  if (wildcardOptions) {
    return wildcardOptions;
  }

  // Fallback na default opcije
  return parsed.options;
}
