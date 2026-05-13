-- 021_orphan_test_data.sql
-- Test data za Orphan Events feature (S75).
--
-- Kreira:
--   - Area "Orphan Test Area" u vlasništvu owner@test.com
--   - Kategorije: Workouts (L1) > Running (L2) > Trail Run (leaf)
--   - 1 attr def: Distance (km) na leaf kategoriji
--   - 3 leaf eventa userb@test.com u owner-ovoj aredi (orphan eventi)
--   - 3 event_attributes (distance vrijednosti) za te evente
--   - NE postoji data_shares red za userb u toj aredi (simulira "left without data")
--   - Profiles (display_name) za oba usera
--
-- Pokrenuti u Supabase SQL Editor (TEST baza).
-- Idempotentno — može se ponovo pokrenuti bez duplikata.

DO $$
DECLARE
  owner_id  UUID;
  userb_id  UUID;

  area_id     UUID := 'aabbcc11-0001-0001-0001-000000000001';
  cat_l1_id   UUID := 'aabbcc11-0001-0001-0002-000000000001';
  cat_l2_id   UUID := 'aabbcc11-0001-0001-0003-000000000001';
  cat_leaf_id UUID := 'aabbcc11-0001-0001-0004-000000000001';
  attr_def_id UUID := 'aabbcc11-0001-0001-0005-000000000001';

  ev1_id UUID := 'aabbcc11-0001-0002-0001-000000000001';
  ev2_id UUID := 'aabbcc11-0001-0002-0002-000000000001';
  ev3_id UUID := 'aabbcc11-0001-0002-0003-000000000001';

  ea1_id UUID := 'aabbcc11-0001-0003-0001-000000000001';
  ea2_id UUID := 'aabbcc11-0001-0003-0002-000000000001';
  ea3_id UUID := 'aabbcc11-0001-0003-0003-000000000001';
BEGIN
  -- ── 1. Look up user IDs ──────────────────────────────────
  SELECT id INTO owner_id FROM auth.users WHERE email = 'owner@test.com';
  SELECT id INTO userb_id FROM auth.users WHERE email = 'userb@test.com';

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'owner@test.com not found in auth.users — create the user first';
  END IF;
  IF userb_id IS NULL THEN
    RAISE EXCEPTION 'userb@test.com not found in auth.users — create the user first';
  END IF;

  RAISE NOTICE 'owner_id = %', owner_id;
  RAISE NOTICE 'userb_id = %', userb_id;

  -- ── 2. Ensure profiles exist ─────────────────────────────
  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (owner_id, 'owner@test.com', 'Test Owner'),
    (userb_id, 'userb@test.com',  'User B')
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email        = EXCLUDED.email;

  -- ── 3. Area (owner) ──────────────────────────────────────
  INSERT INTO public.areas (id, user_id, name, slug, sort_order, icon, color, description)
  VALUES (area_id, owner_id, 'Orphan Test Area', 'orphan_test_area', 999, '🧪', NULL, 'Created by 021_orphan_test_data.sql')
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Categories ────────────────────────────────────────
  -- L1: Workouts
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
  VALUES (cat_l1_id, owner_id, area_id, NULL, 'Workouts', 'workouts_ot', 1, 10)
  ON CONFLICT (id) DO NOTHING;

  -- L2: Running
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
  VALUES (cat_l2_id, owner_id, area_id, cat_l1_id, 'Running', 'running_ot', 2, 10)
  ON CONFLICT (id) DO NOTHING;

  -- L3 leaf: Trail Run
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
  VALUES (cat_leaf_id, owner_id, area_id, cat_l2_id, 'Trail Run', 'trail_run_ot', 3, 10)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Attribute definition on leaf ─────────────────────
  INSERT INTO public.attribute_definitions (id, user_id, category_id, name, slug, data_type, unit, sort_order, is_required)
  VALUES (attr_def_id, owner_id, cat_leaf_id, 'Distance', 'distance_ot', 'number', 'km', 10, false)
  ON CONFLICT (id) DO NOTHING;

  -- ── 6. Remove any existing data_shares (orphan state) ───
  DELETE FROM public.data_shares
  WHERE grantee_id = userb_id AND target_id = area_id;

  -- ── 7. Leaf events for userb (orphan events) ────────────
  INSERT INTO public.events (id, user_id, category_id, event_date, session_start, comment, created_at, edited_at)
  VALUES
    (ev1_id, userb_id, cat_leaf_id, '2025-01-10', '2025-01-10 09:00:00+00', 'Morning trail run, felt great', NOW(), NOW()),
    (ev2_id, userb_id, cat_leaf_id, '2025-02-15', '2025-02-15 14:30:00+00', 'Snowy conditions',               NOW(), NOW()),
    (ev3_id, userb_id, cat_leaf_id, '2025-03-20', '2025-03-20 08:00:00+00', NULL,                              NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── 8. Event attributes ──────────────────────────────────
  INSERT INTO public.event_attributes (id, user_id, event_id, attribute_definition_id, value_number)
  VALUES
    (ea1_id, userb_id, ev1_id, attr_def_id, 12.4),
    (ea2_id, userb_id, ev2_id, attr_def_id,  8.1),
    (ea3_id, userb_id, ev3_id, attr_def_id, 15.7)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ Test data ready.';
  RAISE NOTICE '   Area "Orphan Test Area" id = %', area_id;
  RAISE NOTICE '   Leaf category "Trail Run" id = %', cat_leaf_id;
  RAISE NOTICE '   3 events + 3 attributes for userb (%)' , userb_id;
  RAISE NOTICE '   No data_shares row exists (orphan state confirmed)';
END $$;

-- ── Verify ───────────────────────────────────────────────────
-- After running, use this to confirm:
-- SELECT e.id, e.event_date, e.comment, ea.value_number, p.display_name
-- FROM events e
-- JOIN profiles p ON p.id = e.user_id
-- LEFT JOIN event_attributes ea ON ea.event_id = e.id
-- WHERE e.category_id = 'aabbcc11-0001-0001-0004-000000000001'
-- ORDER BY e.event_date;
