-- ============================================================
-- 035_area_group_agg.sql — generic per-Area aggregation RPC
-- ============================================================
-- Spec: docs/OVERVIEW_TAB_SPEC.md §2.2 (why aggregation must live in Postgres),
--       §2.4 (read model + the three rules), §2.15 (roles, never domain names).
--
-- ⚠ File number: 034 is taken by 034_s107w_test_area.sql.
--
-- WHY THIS EXISTS
--   Overview tiles need sums over a whole Area. Pulling event_attributes into
--   the browser is not an option:
--     · PostgREST max-rows = 1000 truncates WITHOUT an error ⇒ silently wrong sums
--     · Financije alone is ~21k attribute rows today, ~65k after the full import
--       (S105 already killed PROD once with a statement timeout on this table)
--   So the sum happens here and the browser receives a handful of rows.
--
-- THE THREE RULES FROM §2.4 — none of them may be broken
--   1. SECURITY DEFINER bypasses RLS ⇒ the function checks access ITSELF.
--      app_can_read_area() below mirrors the areas_select policy (009_sharing.sql).
--      ⚠ If areas_select ever changes, change it here too.
--   2. P2 parent events are NEVER summed. Parents carry the same attributes as
--      the leaf (P1/P3), so summing both would double every amount. Two
--      independent guards: the category must be a leaf, and the event must have
--      no chain_key. Financije is a single L1 leaf so it has no parents today —
--      the guard is here so the next Area cannot get this wrong.
--   3. value_number is read directly. No text parsing, and never an ILIKE over
--      event_attributes (that is BUG-S103-ANYATTR — ILIKE is not leakproof, so
--      Postgres evaluates the RLS EXISTS over the whole table). Every attribute
--      lookup is keyed by attribute_definition_id.
--
-- NAMING: nothing in this file knows about money. The parameters are ROLES
--   (group / plus / minus / filter). The same function answers "balance per
--   account", "kcal per week" and "hours per project" — §2.15 test of generality.
--
-- DEVIATIONS FROM THE §2.4 SKETCH (deliberate, documented here)
--   a) p_filter_slug/p_filter_val (one pair) → p_filters jsonb (a list).
--      The Financije balance needs TWO conditions at once:
--        izvorplacanja IN (Racun)   AND   status NOT IN (Planiran)
--      (`Cash` was in that list until 2026-08-18 — see 037 and §2.10. It is
--      still TWO conditions, which is what this deviation is about.)
--      SALDO_MODEL_NALAZI.md §2.1 measured exactly that combination against the
--      bank (17/30 months to the cent). One pair cannot express it.
--   b) p_from added next to p_as_of. §2.17 defines the balance as
--        anchor + Σ(changes STRICTLY after the confirmation date)
--      so an exclusive lower bound is part of the model, not a convenience.
--
-- Run in Supabase SQL Editor: TEST first, then PROD. Idempotent.
-- ============================================================


-- ============================================================
-- 1. Access check — the first thing every RPC below calls
-- ============================================================
-- Mirrors "areas_select" (009_sharing.sql): owner, template user, or a
-- data_shares row for that area. SECURITY DEFINER so that it can see
-- data_shares rows regardless of the caller's own RLS view.
--
-- ⚠ NEVER use current_user here. Inside a SECURITY DEFINER function current_user
--   is the function OWNER, not the caller — a check on it would always pass and
--   silently disable the gate. Identity comes from the request JWT only.
--
-- The service_role branch is not a loophole: that key already bypasses RLS on
-- every table, so a holder can read event_attributes and sum it by hand. Denying
-- it here would protect nothing and would only block legitimate server-side use
-- (Netlify functions, the verification tools in data-prep_tools/).

