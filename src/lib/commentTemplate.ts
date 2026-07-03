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

  let placeholderCount = 0;
  let filledCount = 0;

  const result = template.replace(/\{(\w+)\}/g, (_, slug: string) => {
    placeholderCount++;
    const defId = slugToDefId.get(slug);
    const attrVal = defId ? attributeValues.get(defId) : undefined;
    if (attrVal?.value == null || attrVal.value === '') return '';
    filledCount++;
    return String(attrVal.value);
  });

  // Template has placeholders but none resolved to a value — literal separators
  // (e.g. "/") would otherwise survive the trim and produce a junk comment.
  if (placeholderCount > 0 && filledCount === 0) return null;

  const trimmed = result.trim();
  return trimmed || null;
}
