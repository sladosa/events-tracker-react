-- 034_s107w_test_area.sql
-- Scratch test area za T-S107w-8 (Delete? kolona — parent lanac / P2 test).
--
-- Kreira:
--   - Area "S107w Test" (borrows user_id od postojeće Financije_all ili Health_Sasa aree)
--   - Kategorije: Workout (L1, ima atribut) > Set (L2 leaf, ima atribut)
--   - Struktura ima roditeljsku razinu (za razliku od Financije_all koji je L1 leaf bez
--     roditelja) — baš ono što treba da bi Delete? test mogao provjeriti P2 parent chain.
--
-- Pokrenuti u Supabase SQL Editor (TEST baza). Idempotentno — može se ponovo pokrenuti.
-- Nema eventa — evente dodaješ kroz app (Add Activity), 2 zapisa u istoj sesiji.
--
-- Cleanup poslije testa: obriši Area "S107w Test" kroz Structure tab (Delete Area,
-- cascade — koristi isti kod koji je fixan u 033/T-S107v-6).

DO $$
DECLARE
  test_user_id UUID;
  area_id      UUID := 'f0000107-0008-0008-0008-000000000001';
  cat_l1_id    UUID := 'f0000107-0008-0008-0008-000000000002';
  cat_leaf_id  UUID := 'f0000107-0008-0008-0008-000000000003';
  attr_l1_id   UUID := 'f0000107-0008-0008-0008-000000000004';
  attr_leaf_id UUID := 'f0000107-0008-0008-0008-000000000005';
BEGIN
  -- Borrow user_id from the Financije_all area so we don't need to hardcode/guess it.
  -- NOTE: this TEST DB has several simulated users (share/E2E fixtures) that reuse the
  -- same area names/slugs (e.g. multiple "Health" areas with slug 'health' under
  -- different owners) — 'financije-all' is the one slug that is unique to Saša's real
  -- TEST account, so it's the only safe anchor.
  SELECT user_id INTO test_user_id
  FROM public.areas
  WHERE slug = 'financije-all'
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'Could not find area with slug financije-all to borrow user_id from — check slugs in this DB';
  END IF;

  -- ── Area ──────────────────────────────────────────────────
  INSERT INTO public.areas (id, user_id, name, slug, sort_order, icon, color, description)
  VALUES (area_id, test_user_id, 'S107w Test', 's107w_test', 999, '🧪', NULL,
          'Scratch area for S107w Delete? manual testing — safe to delete after use')
  ON CONFLICT (id) DO NOTHING;

  -- ── Categories ────────────────────────────────────────────
  -- L1: Workout (parent level — gets 1 upserted event per session, chain_key = leaf id)
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
  VALUES (cat_l1_id, test_user_id, area_id, NULL, 'Workout', 'workout_s107w', 1, 10)
  ON CONFLICT (id) DO NOTHING;

  -- Leaf: Set (L2 — gets N events per session)
  INSERT INTO public.categories (id, user_id, area_id, parent_category_id, name, slug, level, sort_order)
  VALUES (cat_leaf_id, test_user_id, area_id, cat_l1_id, 'Set', 'set_s107w', 2, 10)
  ON CONFLICT (id) DO NOTHING;

  -- ── Attributes ────────────────────────────────────────────
  -- Parent-level attribute — verify it survives when only 1 of 2 leaf events is deleted
  INSERT INTO public.attribute_definitions (id, user_id, category_id, name, slug, data_type, sort_order, is_required)
  VALUES (attr_l1_id, test_user_id, cat_l1_id, 'Workout Type', 'workout_type_s107w', 'text', 10, false)
  ON CONFLICT (id) DO NOTHING;

  -- Leaf attribute
  INSERT INTO public.attribute_definitions (id, user_id, category_id, name, slug, data_type, unit, sort_order, is_required)
  VALUES (attr_leaf_id, test_user_id, cat_leaf_id, 'Reps', 'reps_s107w', 'number', NULL, 10, false)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ S107w Test area ready. area_id=%, l1(Workout)=%, leaf(Set)=%', area_id, cat_l1_id, cat_leaf_id;
END $$;

-- ── Verify ───────────────────────────────────────────────────
-- SELECT a.name AS area, c.name AS category, c.level, ad.name AS attribute
-- FROM public.areas a
-- JOIN public.categories c ON c.area_id = a.id
-- LEFT JOIN public.attribute_definitions ad ON ad.category_id = c.id
-- WHERE a.slug = 's107w_test'
-- ORDER BY c.level, ad.sort_order;
