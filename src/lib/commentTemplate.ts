import type { AttributeDefinition, AreaSettings, CategorySettings } from '@/types/database';

/**
 * Resolve comment_template: leaf category override > area fallback > null.
 */
export function resolveCommentTemplate(
  areaSettings: AreaSettings | null | undefined,
  leafCategorySettings: CategorySettings | null | undefined,
): string | null {
  return leafCategorySettings?.comment_template
    ?? areaSettings?.comment_template
    ?? null;
}

/**
 * Evaluate a comment template by replacing {slug} placeholders with attribute values.
 * Returns null if template is empty or all placeholders resolve to empty strings.
 */
export function evaluateCommentTemplate(
  template: string,
  attributeValues: Map<string, { definitionId: string; value: unknown; touched?: boolean }>,
  attributeDefinitions: AttributeDefinition[],
): string | null {
  const slugToDefId = new Map<string, string>();
  for (const def of attributeDefinitions) {
    if (def.slug) slugToDefId.set(def.slug, def.id);
  }

  const result = template.replace(/\{(\w+)\}/g, (_, slug: string) => {
    const defId = slugToDefId.get(slug);
    if (!defId) return '';
    const attrVal = attributeValues.get(defId);
    if (attrVal?.value == null) return '';
    return String(attrVal.value);
  });

  const trimmed = result.trim();
  return trimmed || null;
}
