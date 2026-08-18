-- ============================================================
-- 036_balance_anchors.sql — confirmed balances (the anchor) + anchored sum
-- ============================================================
-- Spec: docs/OVERVIEW_TAB_SPEC.md §2.17 (the decision), §2.11 (the same anchor
--       seeds the `Provjera stanja` Excel column), §2.15 (why this is NOT in
--       areas.settings).
--
-- Requires 035_area_group_agg.sql (app_can_read_area, area_agg_rows).
--
-- WHAT AN ANCHOR IS
--   A human opened the bank app on day D and typed in what it said. That is the
--   highest-quality datum in the system — a person reading the source of truth,
--   not a machine inferring it. The balance is then
--
--       balance = anchor.amount + Σ(changes STRICTLY after anchor.confirmed_on)
--
--   and NOT a sum from the beginning of history. Two reasons, in order of weight:
--     · trust — the data has 13 residual months and 69 flagged rows
--       (SALDO_MODEL_NALAZI.md §3). A sum from 1.1.2023 would miss the bank, and
--       "the app is wrong, my spreadsheet is right" would be the correct reading.
--     · a discrepancy after an anchor is a search through a dozen rows instead of
--       a needle in 5.000.
--   Speed is NOT the reason — 5.000 events is nothing for Postgres.
--
-- ⚠ THE ANCHOR CARRIES ITS OWN DOUBLE-COUNTING RISK (§2.17, point 3) — the same
--   class as Racun vs Izvor. Rows dated ON or BEFORE confirmed_on must not enter
--   the sum. The rule is "strictly after", with no exception, and it is enforced
--   in one place: the join condition in rpc_area_balance_anchored below.
--
-- WHY A SEPARATE TABLE AND NOT areas.settings
--   areas.settings travels with the Area — Structure export, "From template".
--   Configuration may travel; a confirmed bank balance may not. Igor must not
--   inherit Koka's money. This is the first case of per-Area state that must NOT
--   travel, and it is the clean criterion for the §2.15 boundary.
--
-- HISTORY, NOT ONE VALUE
--   Every confirmation is a new row. It is cheap, it answers "since when do we
--   disagree", and it seeds the Excel `Provjera stanja` column (§2.11).
--   There is deliberately no UPDATE policy: a correction is a new row.
--
-- Run in Supabase SQL Editor: TEST first, then PROD. Idempotent.
-- ============================================================


-- ============================================================
-- 1. Table
-- ============================================================
-- (group_slug, group_value) rather than a widget id: an anchor belongs to the
-- THING that was confirmed ("racun" = "Kokin tekući ZABA"), so two tiles that
-- group by the same attribute correctly share one anchor.
--
-- ON DELETE CASCADE: 033_delete_area_cascade.sql deletes `areas` last, so the
-- cascade fires there without that script needing a new DELETE line.