CREATE OR REPLACE FUNCTION public.app_can_read_area(p_area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- nullif('') before the cast: the setting is absent in the SQL Editor and can
  -- be an empty string elsewhere, and ''::jsonb raises instead of returning NULL.
  SELECT
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ) = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.areas a
    WHERE a.id = p_area_id
      AND (
        a.user_id = auth.uid()
        -- template user: its Areas are readable by everyone (see areas_select)
        OR a.user_id = 'be785f09-b7c6-497f-b351-363d224c93c8'::uuid
        OR EXISTS (
          SELECT 1 FROM public.data_shares ds
          WHERE ds.target_id  = a.id
            AND ds.share_type = 'area'
            AND (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())
        )
      )
  );
$$;

COMMENT ON FUNCTION public.app_can_read_area(uuid) IS
  'True when the caller may read this Area (service_role, owner, template user, or a data_shares row). Mirrors the areas_select RLS policy; keep the two in sync.';


-- ============================================================
-- 2. Slug validation — shared by every RPC that takes slugs
-- ============================================================
-- A slug that resolves to nothing is a configuration bug: a typo, or a rename
-- that did not fix up dashboard.widgets[] (the S105d class, §2.15). Raise —
-- never return 0. Silence is the failure mode this codebase keeps getting bitten
-- by (excelImport.ts skips unknown attribute names without a word), and a tile
-- that shows 0,00 instead of the balance is that same bug with worse consequences.

CREATE OR REPLACE FUNCTION public.app_slug_count(
  p_area_id uuid,
  p_slug    text,
  p_numeric boolean DEFAULT false
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer
  FROM public.attribute_definitions ad
  JOIN public.categories c ON c.id = ad.category_id
  WHERE c.area_id = p_area_id
    AND ad.slug = p_slug
    AND (NOT p_numeric OR ad.data_type = 'number');
$$;

CREATE OR REPLACE FUNCTION public.app_assert_slugs(
  p_area_id    uuid,
  p_group_slug text,
  p_plus_slug  text,
  p_minus_slug text,
  p_filters    jsonb
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slug text;
  v_op   text;
BEGIN
  IF p_group_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_group_slug) = 0 THEN
    RAISE EXCEPTION 'Group attribute slug "%" not found in area %', p_group_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;

  -- plus/minus must be numeric: rule 3 reads value_number, so a text attribute
  -- would silently sum to zero instead of failing
  IF p_plus_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_plus_slug, true) = 0 THEN
    RAISE EXCEPTION 'Plus attribute slug "%" not found in area % as a number', p_plus_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;

  IF p_minus_slug IS NOT NULL AND public.app_slug_count(p_area_id, p_minus_slug, true) = 0 THEN
    RAISE EXCEPTION 'Minus attribute slug "%" not found in area % as a number', p_minus_slug, p_area_id
      USING ERRCODE = '22023';
  END IF;

  FOR v_slug, v_op IN
    SELECT elem->>'slug', lower(coalesce(elem->>'op', 'in'))
    FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) elem
  LOOP
    IF v_op NOT IN ('in', 'not_in') THEN
      RAISE EXCEPTION 'Unsupported filter op "%" (v1 knows in / not_in)', v_op
        USING ERRCODE = '22023';
    END IF;
    IF v_slug IS NULL OR public.app_slug_count(p_area_id, v_slug) = 0 THEN
      RAISE EXCEPTION 'Filter attribute slug "%" not found in area %', v_slug, p_area_id
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;


-- ============================================================
-- 3. Internal row source — shared by every aggregate
-- ============================================================
-- One row per ELIGIBLE event, with its group value and its plus/minus numbers
-- already resolved. No date filtering here on purpose: the anchored balance
-- (036) needs a PER-GROUP lower bound, which cannot be a scalar parameter.
--
-- ⚠ SECURITY INVOKER on purpose, and that is what makes it safe both ways:
--     · called from a SECURITY DEFINER wrapper → runs as the function owner,
--       RLS bypassed, access already checked by the wrapper
--     · called directly by a user → runs as that user, RLS applies normally
--   EXECUTE is revoked from anon/authenticated anyway (section 6).
--
-- p_filters: jsonb array, each element
--     { "slug": "<attribute slug>", "op": "in" | "not_in", "values": ["a","b"] }
--   Semantics chosen to match the verified Python model exactly:
--     in     → event HAS a value for that attribute and it is in the list
--     not_in → event has NO value for that attribute in the list; an event with
--              no value at all passes, same as Python's `'' != 'Planiran'`

