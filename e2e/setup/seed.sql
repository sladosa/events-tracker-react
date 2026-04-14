-- =============================================================================
-- Playwright E2E — Seed data for TEST Supabase project
-- =============================================================================
-- Run ONCE in Supabase SQL Editor (TEST project).
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.
--
-- Test users (already created in Authentication → Users):
--   owner@test.com  UUID: eef0d779-05ee-4f79-9524-78589701a861
--   userb@test.com  UUID: 93b96e77-5c82-47ef-b0ba-011dc399cc4d
-- =============================================================================

-- -----------------------------------------------------------------------
-- Profiles (needed for display_name in collab UI)
-- Trigger auto-kreira row kad se user registrira, ali display_name može biti NULL.
-- Upsert da osiguramo display_name za test users.
-- -----------------------------------------------------------------------
INSERT INTO profiles (id, email, display_name)
VALUES
  ('eef0d779-05ee-4f79-9524-78589701a861', 'owner@test.com', 'Owner Test'),
  ('93b96e77-5c82-47ef-b0ba-011dc399cc4d', 'userb@test.com', 'UserB Test')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- -----------------------------------------------------------------------
-- Areas (owner@test.com)
-- -----------------------------------------------------------------------
INSERT INTO areas (id, user_id, name, slug, sort_order)
VALUES
  ('a1000000-0000-0000-0000-000000000001',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'Fitness', 'fitness', 10),
  ('a1000000-0000-0000-0000-000000000002',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'Financije', 'financije', 20)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Categories — Fitness hierarchy
--
--   Activity (L1)
--   └── Gym (L2)
--       ├── Strength (L3, leaf, NO events)   ← add-child allowed
--       └── Cardio   (L3, leaf, HAS events)  ← add-child blocked
-- -----------------------------------------------------------------------
INSERT INTO categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'a1000000-0000-0000-0000-000000000001',
   NULL, 'Activity', 'activity', 1, 10),

  ('c1000000-0000-0000-0000-000000000002',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Gym', 'gym', 2, 10),

  ('c1000000-0000-0000-0000-000000000003',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',
   'Strength', 'strength', 3, 10),

  ('c1000000-0000-0000-0000-000000000004',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'a1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',
   'Cardio', 'cardio', 3, 20)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Event on Cardio (makes it a blocked-add-child leaf)
-- -----------------------------------------------------------------------
INSERT INTO events (id, user_id, category_id, event_date, session_start)
VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'c1000000-0000-0000-0000-000000000004',
   '2026-01-01',
   '2026-01-01T10:00:00+00:00')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Parent events (chain) for the Cardio event — Activity + Gym
-- chain_key = leaf category id = c1000000-0000-0000-0000-000000000004
-- -----------------------------------------------------------------------
INSERT INTO events (id, user_id, category_id, event_date, session_start, chain_key)
VALUES
  ('e1000000-0000-0000-0000-000000000002',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'c1000000-0000-0000-0000-000000000001',  -- Activity
   '2026-01-01',
   '2026-01-01T10:00:00+00:00',
   'c1000000-0000-0000-0000-000000000004'),

  ('e1000000-0000-0000-0000-000000000003',
   'eef0d779-05ee-4f79-9524-78589701a861',
   'c1000000-0000-0000-0000-000000000002',  -- Gym
   '2026-01-01',
   '2026-01-01T10:00:00+00:00',
   'c1000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- CLEANUP HELPERS (run manually after test run if needed)
-- =============================================================================
-- Delete test events created by E2 / E3 tests (named "PW-*"):
-- DELETE FROM events WHERE user_id = 'eef0d779-05ee-4f79-9524-78589701a861'
--   AND id NOT IN (
--     'e1000000-0000-0000-0000-000000000001',
--     'e1000000-0000-0000-0000-000000000002',
--     'e1000000-0000-0000-0000-000000000003'
--   );
--
-- Delete test areas created by E5 (named "PW-*"):
-- DELETE FROM areas WHERE user_id = 'eef0d779-05ee-4f79-9524-78589701a861'
--   AND name LIKE 'PW-%';
--
-- Delete test shares:
-- DELETE FROM data_shares WHERE owner_id = 'eef0d779-05ee-4f79-9524-78589701a861'
--   AND grantee_id = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';
-- DELETE FROM share_invites WHERE owner_id = 'eef0d779-05ee-4f79-9524-78589701a861';
-- =============================================================================
