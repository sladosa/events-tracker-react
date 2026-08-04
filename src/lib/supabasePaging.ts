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
