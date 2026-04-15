-- ============================================================
-- 011_template_fix_area_ids.sql
-- Fix template category area_id values corrupted by initial seed.
--
-- All 9 template categories were incorrectly assigned to the
-- Health area (10000000-0000-0000-0000-000000000001).
-- Fitness and Finance categories need their correct area_id.
--
-- Run on: TEST + PROD (after 010_template_seed.sql)
-- Safe to re-run (UPDATE WHERE id IN + user_id guard).
-- ============================================================

-- Fitness categories (Strength Training, Cardio, Flexibility)
UPDATE categories
SET area_id = '10000000-0000-0000-0000-000000000002'
WHERE id IN (
  '20000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000012'
) AND user_id = '00000000-0000-0000-0000-000000000001';

-- Finance categories (Expenses, Income, Investments)
UPDATE categories
SET area_id = '10000000-0000-0000-0000-000000000003'
WHERE id IN (
  '20000000-0000-0000-0000-000000000020',
  '20000000-0000-0000-0000-000000000021',
  '20000000-0000-0000-0000-000000000022'
) AND user_id = '00000000-0000-0000-0000-000000000001';

-- Verify (should return 3 rows each):
-- SELECT id, name, area_id FROM categories WHERE user_id = '00000000-0000-0000-0000-000000000001' ORDER BY area_id, name;
