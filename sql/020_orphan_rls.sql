-- 020_orphan_rls.sql
-- Orphan events feature (S75):
-- Area owners can SELECT, UPDATE (claim), and DELETE orphan events in their own areas.
--
-- "Orphan event" = event whose user_id belongs to a former grantee who no longer
-- has an active data_shares row for that area.
--
-- Without the SELECT policies below, orphan events are invisible to the owner
-- (existing events_select requires an active data_shares row for owner visibility).
-- These additive permissive policies fill that gap.
--
-- Run on TEST first, then PROD.

-- ============================================================
-- events — owner can SELECT orphan events in their own areas
-- ============================================================
-- Additive permissive policy (combined with OR alongside existing events_select).
-- Allows area owners to see events from former grantees after leave-without-data.

DROP POLICY IF EXISTS "events_select_by_area_owner" ON public.events;
CREATE POLICY "events_select_by_area_owner" ON public.events FOR SELECT
USING (
  category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ============================================================
-- event_attributes — owner can SELECT attrs of orphan events
-- ============================================================

DROP POLICY IF EXISTS "event_attrs_select_by_area_owner" ON public.event_attributes;
CREATE POLICY "event_attrs_select_by_area_owner" ON public.event_attributes FOR SELECT
USING (
  event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ============================================================
-- events — owner can claim (UPDATE) or delete events in their areas
-- ============================================================

-- Owner can UPDATE any event in their own areas.
-- WITH CHECK forces user_id = auth.uid() after update (claim operation).
DROP POLICY IF EXISTS "events_update_by_area_owner" ON public.events;
CREATE POLICY "events_update_by_area_owner" ON public.events FOR UPDATE
USING (
  -- own events (existing behaviour preserved)
  auth.uid() = user_id
  -- OR area owner targeting event in their own area
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
)
WITH CHECK (
  -- After update: event must belong to the current user (claim operation)
  auth.uid() = user_id
);

-- Owner can DELETE any event in their own areas.
DROP POLICY IF EXISTS "events_delete_by_area_owner" ON public.events;
CREATE POLICY "events_delete_by_area_owner" ON public.events FOR DELETE
USING (
  auth.uid() = user_id
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ============================================================
-- event_attributes — owner can claim (UPDATE user_id) or delete
-- ============================================================

DROP POLICY IF EXISTS "event_attrs_update_by_area_owner" ON public.event_attributes;
CREATE POLICY "event_attrs_update_by_area_owner" ON public.event_attributes FOR UPDATE
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "event_attrs_delete_by_area_owner" ON public.event_attributes;
CREATE POLICY "event_attrs_delete_by_area_owner" ON public.event_attributes FOR DELETE
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- ============================================================
-- event_attachments — owner can delete orphan attachments
-- ============================================================

DROP POLICY IF EXISTS "event_attachments_delete_by_area_owner" ON public.event_attachments;
CREATE POLICY "event_attachments_delete_by_area_owner" ON public.event_attachments FOR DELETE
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.areas a ON c.area_id = a.id
    WHERE a.user_id = auth.uid()
  )
);