CREATE TABLE IF NOT EXISTS public.balance_anchors (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id      uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  group_slug   text NOT NULL,
  group_value  text NOT NULL,
  amount       numeric NOT NULL,
  confirmed_on date NOT NULL,
  note         text,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.balance_anchors IS
  'Confirmed balance per group value, typed in by a human reading the bank app. Append-only history; the balance is anchor + changes strictly after confirmed_on. Never travels with the Area (see OVERVIEW_TAB_SPEC §2.17).';

-- lookup is always "latest anchor for this group at or before a date"
CREATE INDEX IF NOT EXISTS idx_balance_anchors_lookup
  ON public.balance_anchors (area_id, group_slug, group_value, confirmed_on DESC, created_at DESC);


-- ============================================================
-- 2. Write access check
-- ============================================================
-- Stricter than events_insert (which is only `user_id = auth.uid()`, S43, with
-- grantee write enforced in the app). The anchor DEFINES the headline number, so
-- a read-only grantee must not be able to set it.

CREATE OR REPLACE FUNCTION public.app_can_write_area(p_area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.areas a
    WHERE a.id = p_area_id
      AND (
        a.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.data_shares ds
          WHERE ds.target_id  = a.id
            AND ds.share_type = 'area'
            AND ds.permission = 'write'
            AND ds.grantee_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_can_write_area(uuid) TO authenticated;


-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.balance_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_anchors_select" ON public.balance_anchors;
CREATE POLICY "balance_anchors_select" ON public.balance_anchors FOR SELECT
USING (public.app_can_read_area(area_id));

DROP POLICY IF EXISTS "balance_anchors_insert" ON public.balance_anchors;
CREATE POLICY "balance_anchors_insert" ON public.balance_anchors FOR INSERT
WITH CHECK (created_by = auth.uid() AND public.app_can_write_area(area_id));

-- No UPDATE policy on purpose — a correction is a new row (history, §2.17).

DROP POLICY IF EXISTS "balance_anchors_delete" ON public.balance_anchors;
CREATE POLICY "balance_anchors_delete" ON public.balance_anchors FOR DELETE
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.areas a WHERE a.id = area_id AND a.user_id = auth.uid())
);


-- ============================================================
-- 4. rpc_area_balance_anchored — the number the tile shows
-- ============================================================
-- Per group value:
--   anchored = false → no confirmation yet ⇒ the sum runs over the WHOLE history
--              and the tile MUST say so ("od početka podataka", §2.17 point 4).
--              Never silently.
--   anchored = true  → balance = anchor_amount + Σ(strictly after anchor_on)
--
-- Groups that have an anchor but no movement since still appear (FULL OUTER
-- JOIN): "confirmed 1.240,00 and nothing happened" is an answer, not an absence.
--
-- p_as_of picks the latest anchor confirmed ON OR BEFORE that date, so
-- "balance as of X" stays consistent — an anchor from after X cannot be used
-- without subtracting, which v1 does not do.
--
-- ⚠ Which date the comparison uses: event_date. For everything that actually
--   moves a balance (Izvor = Racun) D1b makes `Datum naplate` equal to
--   event_date, and the Python model that was validated against the bank uses
--   event_date too. Rows whose charge lands later (Visa/Mastercard) are not in
--   the executed bucket at all — they are the "+ planirano" number.

CREATE OR REPLACE FUNCTION public.rpc_area_balance_anchored(
  p_area_id    uuid,
  p_group_slug text,
  p_plus_slug  text  DEFAULT NULL,
  p_minus_slug text  DEFAULT NULL,
  p_filters    jsonb DEFAULT '[]'::jsonb,
  p_as_of      date  DEFAULT NULL
)
RETURNS TABLE (
  group_value   text,
  anchored      boolean,
  anchor_amount numeric,
  anchor_on     date,
  plus_sum      numeric,
  minus_sum     numeric,
  n             integer,
  balance       numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.app_can_read_area(p_area_id) THEN
    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';
  END IF;

  PERFORM public.app_assert_slugs(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters);

  RETURN QUERY
  WITH anchors AS (
    SELECT DISTINCT ON (ba.group_value)
           ba.group_value, ba.amount, ba.confirmed_on
    FROM public.balance_anchors ba
    WHERE ba.area_id    = p_area_id
      AND ba.group_slug = p_group_slug
      AND (p_as_of IS NULL OR ba.confirmed_on <= p_as_of)
    ORDER BY ba.group_value, ba.confirmed_on DESC, ba.created_at DESC
  ),
  counted AS (
    SELECT r.group_value,
           coalesce(sum(r.plus_val), 0)  AS plus_sum,
           coalesce(sum(r.minus_val), 0) AS minus_sum,
           count(*)::integer             AS n
    FROM public.area_agg_rows(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters) r
    LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM r.group_value
    WHERE (p_as_of IS NULL OR r.event_date <= p_as_of)
      -- §2.17 point 3: STRICTLY after, no exception
      AND (a.confirmed_on IS NULL OR r.event_date > a.confirmed_on)
    GROUP BY r.group_value
  ),
  -- The group set is the UNION of "had movement" and "has an anchor" — an
  -- account confirmed at 1.240,00 with nothing since is an answer, not an
  -- absence, so it must not drop out.
  --
  -- ⚠ Built as UNION + two LEFT JOINs rather than the obvious FULL OUTER JOIN:
  --   Postgres rejects a FULL JOIN whose condition is not merge/hash-joinable,
  --   and `IS NOT DISTINCT FROM` (needed so a NULL group matches a NULL group)
  --   is exactly such a condition. UNION already treats NULLs as equal.
  keys AS (
    SELECT c.group_value FROM counted c
    UNION
    SELECT a.group_value FROM anchors a
  )
  SELECT
    k.group_value,
    a.confirmed_on IS NOT NULL,
    a.amount,
    a.confirmed_on,
    coalesce(c.plus_sum, 0),
    coalesce(c.minus_sum, 0),
    coalesce(c.n, 0),
    coalesce(a.amount, 0) + coalesce(c.plus_sum, 0) - coalesce(c.minus_sum, 0)
  FROM keys k
  LEFT JOIN counted c ON c.group_value IS NOT DISTINCT FROM k.group_value
  LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM k.group_value
  ORDER BY k.group_value NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_balance_anchored(uuid, text, text, text, jsonb, date) IS
  'Overview balance tile: confirmed anchor + movement strictly after it, per group value. Checks area access itself.';

GRANT EXECUTE ON FUNCTION public.rpc_area_balance_anchored(uuid, text, text, text, jsonb, date) TO authenticated;


-- ============================================================
-- 5. Smoke test (read-only)
-- ============================================================
-- Anchors on TEST for Financije_all:
-- SELECT group_slug, group_value, amount, confirmed_on, created_at
-- FROM balance_anchors
-- WHERE area_id = '98dd91f3-de77-4619-9d08-d1ade604640a'
-- ORDER BY group_value, confirmed_on DESC;
--
-- Adding one (from the app, or here with an explicit created_by):
-- INSERT INTO balance_anchors (area_id, group_slug, group_value, amount, confirmed_on, created_by)
-- VALUES ('98dd91f3-de77-4619-9d08-d1ade604640a', 'racun', 'Kokin tekući ZABA',
--         1234.56, '2026-08-15', 'b2d151c3-7bc7-431d-b6f1-faa841b50707');
