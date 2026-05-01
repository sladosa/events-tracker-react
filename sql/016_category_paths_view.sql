-- 016_category_paths_view.sql
-- Recursive CTE view: category_full_paths
--
-- Replaces the N+1 buildCategoryPath() loop in useActivities.ts.
-- Before: 1 query per category level per event (e.g. 20 events × depth 4 = 80 queries)
-- After:  1 batch query for all unique category_ids on the page
--
-- Path format: [AreaName, L1name, L2name, ..., LeafName]
-- Matches the existing buildCategoryPath() output exactly.
--
-- Run on TEST first, then PROD.

CREATE OR REPLACE VIEW category_full_paths AS
WITH RECURSIVE cat_tree AS (
  -- Base case: L1 categories (no parent, have area_id)
  SELECT
    c.id,
    c.name,
    c.area_id,
    ARRAY[c.name]::text[] AS path_names
  FROM categories c
  WHERE c.parent_category_id IS NULL

  UNION ALL

  -- Recursive case: children inherit area_id from their root ancestor
  SELECT
    c.id,
    c.name,
    ct.area_id,
    ct.path_names || c.name
  FROM categories c
  JOIN cat_tree ct ON c.parent_category_id = ct.id
)
SELECT
  ct.id             AS category_id,
  ct.name           AS category_name,
  ct.area_id,
  a.name            AS area_name,
  a.icon            AS area_icon,
  (ARRAY[a.name] || ct.path_names)::text[] AS full_path
FROM cat_tree ct
LEFT JOIN areas a ON a.id = ct.area_id;

-- Grant access to PostgREST roles (inherits RLS from underlying tables)
GRANT SELECT ON category_full_paths TO anon, authenticated;
