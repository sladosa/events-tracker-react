-- Migration 006 — Fix RLS + claim ownership of unowned rows
-- READY TO RUN

DO $$
DECLARE
  v_user_id uuid := '768a6056-91fd-42bb-98ae-ee83e6bd6c8d';
  template_uuid uuid := '00000000-0000-0000-0000-000000000000';
  n int;
BEGIN
  UPDATE public.areas SET user_id = v_user_id
    WHERE user_id IS NULL OR user_id = template_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'areas updated: %', n;

  UPDATE public.categories SET user_id = v_user_id
    WHERE user_id IS NULL OR user_id = template_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'categories updated: %', n;

  UPDATE public.attribute_definitions SET user_id = v_user_id
    WHERE user_id IS NULL OR user_id = template_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'attribute_definitions updated: %', n;

  UPDATE public.events SET user_id = v_user_id
    WHERE user_id IS NULL OR user_id = template_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'events updated: %', n;

  UPDATE public.event_attributes SET user_id = v_user_id
    WHERE user_id IS NULL OR user_id = template_uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'event_attributes updated: %', n;
END $$;

DROP POLICY IF EXISTS "Users can update own areas" ON public.areas;
CREATE POLICY "Users can update own areas" ON public.areas FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own attribute_definitions" ON public.attribute_definitions;
CREATE POLICY "Users can update own attribute_definitions" ON public.attribute_definitions FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update own events" ON public.events FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own event_attributes" ON public.event_attributes;
CREATE POLICY "Users can update own event_attributes" ON public.event_attributes FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);
