-- 033_delete_area_cascade.sql
-- ================================
-- Generic cascade delete of ONE Area, by UUID. Run in Supabase SQL Editor
-- as Role: postgres (bypasses RLS).
--
-- WHY THIS EXISTS
-- The UI "Delete Area" (StructureDeleteModal.cascadeDelete) deletes rows through
-- the client, so every SELECT/DELETE it issues is filtered by RLS. When an event
-- has `event_attributes` rows that the current user cannot see (e.g. `user_id`
-- of a former grantee / an old bulk import), the modal deletes the event's
-- *visible* attributes only, then the `events` DELETE fails with:
--
--     update or delete on table "events" violates foreign key constraint
--     "event_attributes_event_id_fkey" — Key is still referenced from
--     table "event_attributes".
--
-- Same failure class as S99 (029_delete_financije_prod.sql, which this generalises).
--
-- HOW TO USE
--   1. Run SECTION 1, find the area, copy its `id`.
--   2. (optional) Run SECTION 2 with that id — tells you WHY the UI failed.
--   3. Paste the id into SECTION 3 and run it.
--
-- ⚠ Area names are NOT unique across users. Always go by UUID, never by name.
-- ================================


-- ============================================================
-- SECTION 1 — find the area (read-only)
-- ============================================================
-- Adjust the ILIKE pattern, or drop the WHERE clause to list everything.

SELECT
  a.id,
  a.name,
  u.email                                                   AS owner,
  (SELECT count(*) FROM categories c WHERE c.area_id = a.id) AS categories,
  (SELECT count(*) FROM events e
     JOIN categories c ON c.id = e.category_id
    WHERE c.area_id = a.id)                                  AS events,
  (SELECT count(*) FROM event_attributes ea
     JOIN events e   ON e.id = ea.event_id
     JOIN categories c ON c.id = e.category_id
    WHERE c.area_id = a.id)                                  AS event_attributes,
  a.created_at
FROM areas a
LEFT JOIN auth.users u ON u.id = a.user_id
WHERE a.name ILIKE '%Financije%'
ORDER BY a.name, a.created_at;


-- ============================================================
-- SECTION 2 — diagnose why the UI could not delete it (read-only)
-- ============================================================
-- Paste the area id below.
-- 2a: WHO OWNS IT AND WHOSE RECORDS ARE INSIDE — one roster.
--     `role` tells you what to do:
--       owner          → the account that can delete the Area
--       active grantee → still shared with them; ask them, or revoke first
--       ORPHAN         → had access once, data stayed behind. This is the row
--                        that blocks the delete, and the UI cannot see it.

WITH a AS (
  SELECT id, user_id FROM areas
  WHERE id = '00000000-0000-0000-0000-000000000000'   -- ← area id
),
people AS (
  SELECT e.user_id, count(*) AS events, 0 AS attr_rows
  FROM events e JOIN categories c ON c.id = e.category_id, a
  WHERE c.area_id = a.id
  GROUP BY e.user_id
  UNION ALL
  SELECT ea.user_id, 0, count(*)
  FROM event_attributes ea
  JOIN events e     ON e.id = ea.event_id
  JOIN categories c ON c.id = e.category_id, a
  WHERE c.area_id = a.id
  GROUP BY ea.user_id
)
SELECT
  coalesce(u.email, p.user_id::text, '(no user_id)') AS who,
  CASE
    WHEN p.user_id = a.user_id THEN 'owner'
    WHEN p.user_id IS NULL     THEN 'orphan row without user_id'
    WHEN EXISTS (SELECT 1 FROM data_shares d
                  WHERE d.target_id = a.id AND d.share_type = 'area'
                    AND d.grantee_id = p.user_id) THEN 'active grantee'
    ELSE 'ORPHAN — no longer has access'
  END                        AS role,
  sum(p.events)              AS events,
  sum(p.attr_rows)           AS attribute_values
FROM people p
CROSS JOIN a
LEFT JOIN auth.users u ON u.id = p.user_id
GROUP BY who, role
ORDER BY events DESC, attribute_values DESC;

