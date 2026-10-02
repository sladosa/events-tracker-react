/**
 * What the Help AI is told about the Area the user is standing in (B3).
 *
 * Until S159 the client sent only `areaId`, while the function built its
 * `area: <name>` line from `areaName` — so the line never reached the prompt,
 * and Help in `Fitness` happily explained balance anchors and delta sheets that
 * do not exist there.
 *
 * ⚠ This TELLS the AI where the user is; it never narrows which docs it reads.
 * Asking "how does the app compute a balance?" from any Area is legitimate, and
 * a capability list that denies an existing feature is worse than noise.
 *
 * Pure function, outside the panel, so the wording can be tested without React.
 */
import type { Area } from '@/types/database';
import type { SharedContext } from '@/hooks/useDataShares';

export interface HelpAreaContext {
  areaName: string | null;
  /** Short facts in plain English, one per configured mechanism. */
  areaFacts: string[];
}

export function describeAreaForHelp(
  area: Area | null,
  shared: SharedContext | null,
): HelpAreaContext {
  if (!area) return { areaName: null, areaFacts: [] };

  const s = area.settings ?? {};
  const facts: string[] = [];

  const widgets = s.dashboard?.widgets ?? [];
  if (widgets.length > 0) {
    facts.push(`has an Overview tab with ${widgets.length} tile(s) (balance by group, anchors, Δ)`);
  } else {
    facts.push('has NO Overview tab: no balance, no anchors, no delta sheet in this Area');
  }

  if ((s.list_columns?.columns?.length ?? 0) > 0) {
    facts.push('has custom Activities list columns');
  }

  const rules = s.automations?.attribute_rules?.length ?? 0;
  if (rules > 0) facts.push(`has ${rules} set_attribute automation rule(s)`);
  if (s.automations?.rata) facts.push('has the instalment (rata) modal after Finish');

  if (s.comment_template) facts.push('has an automatic comment template');
  if (s.disable_save_plus) facts.push('"Save +" is disabled in Add Activity');
  if (s.add_header?.date) facts.push('Add Activity shows a date picker instead of the stopwatch');

  if (shared) {
    facts.push(
      shared.permission === 'write'
        ? `is shared WITH the user by ${shared.ownerDisplayName} (write: may add and edit own records, may not change structure)`
        : `is shared WITH the user by ${shared.ownerDisplayName} (read-only)`,
    );
  }

  return { areaName: area.name, areaFacts: facts };
}
