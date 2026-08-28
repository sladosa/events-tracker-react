// ============================================================
// retry.ts — one more try before calling something absent
// ============================================================
// Written in S121 after BUG-S121-AREACTX. Saša opened the app on PROD and the
// Overview tab, the account abbreviations, the amounts and the "Write access"
// banner were all gone. Nothing was wrong with the data: `areas.settings` held
// every key, the share was active, the query answered in 0,18–0,27 s. A single
// read had failed, and two independent loaders had each turned that failure
// into "there is nothing here" — permanently, because neither retried and both
// only re-run when the Area changes. F5 brought everything back.
//
// The rule this exists to serve is already in CLAUDE.md: a missing field must
// never be read as "there is nothing". Retrying is the cheap half of honouring
// it; the other half is that the caller must SAY it failed instead of
// rendering a confident, wrong, emptier version of the app.
//
// ⚠ This masks a cause it does not cure. On PROD the likely trigger is the
//   S105 pattern — the free-tier instance stalling under load, same family as
//   the `57014` statement timeouts. The cure there is the Postgres upgrade.
//   Retrying is still right: a phone on a weak connection drops reads on any
//   plan.
// ============================================================

export interface RetryOptions {
  /** Total attempts, including the first. Default 3. */
  attempts?: number;
  /** Delay before the 2nd attempt, in ms; doubles each time. Default 300. */
  baseDelayMs?: number;
  /** Called before each retry — for logging, not control flow. */
  onRetry?: (attempt: number, error: unknown) => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run `fn` until it succeeds or the attempts run out.
 *
 * "Succeeds" is decided by `isFailure`, because Supabase does NOT reject on a
 * failed query — it resolves with `{ data, error }`. A plain try/catch around
 * `await supabase.from(...)` therefore catches nothing at all, which is exactly
 * how these failures stayed invisible.
 *
 * Throws the last error (or a generic one) when every attempt fails, so the
 * caller has to decide what to do rather than silently receiving an empty box.
 */
export async function withRetry<T>(
  // ⚠ PromiseLike, not Promise: a Supabase query builder is a thenable, not a
  //   real Promise, so `() => Promise<T>` refuses it at the call site.
  fn: () => PromiseLike<T>,
  isFailure: (result: T) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 300, onRetry } = options;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();
      if (!isFailure(result)) return result;
      lastError = (result as { error?: unknown })?.error ?? new Error('Query failed');
    } catch (e) {
      lastError = e;
    }

    if (attempt < attempts) {
      onRetry?.(attempt, lastError);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** `withRetry` for a Supabase query, where failure means a non-null `error`. */
export function withRetryQuery<T extends { error: unknown }>(
  fn: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  return withRetry<T>(fn, result => result.error != null, options);
}
