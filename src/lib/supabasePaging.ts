// ============================================================
// supabasePaging.ts
// ============================================================
// PostgREST caps every response at the project's `max-rows` setting (1000 on
// this project) and reports NO error when it truncates — the array just stops.
// Any query that must return "all matching rows" has to page, or it silently
// works on a prefix of the data.
//
// That is not theoretical: the Structure cascade delete fetched the
// `event_attributes` of an Area, got the first 1000 of ~10 000, deleted those,
// and then tripped over the rest as a foreign key violation.
//
// `excelDataLoader.ts` already guards against the same cap by hand; this is the
// shared version for everything else.
// ============================================================

/** Rows requested per round trip. Kept at the server cap so pages are full. */
const PAGE = 1000;

export interface PagedResult<T> {
  data: T[];
  error: unknown | null;
}

/**
 * Run `page(from, to)` repeatedly until it stops returning rows.
 *
 * ⚠ THE QUERY YOU PASS MUST HAVE `.order(...)` ON A UNIQUE COLUMN.
 * Range paging without a stable sort is silently wrong: Postgres does not
 * promise the same row order across two queries, so rows overlap between pages
 * and are skipped at the same time. The result looks perfectly normal — it is
 * just missing rows, different ones each run.
 *
 * That is not hypothetical. A verification tool for the Overview RPC hit exactly
 * this (2026-08-15) and produced 45 "events with no attributes" on one run and
 * 49 different ones on the next; neither existed. Here the same bug is worse:
 * these callers page in order to DELETE, so a skipped row means the parent
 * delete trips the foreign key it was paging to avoid.
 *
 * This helper cannot add the order itself — it does not build the query.
 *
 * Advances by however many rows actually came back rather than by PAGE, so a
 * server cap lower than PAGE still pages correctly instead of stopping short.
 * That costs one extra empty request at the end — cheap next to reading a
 * partial result and believing it complete.
 *
 * On error the rows gathered so far are returned alongside it; callers that
 * must have everything should check `error` and bail.
 */
export async function fetchAllPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<PagedResult<T>> {
  const out: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: out, error };

    const rows = data ?? [];
    out.push(...rows);
    if (rows.length === 0) break;
    from += rows.length;
  }

  return { data: out, error: null };
}

/**
 * Same idea for `.in(column, values)` filters: PostgREST also has a URL length
 * limit, so the value list is split into chunks and each chunk is paged.
 */
export async function fetchAllPagedIn<T>(
  values: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  chunkSize = 100,
): Promise<PagedResult<T>> {
  const out: T[] = [];

  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const { data, error } = await fetchAllPaged<T>((from, to) => page(chunk, from, to));
    out.push(...data);
    if (error) return { data: out, error };
  }

  return { data: out, error: null };
}
