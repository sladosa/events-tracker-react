-- S103: Fix event_attr_select + event_attach_select RLS policies
-- Problem: IN (subquery) forces PostgreSQL to materialise all matching event IDs
--          before the filter, causing statement timeouts for grantees when there
--          is no attribute_definition_id pre-filter (e.g. "In any attribute").
-- Fix: EXISTS with correlated join — PostgreSQL short-circuits on first match,
--      and the query planner can use a nested-loop strategy that avoids the
--      full subquery materialisation.
--
-- Run on TEST then PROD in Supabase SQL Editor.

-- ── event_attributes ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "event_attr_select" ON public.event_attributes;

CREATE POLICY "event_attr_select" ON public.event_attributes FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.categories c  ON c.id  = e.category_id
    JOIN public.data_shares ds ON ds.target_id = c.area_id
    WHERE e.id = event_attributes.event_id
      AND ds.share_type = 'area'
      AND (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())
  )
);

-- ── event_attachments ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "event_attach_select" ON public.event_attachments;

CREATE POLICY "event_attach_select" ON public.event_attachments FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.categories c  ON c.id  = e.category_id
    JOIN public.data_shares ds ON ds.target_id = c.area_id
    WHERE e.id = event_attachments.event_id
      AND ds.share_type = 'area'
      AND (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())
  )
);
