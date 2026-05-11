-- ============================================================
-- 019_leave_area.sql
-- Allow grantee to remove their own access to a shared area.
-- Previously only owner_id = auth.uid() was allowed to DELETE.
-- S73: "Leave shared area" feature.
-- ============================================================

-- Idempotent: drop + recreate
DROP POLICY IF EXISTS "data_shares_delete" ON public.data_shares;

CREATE POLICY "data_shares_delete" ON public.data_shares
  FOR DELETE USING (owner_id = auth.uid() OR grantee_id = auth.uid());