CREATE OR REPLACE FUNCTION public.area_agg_rows(
  p_area_id    uuid,
  p_group_slug text  DEFAULT NULL,
  p_plus_slug  text  DEFAULT NULL,
  p_minus_slug text  DEFAULT NULL,
  p_filters    jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  event_id    uuid,
  event_date  date,
  group_value text,
  plus_val    numeric,
  minus_val   numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH
  -- slug → attribute_definition ids inside THIS area.
  -- P1 allows the same slug on several category levels, hence a set, not one id.
  defs AS (
    SELECT ad.id, ad.slug, ad.data_type
    FROM public.attribute_definitions ad
    JOIN public.categories c ON c.id = ad.category_id
    WHERE c.area_id = p_area_id
  ),
  group_defs AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_group_slug),
  plus_defs  AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_plus_slug  AND data_type = 'number'),
  minus_defs AS (SELECT array_agg(id) AS ids FROM defs WHERE slug = p_minus_slug AND data_type = 'number'),
  -- filter list, each slug resolved to its definition ids
  fdef AS (
    SELECT
      lower(coalesce(elem->>'op', 'in')) AS op,
      ARRAY(SELECT jsonb_array_elements_text(elem->'values')) AS vals,
      ARRAY(SELECT d.id FROM defs d WHERE d.slug = elem->>'slug') AS def_ids
    FROM jsonb_array_elements(coalesce(p_filters, '[]'::jsonb)) AS elem
  ),
  elig AS (
    SELECT e.id, e.event_date
    FROM public.events e
    JOIN public.categories c ON c.id = e.category_id
    WHERE c.area_id = p_area_id
      -- rule 2, guard A: leaf categories only
      AND NOT EXISTS (SELECT 1 FROM public.categories ch WHERE ch.parent_category_id = c.id)
      -- rule 2, guard B: chain_key is set on parent events only
      AND e.chain_key IS NULL
      -- attribute filters (bool_and over an empty set is NULL ⇒ coalesce to true)
      AND coalesce((
        SELECT bool_and(CASE WHEN fd.op = 'not_in' THEN NOT hit.v ELSE hit.v END)
        FROM fdef fd
        CROSS JOIN LATERAL (
          SELECT EXISTS (
            SELECT 1 FROM public.event_attributes ea
            WHERE ea.event_id = e.id
              AND ea.attribute_definition_id = ANY (fd.def_ids)   -- rule 3
              AND ea.value_text = ANY (fd.vals)
          )
        ) AS hit(v)
      ), true)
  )
  SELECT e.id, e.event_date, g.v, p.v, m.v
  FROM elig e
  -- LEFT JOIN, never INNER: an event without a group value must stay visible as
  -- a NULL group rather than vanish from the total.
  LEFT JOIN LATERAL (
    SELECT coalesce(
             ea.value_text,
             ea.value_number::text,
             to_char(ea.value_datetime, 'YYYY-MM-DD'),
             ea.value_boolean::text
           ) AS v
    FROM public.event_attributes ea, group_defs gd
    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (gd.ids)
    LIMIT 1
  ) g ON true
  LEFT JOIN LATERAL (
    SELECT ea.value_number AS v
    FROM public.event_attributes ea, plus_defs pd
    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (pd.ids)
    LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT ea.value_number AS v
    FROM public.event_attributes ea, minus_defs md
    WHERE ea.event_id = e.id AND ea.attribute_definition_id = ANY (md.ids)
    LIMIT 1
  ) m ON true;
$$;

COMMENT ON FUNCTION public.area_agg_rows(uuid, text, text, text, jsonb) IS
  'Internal row source for the Overview aggregates. Not for direct client use — EXECUTE is revoked.';


