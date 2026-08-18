-- ============================================================
-- 038_balance_last_on.sql — "as of when is this number actually true?"
-- ============================================================
-- Spec: docs/OVERVIEW_TAB_SPEC.md §2.10, §2.17 (the anchor and its honesty rules)
--
-- Requires 035 + 036. Idempotent.
--
-- WHY
--   The tile answers the question the user asked ("na dan 18.08.2026.") but has
--   no way to say how much of that window it can actually speak for. On
--   2026-08-18 the RF account showed a headline number whose newest underlying
--   record was 2026-07-10 — 39 days old, rendered as if it were today's.
--
--   That is the same family as the two rules the tile already enforces:
--     * never show a from-the-beginning sum as if it were a bank figure (§2.17)
--     * whenever asOf is set, SAY so — a past number must not look like the
--       present one (S109)
--   Both are about not letting the presentation claim more than the data holds.
--   Freshness was the third face of it and was missing. (Saša, 2026-08-18.)
--
-- WHAT `last_on` MEANS — exactly
--   The newest `event_date` among the rows that ACTUALLY ENTERED this balance:
--   inside the as-of window, strictly after the anchor, and passing p_filters.
--   So for Financije it is "the last movement that moved the account", not "the
--   last row typed into the Area" — a card purchase sitting in "+ planirano"
--   deliberately does NOT refresh it, because it has not moved the balance.
--
--   NULL means the group has an anchor and nothing after it. That is an answer
--   ("confirmed, nothing since"), not an absence — same reasoning as the
--   UNION of counted+anchors in 036.
--
-- ⚠ RETURN TYPE CHANGES ⇒ `CREATE OR REPLACE` IS NOT ENOUGH
--   Postgres refuses to replace a function whose OUT columns differ
--   ("cannot change return type of existing function"). The DROP below is
--   required, and it is why this is a new file rather than an edit of 036.
--   The argument list is unchanged, so nothing that calls it needs to change
--   its signature — only the extra column has to be read.
--
-- Run in Supabase SQL Editor: TEST first, then PROD.
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_area_balance_anchored(uuid, text, text, text, jsonb, date);

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
  balance       numeric,
  last_on       date        -- NEW (038): newest event_date that entered the sum
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY DEFINER must check access itself, or it leaks the whole database
  -- through one RPC (035 §2). Unchanged from 036.
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
           count(*)::integer             AS n,
           -- 038: same WHERE, so this can only ever describe rows that are in
           -- the number above. Deriving it anywhere else would let the two
           -- drift apart, which is exactly the failure this column exists for.
           max(r.event_date)             AS last_on
    FROM public.area_agg_rows(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters) r
    LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM r.group_value
    WHERE (p_as_of IS NULL OR r.event_date <= p_as_of)
      -- §2.17 point 3: STRICTLY after, no exception
      AND (a.confirmed_on IS NULL OR r.event_date > a.confirmed_on)
    GROUP BY r.group_value
  ),
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
    coalesce(a.amount, 0) + coalesce(c.plus_sum, 0) - coalesce(c.minus_sum, 0),
    c.last_on                       -- NULL when nothing moved since the anchor
  FROM keys k
  LEFT JOIN counted c ON c.group_value IS NOT DISTINCT FROM k.group_value
  LEFT JOIN anchors a ON a.group_value IS NOT DISTINCT FROM k.group_value
  ORDER BY k.group_value NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_balance_anchored(uuid, text, text, text, jsonb, date) IS
  'Overview balance tile: confirmed anchor + movement strictly after it, per group value, plus last_on = newest event_date that entered the sum. Checks area access itself.';

GRANT EXECUTE ON FUNCTION public.rpc_area_balance_anchored(uuid, text, text, text, jsonb, date) TO authenticated;


-- ============================================================
-- Smoke test (read-only) — Financije_all on TEST
-- ============================================================
-- Expect, on 2026-08-18 with no date filter: RF `last_on` = 2026-07-10 while
-- the question is "today" — i.e. the number is 39 days stale and now says so.
--
-- SELECT group_value, balance, n, anchor_on, last_on
-- FROM rpc_area_balance_anchored(
--        '98dd91f3-de77-4619-9d08-d1ade604640a', 'racun', 'uplata', 'isplata',
--        '[{"slug":"izvorplacanja","op":"in","values":["Racun"]},
--          {"slug":"status","op":"not_in","values":["Planiran"]}]'::jsonb,
--        NULL)
-- ORDER BY group_value;
