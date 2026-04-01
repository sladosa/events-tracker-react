-- ============================================================
-- 008_profiles.sql — Events Tracker React
-- Profiles table: email lookup for sharing invite flow
-- ============================================================
-- Run on TEST Supabase FIRST, later on PROD before 009_sharing.sql.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Table: profiles
-- Auto-populated via trigger on auth.users INSERT.
-- Used by invite flow: owner looks up grantee UUID by email.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles (for invite email lookup)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Each user can only update their own profile
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Insert only via trigger (SECURITY DEFINER bypasses RLS)
-- No INSERT policy for regular users needed.

-- ============================================================
-- Trigger: auto-populate profiles on new user registration
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Migration: populate profiles for existing users
-- (trigger only fires for NEW registrations)
-- ============================================================

INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
