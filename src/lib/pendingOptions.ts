/**
 * pendingOptions.ts — opcije upisane kroz „Other" u Add/Edit formi idu u
 * `validation_rules`, da ih dropdown iduci put ponudi.
 *
 * Do S152 je ova funkcija postojala DVAPUT (Add i Edit, doslovne kopije) i
 * pravilo je gradila iz parsiranog oblika — pa je brisala `default_map` i
 * `hidden_in_add`. Sada je jedna i mijenja samo popis opcija
 * (v. `addOptionToRules`).
 */
import { supabase } from '@/lib/supabaseClient';
import { parseValidationRules } from '@/hooks/useAttributeDefinitions';
import { addOptionToRules } from '@/lib/validationRules';
import type { AttributeDefinition } from '@/types';

export async function persistPendingOptions(
  options: Array<{ definitionId: string; newOption: string; dependencyValue?: string | null }>,
  attrDefs: AttributeDefinition[],
): Promise<void> {
  // Zadnje pravilo po atributu — vise novih opcija za isti atribut se zbraja
  // (svaka iteracija krece od prethodnog rezultata, ne od stare snimke).
  const latestRules = new Map<string, AttributeDefinition['validation_rules']>();

  for (const pending of options) {
    const def = attrDefs.find(d => d.id === pending.definitionId);
    if (!def) continue;

    const currentRules = latestRules.get(pending.definitionId) ?? def.validation_rules;
    const updatedRules = addOptionToRules(
      currentRules,
      pending.newOption,
      pending.dependencyValue ?? null,
      parseValidationRules(currentRules).options,
    );
    if (!updatedRules) continue;

    const { data, error } = await supabase
      .from('attribute_definitions')
      .update({ validation_rules: updatedRules })
      .eq('id', pending.definitionId)
      .select('id');

    if (error) {
      console.error('[persistPendingOptions] Failed:', error);
    } else if (!data || data.length === 0) {
      // RLS-blokiran UPDATE „uspije" s 0 redaka (grantee ne smije mijenjati
      // strukturu tudje Aree, S134). Vrijednost je spremljena na retku; samo
      // je dropdown nece nuditi.
      console.warn('[persistPendingOptions] 0 rows updated (no permission?):', def.slug);
    } else {
      latestRules.set(pending.definitionId, updatedRules as AttributeDefinition['validation_rules']);
    }
  }
}