-- ============================================================
-- 4. rpc_area_group_agg — the public aggregate (§2.4)
-- ============================================================
-- Covers the `balance_by_group` and `breakdown` tile types.
--   p_from   exclusive lower bound  (event_date >  p_from)   NULL = no bound
--   p_as_of  inclusive upper bound  (event_date <= p_as_of)  NULL = no bound
--   n        number of ELIGIBLE EVENTS in the group, including events that carry
--            no amount. It is a row count, not a "rows that moved money" count;
--            the tile must label it accordingly.

CREATE OR REPLACE FUNCTION public.rpc_area_group_agg(
  p_area_id    uuid,
  p_group_slug text  DEFAULT NULL,
  p_plus_slug  text  DEFAULT NULL,
  p_minus_slug text  DEFAULT NULL,
  p_filters    jsonb DEFAULT '[]'::jsonb,
  p_from       date  DEFAULT NULL,
  p_as_of      date  DEFAULT NULL
)
RETURNS TABLE (
  group_value text,
  plus_sum    numeric,
  minus_sum   numeric,
  n           integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- rule 1 — this function bypasses RLS, so it must gate itself
  IF NOT public.app_can_read_area(p_area_id) THEN
    RAISE EXCEPTION 'No access to area %', p_area_id USING ERRCODE = '42501';
  END IF;

  PERFORM public.app_assert_slugs(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters);

  RETURN QUERY
  SELECT r.group_value,
         coalesce(sum(r.plus_val), 0)::numeric,
         coalesce(sum(r.minus_val), 0)::numeric,
         count(*)::integer
  FROM public.area_agg_rows(p_area_id, p_group_slug, p_plus_slug, p_minus_slug, p_filters) r
  WHERE (p_from  IS NULL OR r.event_date >  p_from)
    AND (p_as_of IS NULL OR r.event_date <= p_as_of)
  GROUP BY r.group_value
  ORDER BY r.group_value NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.rpc_area_group_agg(uuid, text, text, text, jsonb, date, date) IS
  'Overview: sum plus/minus per group value for one Area. Checks area access itself (SECURITY DEFINER).';


-- ============================================================
-- 5. Grants
-- ============================================================
-- Postgres grants EXECUTE to PUBLIC on every new function, and Supabase adds
-- anon/authenticated on top via default privileges. The three helpers below have
-- no access gate of their own (their callers do the gating), so all three must
-- be taken away explicitly — PUBLIC alone is not enough.
REVOKE ALL ON FUNCTION public.area_agg_rows(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_assert_slugs(uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_slug_count(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.app_can_read_area(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_area_group_agg(uuid, text, text, text, jsonb, date, date) TO authenticated;


-- ============================================================
-- 6. Smoke test (read-only) — Financije_all on TEST
-- ============================================================
-- ⚠ auth.uid() is NULL under Role=postgres in the SQL Editor, so the RPC's
--   access check rejects a call made there. Query area_agg_rows directly to see
--   the numbers, or call the RPC from a signed-in client.
--
-- Executed balance per account — the §2.10 rule:
--   Izvor = Racun = money already left the account; Visa/Mastercard = still
--   planned; Cash = already gone via the ATM withdrawal, so never here (§2.10).
--
-- SELECT r.group_value,
--        round(sum(coalesce(r.plus_val, 0)), 2)                              AS uplata,
--        round(sum(coalesce(r.minus_val, 0)), 2)                             AS isplata,
--        round(sum(coalesce(r.plus_val, 0) - coalesce(r.minus_val, 0)), 2)   AS saldo,
--        count(*)                                                            AS n
-- FROM area_agg_rows(
--        '98dd91f3-de77-4619-9d08-d1ade604640a',   -- Financije_all (TEST)
--        'racun', 'uplata', 'isplata',
--        '[{"slug":"izvorplacanja","op":"in","values":["Racun","Cash"]},
--          {"slug":"status","op":"not_in","values":["Planiran"]}]'::jsonb) r
-- GROUP BY 1 ORDER BY 1;
