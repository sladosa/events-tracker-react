-- ============================================================
-- 015_activity_presets_rls.sql
-- Ensure activity_presets table has full RLS policies.
-- The original PROD schema (SQL_schema_V5_commented.sql) noted
-- "activity_presets... not used in React app" — so policies
-- may have been omitted. Run idempotently on both TEST + PROD.
-- ============================================================

ALTER TABLE public.activity_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent re-run safety)
DROP POLICY IF EXISTS "presets_select" ON public.activity_presets;
DROP POLICY IF EXISTS "presets_insert" ON public.activity_presets;
DROP POLICY IF EXISTS "presets_update" ON public.activity_presets;
DROP POLICY IF EXISTS "presets_delete" ON public.activity_presets;

CREATE POLICY "presets_select" ON public.activity_presets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "presets_insert" ON public.activity_presets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "presets_update" ON public.activity_presets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "presets_delete" ON public.activity_presets
  FOR DELETE USING (user_id = auth.uid());

-- Verify:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'activity_presets';
