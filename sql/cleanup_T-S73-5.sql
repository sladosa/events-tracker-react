-- ============================================================
-- cleanup_T-S73-5.sql
-- Cleanup after failed Leave Area test (T-S73-5).
--
-- Problem: detachAreaWithData skipped leaf event (chain_key = NULL bug).
-- Result:
--   1. userb's Alpha area was created (7249024d...) with 3 events (parents)
--   2. Leaf event stayed in owner's Alpha but with attr_defs pointing to
--      userb's area → inconsistent state
--   3. data_shares already deleted (leave completed partially)
--
-- This script:
--   A. Deletes stuck userb leaf event + its event_attributes from owner's Alpha
--   B. Deletes userb's Alpha area (cascades to categories, attr_defs, events)
--   C. Re-creates data_shares so userb has write access to owner's Alpha again
-- ============================================================

-- Accounts
-- userb@test.com  : 93b96e77-5c82-47ef-b0ba-011dc399cc4d
-- owner@test.com  : eef0d779-05ee-4f79-9524-78589701a861
-- owner Alpha     : f11e66e9-068c-44e5-9dec-08752a3843db
-- userb Alpha     : 7249024d-3aeb-4333-a324-6621c998f745

BEGIN;

-- A. Remove stuck userb event(s) from owner's Alpha
--    (these are events owned by userb but still in owner's categories)
DELETE FROM public.event_attributes
WHERE event_id IN (
  SELECT e.id FROM public.events e
  JOIN public.categories c ON e.category_id = c.id
  WHERE c.area_id = 'f11e66e9-068c-44e5-9dec-08752a3843db'
    AND e.user_id = '93b96e77-5c82-47ef-b0ba-011dc399cc4d'
);

DELETE FROM public.events
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE area_id = 'f11e66e9-068c-44e5-9dec-08752a3843db'
)
AND user_id = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

-- B. Delete userb's Alpha area (manual cascade — no ON DELETE CASCADE on FK)

-- B1. event_attributes for userb's Alpha events
DELETE FROM public.event_attributes
WHERE event_id IN (
  SELECT e.id FROM public.events e
  JOIN public.categories c ON e.category_id = c.id
  WHERE c.area_id = '7249024d-3aeb-4333-a324-6621c998f745'
);

-- B2. events in userb's Alpha
DELETE FROM public.events
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE area_id = '7249024d-3aeb-4333-a324-6621c998f745'
);

-- B3. attribute_definitions in userb's Alpha
DELETE FROM public.attribute_definitions
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE area_id = '7249024d-3aeb-4333-a324-6621c998f745'
);

-- B4. categories in userb's Alpha
DELETE FROM public.categories
WHERE area_id = '7249024d-3aeb-4333-a324-6621c998f745';

-- B5. the area itself
DELETE FROM public.areas
WHERE id = '7249024d-3aeb-4333-a324-6621c998f745';

-- C. Re-share owner's Alpha with userb (write) so T-S73-5 can be re-run
INSERT INTO public.data_shares
  (owner_id, grantee_id, share_type, target_id, permission)
VALUES
  (
    'eef0d779-05ee-4f79-9524-78589701a861',  -- owner@test.com
    '93b96e77-5c82-47ef-b0ba-011dc399cc4d',  -- userb@test.com
    'area',
    'f11e66e9-068c-44e5-9dec-08752a3843db',  -- owner's Alpha
    'write'
  )
ON CONFLICT (owner_id, grantee_id, target_id, share_type)
  DO UPDATE SET permission = 'write';

COMMIT;

-- Verify
SELECT 'events owned by userb in owner Alpha' AS check,
       COUNT(*) AS count
FROM public.events e
JOIN public.categories c ON e.category_id = c.id
WHERE c.area_id = 'f11e66e9-068c-44e5-9dec-08752a3843db'
  AND e.user_id = '93b96e77-5c82-47ef-b0ba-011dc399cc4d'
UNION ALL
SELECT 'userb Alpha area exists' AS check,
       COUNT(*) AS count
FROM public.areas
WHERE id = '7249024d-3aeb-4333-a324-6621c998f745'
UNION ALL
SELECT 'data_shares for owner Alpha → userb' AS check,
       COUNT(*) AS count
FROM public.data_shares
WHERE target_id = 'f11e66e9-068c-44e5-9dec-08752a3843db'
  AND grantee_id = '93b96e77-5c82-47ef-b0ba-011dc399cc4d';

-- Expected result:
-- events owned by userb in owner Alpha  | 0
-- userb Alpha area exists               | 0
-- data_shares for owner Alpha → userb   | 1
