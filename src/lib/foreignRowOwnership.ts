/**
 * Where do the foreign rows of an import file ACTUALLY live, and who owns that?
 *
 * ⚠ S159 (T-S159-4 failed live): both import offers — "Import as mine" (D5) and
 *   "Ispravi kao vlasnik Aree" (S125) — used to decide by Area NAME. On TEST the
 *   grantee `owner@test.com` owns an Area called `Health_Sasa` AND has write
 *   access to Saša's `Health_Sasa`, so a file of Saša's rows looked "owned":
 *   "Import as mine" stayed open (copies = duplicates in the shared Area) and
 *   "fix as owner" was offered for rows RLS would refuse. A name is not an
 *   identity — the rows' `event_id`s are. Same class as "Financije_all and
 *   Financije_old both have `Transakcija`" (S144).
 *
 * Three reads, all through RLS: events → categories → areas. A row the reader
 * cannot see (a stranger's file) is simply not found.
 */
import { supabase } from '@/lib/supabaseClient';
import { withRetryQuery } from '@/lib/retry';

export interface ForeignOwnership {
  /** Every representative row exists and lives in an Area the user owns.
   *  ⚠ The parser sends ONE row per (Area, Category_Path, author). A file that
   *  holds two same-named Areas under the same path is not told apart here —
   *  apply still has its own guards (RLS, counted rows). */
  allOwned: boolean;
  /** Name of a visible Area NOT owned by the user that holds some of those rows. */
  sharedArea: string | null;
  /** The check itself failed — callers must not read this as "all clear". */
  failed: boolean;
}

const CHUNK = 150; // ≤150 ids per request keeps the URL short and the reply under max-rows

export async function resolveForeignOwnership(
  eventIds: string[],
  userId: string,
): Promise<ForeignOwnership> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (ids.length === 0) return { allOwned: false, sharedArea: null, failed: false };

  try {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    const evRes = await Promise.all(chunks.map(c => withRetryQuery(() =>
      supabase.from('events').select('id, category_id').in('id', c))));
    const events = evRes.flatMap(r => (r.data ?? []) as { id: string; category_id: string }[]);

    const catIds = [...new Set(events.map(e => e.category_id))];
    const catRes = catIds.length
      ? await withRetryQuery(() => supabase.from('categories').select('id, area_id').in('id', catIds))
      : { data: [] };
    const areaOfCat = new Map(((catRes.data ?? []) as { id: string; area_id: string }[])
      .map(c => [c.id, c.area_id]));

    const areaIds = [...new Set([...areaOfCat.values()])];
    const areaRes = areaIds.length
      ? await withRetryQuery(() => supabase.from('areas').select('id, name, user_id').in('id', areaIds))
      : { data: [] };
    const areas = (areaRes.data ?? []) as { id: string; name: string; user_id: string | null }[];

    const foreignArea = areas.find(a => a.user_id !== userId) ?? null;
    const allOwned = events.length === ids.length
      && events.every(e => {
        const a = areas.find(x => x.id === areaOfCat.get(e.category_id));
        return !!a && a.user_id === userId;
      });
    return { allOwned, sharedArea: foreignArea?.name ?? null, failed: false };
  } catch (e) {
    console.error('resolveForeignOwnership failed', e);
    return { allOwned: false, sharedArea: null, failed: true };
  }
}