-- 2a-bis: everyone the Area is currently shared with (even with no records yet)

SELECT u.email, d.permission, d.created_at
FROM data_shares d
LEFT JOIN auth.users u ON u.id = d.grantee_id
WHERE d.target_id = '00000000-0000-0000-0000-000000000000'   -- ← area id
  AND d.share_type = 'area'
ORDER BY d.created_at;

-- 2b: are the S75 owner-fallback policies (020_orphan_rls.sql) present on this
--     database? If these four rows are missing, that alone explains the failure
--     and applying 020_orphan_rls.sql makes the UI delete work again.

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('events_select_by_area_owner',
                     'event_attrs_select_by_area_owner',
                     'event_attrs_delete_by_area_owner',
                     'event_attachments_delete_by_area_owner')
ORDER BY tablename, policyname;


-- ============================================================
-- SECTION 3 — delete (DESTRUCTIVE, one transaction)
-- ============================================================
-- Paste the SAME area id in the one place marked below.
-- Prints a NOTICE inventory before deleting; the whole block is one transaction,
-- so if any step fails nothing is deleted.
--
-- ⚠ There is no backup here. If you want the Excel backup, do the UI
--   "Download Backup & Delete" first — it downloads before it deletes, so the
--   file is on disk even when the delete step then fails.

DO $$
DECLARE
  v_area_id UUID := '00000000-0000-0000-0000-000000000000';   -- ← area id
  v_name    TEXT;
  v_cats    INT;
  v_events  INT;
  v_attrs   INT;
  v_attach  INT;
  v_defs    INT;
  v_presets INT;
BEGIN
  SELECT name INTO v_name FROM areas WHERE id = v_area_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Area % not found — check SECTION 1.', v_area_id;
  END IF;

  SELECT count(*) INTO v_cats   FROM categories WHERE area_id = v_area_id;
  SELECT count(*) INTO v_events FROM events e
    JOIN categories c ON c.id = e.category_id WHERE c.area_id = v_area_id;
  SELECT count(*) INTO v_attrs  FROM event_attributes ea
    JOIN events e ON e.id = ea.event_id
    JOIN categories c ON c.id = e.category_id WHERE c.area_id = v_area_id;
  SELECT count(*) INTO v_attach FROM event_attachments at
    JOIN events e ON e.id = at.event_id
    JOIN categories c ON c.id = e.category_id WHERE c.area_id = v_area_id;
  SELECT count(*) INTO v_defs   FROM attribute_definitions
    WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id);
  SELECT count(*) INTO v_presets FROM activity_presets
    WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id);

  RAISE NOTICE '=== deleting area "%" (%) ===', v_name, v_area_id;
  RAISE NOTICE 'categories % / events % / event_attributes % / attachments % / attr_defs % / presets %',
    v_cats, v_events, v_attrs, v_attach, v_defs, v_presets;

  -- order matters: children before parents
  DELETE FROM event_attachments WHERE event_id IN (
    SELECT e.id FROM events e JOIN categories c ON c.id = e.category_id
    WHERE c.area_id = v_area_id);

  DELETE FROM event_attributes WHERE event_id IN (
    SELECT e.id FROM events e JOIN categories c ON c.id = e.category_id
    WHERE c.area_id = v_area_id);

  DELETE FROM events WHERE category_id IN (
    SELECT id FROM categories WHERE area_id = v_area_id);

  DELETE FROM activity_presets WHERE category_id IN (
    SELECT id FROM categories WHERE area_id = v_area_id);

  DELETE FROM data_shares  WHERE target_id = v_area_id AND share_type = 'area';
  DELETE FROM share_invites WHERE target_id = v_area_id;

  DELETE FROM attribute_definitions WHERE category_id IN (
    SELECT id FROM categories WHERE area_id = v_area_id);

  -- categories carry a trigger that blocks DELETE while events exist;
  -- events are already gone above, so the count it sees is 0.
  DELETE FROM categories WHERE area_id = v_area_id;

  DELETE FROM areas WHERE id = v_area_id;

  RAISE NOTICE 'done — area "%" removed.', v_name;
END $$;
