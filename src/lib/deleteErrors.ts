// ============================================================
// deleteErrors.ts
// ============================================================
// Turns a raw Postgres/PostgREST failure from the Structure cascade delete
// into something a user can act on.
//
// The cascade runs through the client, so every SELECT/DELETE it issues is
// filtered by RLS. That produces failures whose raw text says nothing about
// the actual situation — the common one being a foreign key violation on
// `events`, which really means "this Area holds rows you are not allowed to
// see, so they were never deleted".
//
// classifyDeleteError() keeps the technical string (rendered behind a
// "Technical details" toggle) and adds a plain-language title, an explanation
// and concrete next steps.
// ============================================================

/** Postgres error fields as PostgREST returns them. */
export interface PgErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/** Error thrown by a single step of the cascade, carrying the raw PG fields. */
export class DeleteStepError extends Error {
  step: string;
  pg: PgErrorLike;

  constructor(step: string, pg: PgErrorLike, message: string) {
    super(message);
    this.name = 'DeleteStepError';
    this.step = step;
    this.pg = pg;
  }
}

/**
 * Thrown when a DELETE that must have removed a row reports zero rows.
 * RLS makes a forbidden DELETE succeed-with-nothing rather than error, so a
 * non-owner would otherwise see "deleted" while nothing changed.
 */
export class SilentNoOp extends Error {
  constructor() {
    super('DELETE affected 0 rows');
    this.name = 'SilentNoOp';
  }
}

export interface DeleteErrorInfo {
  /** Short headline, e.g. "Some records belong to another user". */
  title: string;
  /** One or two sentences on what actually happened. */
  explanation: string;
  /** Concrete next steps, rendered as a list. Can be empty. */
  actions: string[];
  /** Raw error text, shown only when the user expands the details. */
  technical: string;
}

const CONSTRAINT_LABELS: Record<string, string> = {
  event_attributes_event_id_fkey: 'attribute values',
  event_attachments_event_id_fkey: 'attachments',
  events_category_id_fkey: 'activity records',
  categories_area_id_fkey: 'categories',
  attribute_definitions_category_id_fkey: 'attribute definitions',
};

function rawText(err: unknown): string {
  if (err instanceof DeleteStepError) {
    const { code, message, details, hint } = err.pg;
    const parts = [code, message, details, hint].filter(Boolean).join(' — ');
    return `[${err.step}] ${parts || err.message}`;
  }
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Map a cascade-delete failure onto a user-facing explanation. */
export function classifyDeleteError(err: unknown, nodeLabel = 'this item'): DeleteErrorInfo {
  if (err instanceof SilentNoOp) return silentNoOpError(nodeLabel);

  const technical = rawText(err);
  const pg: PgErrorLike = err instanceof DeleteStepError ? err.pg : {};
  const code = pg.code ?? '';
  const haystack = `${pg.message ?? ''} ${pg.details ?? ''} ${technical}`;

  // ── Foreign key violation: child rows survived the cascade ────────────────
  // Almost always RLS: the cascade deleted only the rows the current account
  // can see, then the parent DELETE tripped over the ones it could not.
  if (code === '23503' || /violates foreign key constraint/i.test(haystack)) {
    const constraint = Object.keys(CONSTRAINT_LABELS)
      .find(name => haystack.includes(name));
    const what = constraint ? CONSTRAINT_LABELS[constraint] : 'related records';

    return {
      title: 'Some records could not be removed',
      explanation:
        `${nodeLabel} still contains ${what} that your account is not allowed to see — ` +
        'typically data entered by another user who once had access to this Area. ' +
        'Everything visible to you was deleted, but those hidden rows remain, so the ' +
        'delete could not finish.',
      actions: [
        'If this Area is or was shared, ask that person to remove their records first — or revoke their access and take over their data.',
        'Nothing is lost: the Area and the remaining records are still intact.',
        'If you need it gone regardless, it has to be deleted directly in the database (sql/033_delete_area_cascade.sql).',
      ],
      technical,
    };
  }

  // ── Trigger guard on categories ───────────────────────────────────────────
  if (code === 'P0001') {
    return {
      title: 'The database refused the delete',
      explanation:
        'A safety rule in the database stopped the delete — usually because activity ' +
        'records still exist under this structure, including records your account cannot see.',
      actions: [
        'Reload the page and try again — the count shown may be out of date.',
        'If it keeps failing, the Area holds records belonging to another user (see sql/033_delete_area_cascade.sql).',
      ],
      technical,
    };
  }

  // ── Permission ────────────────────────────────────────────────────────────
  if (code === '42501' || /permission denied|row-level security/i.test(haystack)) {
    return {
      title: 'You are not allowed to delete this',
      explanation:
        `You are not the owner of ${nodeLabel}. Only the owner of an Area can delete it ` +
        'or anything inside it.',
      actions: [
        'Ask the owner to delete it.',
        'If you only want it out of your own list, remove your access to the Area instead.',
      ],
      technical,
    };
  }

  // ── Expired session ───────────────────────────────────────────────────────
  if (code === 'PGRST301' || /jwt|token .*expired|401/i.test(haystack)) {
    return {
      title: 'Your session expired',
      explanation:
        'You were signed out while the delete was running, so the database rejected it. ' +
        'Nothing was changed beyond what had already been deleted.',
      actions: ['Reload the page, sign in again, and retry.'],
      technical,
    };
  }

  // ── Network ───────────────────────────────────────────────────────────────
  if (err instanceof TypeError || /failed to fetch|network|offline/i.test(haystack)) {
    return {
      title: 'Could not reach the server',
      explanation:
        'The connection dropped during the delete. Part of the data may already be removed.',
      actions: [
        'Check your connection, reload the page, and look at the Area before retrying.',
      ],
      technical,
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    title: 'Delete failed',
    explanation: `${nodeLabel} could not be deleted. The details below say why.`,
    actions: ['Reload the page and try again.'],
    technical,
  };
}

/**
 * RLS makes a forbidden DELETE succeed with zero rows affected instead of
 * erroring, so a non-owner would otherwise see "deleted" while nothing changed.
 * Call this when a delete that must have removed a row reports none.
 */
export function silentNoOpError(nodeLabel: string): DeleteErrorInfo {
  return {
    title: 'Nothing was deleted',
    explanation:
      `The database accepted the request but removed no rows, which means your account ` +
      `is not allowed to delete ${nodeLabel}. Only the owner can delete an Area.`,
    actions: [
      'Check who owns this Area and ask them to delete it.',
      'If you believe you are the owner, reload the page and try again.',
    ],
    technical: 'DELETE affected 0 rows (blocked by row-level security).',
  };
}
