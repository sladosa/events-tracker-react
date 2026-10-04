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

/**
 * S160: recenica koja grantee-ju zamjenjuje „Other..." (Sasina odluka:
 * opcije su struktura Aree, a struktura je vlasnikova — S133). Jedna kopija
 * za Add i Edit. `null` = korisnik smije dodavati opcije.
 */
export function noNewOptionsHintFor(
  shared: { ownerDisplayName?: string; ownerEmail?: string } | null | undefined,
): string | null {
  if (!shared) return null;
  const who = shared.ownerDisplayName || shared.ownerEmail || 'vlasnik Aree';
  return `Nova opcija? Dodaje je vlasnik Aree (${who})`;
}

/** Opcije koje NISU upisane (greska ili RLS 0 redaka) — pozivatelj ih kaze naglas. */
export async function persistPendingOptions(
  options: Array<{ definitionId: string; newOption: string; dependencyValue?: string | null }>,
  attrDefs: AttributeDefinition[],
): Promise<string[]> {
  const failed: string[] = [];
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
      failed.push(pending.newOption);
    } else if (!data || data.length === 0) {
      // RLS-blokiran UPDATE „uspije" s 0 redaka (grantee ne smije mijenjati
      // strukturu tudje Aree, S134). Vrijednost je spremljena na retku; samo
      // je dropdown nece nuditi.
      // ⚠ S160: do tada samo konzola — tihi neuspjeh; sada ga pozivatelj kaze.
      console.warn('[persistPendingOptions] 0 rows updated (no permission?):', def.slug);
      failed.push(pending.newOption);
    } else {
      latestRules.set(pending.definitionId, updatedRules as AttributeDefinition['validation_rules']);
    }
  }
  return failed;
}

/** Poruka za opcije koje nisu usle u izbornik (vrijednost na retku jest spremljena). */
export function failedOptionsMessage(failed: string[]): string | null {
  if (failed.length === 0) return null;
  return `${failed.map(f => `„${f}"`).join(', ')} je spremljeno na retku, ali NIJE dodano u izbornik `
    + `— opcije dodaje vlasnik Aree.`;
}
