-- ============================================================
-- 009_sharing.sql — Events Tracker React
-- Collab RLS policies + share_invites table
-- ============================================================
-- Run AFTER 008_profiles.sql.
-- Run on TEST Supabase FIRST, later on PROD.
-- Idempotent: drops existing basic SELECT/INSERT policies before
-- recreating with collab-aware logic.
-- ============================================================

-- ============================================================
-- data_shares — RLS (table already exists from TEST_setup.sql)
-- ============================================================

-- Already enabled in TEST_setup.sql, safe to re-run:
ALTER TABLE public.data_shares ENABLE ROW LEVEL SECURITY;

-- data_shares policies already created in TEST_setup.sql (owner_id / grantee_id).
-- No changes needed — they already handle collab correctly.

-- ============================================================
-- share_invites — for inviting users who don't have an account yet
-- ============================================================

CREATE TABLE IF NOT EXISTS public.share_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_email text NOT NULL,
  share_type text NOT NULL DEFAULT 'area',
  target_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('read', 'write')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.share_invites ENABLE ROW LEVEL SECURITY;

-- Owner sees their own invites
DROP POLICY IF EXISTS "invites_select" ON public.share_invites;
CREATE POLICY "invites_select"
  ON public.share_invites FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "invites_insert" ON public.share_invites;
CREATE POLICY "invites_insert"
  ON public.share_invites FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "invites_delete" ON public.share_invites;
CREATE POLICY "invites_delete"
  ON public.share_invites FOR DELETE
  USING (owner_id = auth.uid());

-- Trigger: when a new profile is created (= user registered),
-- auto-accept any pending invites for that email.
CREATE OR REPLACE FUNCTION public.handle_pending_invites()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.data_shares (owner_id, grantee_id, share_type, target_id, permission)
  SELECT owner_id, new.id, share_type, target_id, permission
  FROM public.share_invites
  WHERE grantee_email = new.email AND status = 'pending';

  UPDATE public.share_invites
  SET status = 'accepted'
  WHERE grantee_email = new.email AND status = 'pending';

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_pending_invites();

-- ============================================================
-- areas — replace basic SELECT with collab-aware SELECT
-- ============================================================

DROP POLICY IF EXISTS "areas_select" ON public.areas;
CREATE POLICY "areas_select" ON public.areas FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = '00000000-0000-0000-0000-000000000001'
  OR id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

-- INSERT/UPDATE/DELETE unchanged (only owner writes)

-- ============================================================
-- categories — replace basic SELECT with collab-aware SELECT
-- ============================================================

DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT
USING (
  area_id IN (SELECT id FROM public.areas WHERE user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000001')
  OR area_id IN (
    SELECT target_id FROM public.data_shares
    WHERE grantee_id = auth.uid() AND share_type = 'area'
  )
);

-- INSERT/UPDATE/DELETE unchanged (only owner writes)

-- ============================================================
-- attribute_definitions — replace basic SELECT with collab-aware SELECT
-- ============================================================

DROP POLICY IF EXISTS "attr_def_select" ON public.attribute_definitions;
CREATE POLICY "attr_def_select" ON public.attribute_definitions FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = '00000000-0000-0000-0000-000000000001'
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
);

-- INSERT/UPDATE/DELETE unchanged (only owner writes)

-- ============================================================
-- events — replace basic SELECT + INSERT with collab-aware versions
-- ============================================================

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT
USING (
  -- own events
  auth.uid() = user_id
  -- grantee sees events in shared areas
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE ds.grantee_id = auth.uid() AND ds.share_type = 'area'
  )
  -- owner sees grantee events in their shared areas
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE ds.owner_id = auth.uid() AND ds.share_type = 'area'
  )
);

-- Allow owner and write-grantee to insert events
-- S43 fix: simplified to avoid categories.user_id check (same S39 bug pattern).
-- Grantee write access is enforced at the app layer (canAddActivity guard).
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
CREATE POLICY "events_insert" ON public.events FOR INSERT
WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE unchanged (only own events)

-- ============================================================
-- event_attributes — replace basic SELECT with collab-aware SELECT
-- ============================================================

DROP POLICY IF EXISTS "event_attr_select" ON public.event_attributes;
CREATE POLICY "event_attr_select" ON public.event_attributes FOR SELECT
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())
      AND ds.share_type = 'area'
  )
);

-- INSERT/UPDATE/DELETE unchanged (user_id = auth.uid())

-- ============================================================
-- event_attachments — replace basic SELECT with collab-aware SELECT
-- ============================================================


DROP POLICY IF EXISTS "event_attach_select" ON public.event_attachments;
CREATE POLICY "event_attach_select" ON public.event_attachments FOR SELECT
USING (
  auth.uid() = user_id
  OR event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.categories c ON e.category_id = c.id
    JOIN public.data_shares ds ON c.area_id = ds.target_id
    WHERE (ds.grantee_id = auth.uid() OR ds.owner_id = auth.uid())
      AND ds.share_type = 'area'
  )
);

-- INSERT/UPDATE/DELETE unchanged (user_id = auth.uid())

-- ============================================================
-- data_shares — unique constraint for upsert (createShare / updatePermission)
-- Added S41: upsert uses onConflict: 'owner_id,grantee_id,target_id,share_type'
-- Idempotent: drops first if exists
-- ============================================================

ALTER TABLE public.data_shares
  DROP CONSTRAINT IF EXISTS data_shares_unique_share;
ALTER TABLE public.data_shares
  ADD CONSTRAINT data_shares_unique_share
  UNIQUE (owner_id, grantee_id, target_id, share_type);
