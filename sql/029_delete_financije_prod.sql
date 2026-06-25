-- 029_delete_financije_prod.sql
-- ================================
-- Delete "Financije" Area on PROD — cascade delete all dependent data.
-- Run in Supabase SQL Editor (PROD) as Role: postgres
--
-- Background: PROD Financije has 2118 events (bulk import with missing attrs)
-- plus orphan/stale data invisible to RLS. UI cascade can't see them all.
-- Will be reimported from TEST export.
-- ================================

-- Step 0: Identify and count
DO $$
DECLARE
  v_area_id UUID;
  v_cat_count INT;
  v_event_count INT;
  v_attr_def_count INT;
  v_event_attr_count INT;
  v_preset_count INT;
  v_share_count INT;
  v_invite_count INT;
  v_attachment_count INT;
BEGIN
  SELECT id INTO v_area_id FROM areas WHERE name = 'Financije';
  IF v_area_id IS NULL THEN
    RAISE EXCEPTION 'Area "Financije" not found!';
  END IF;

  SELECT COUNT(*) INTO v_cat_count FROM categories WHERE area_id = v_area_id;
  SELECT COUNT(*) INTO v_event_count FROM events WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id);
  SELECT COUNT(*) INTO v_attr_def_count FROM attribute_definitions WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id);
  SELECT COUNT(*) INTO v_event_attr_count FROM event_attributes WHERE event_id IN (SELECT id FROM events WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id));
  SELECT COUNT(*) INTO v_preset_count FROM activity_presets WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id);
  SELECT COUNT(*) INTO v_share_count FROM data_shares WHERE target_id = v_area_id AND share_type = 'area';
  SELECT COUNT(*) INTO v_invite_count FROM share_invites WHERE target_id = v_area_id;
  SELECT COUNT(*) INTO v_attachment_count FROM event_attachments WHERE event_id IN (SELECT id FROM events WHERE category_id IN (SELECT id FROM categories WHERE area_id = v_area_id));

  RAISE NOTICE '=== Financije Area: % ===', v_area_id;
  RAISE NOTICE 'Categories: %', v_cat_count;
  RAISE NOTICE 'Events: %', v_event_count;
  RAISE NOTICE 'Event attributes: %', v_event_attr_count;
  RAISE NOTICE 'Event attachments: %', v_attachment_count;
  RAISE NOTICE 'Attribute definitions: %', v_attr_def_count;
  RAISE NOTICE 'Activity presets: %', v_preset_count;
  RAISE NOTICE 'Data shares: %', v_share_count;
  RAISE NOTICE 'Share invites: %', v_invite_count;
END $$;

-- Step 1: Delete event_attachments
DELETE FROM event_attachments
WHERE event_id IN (
  SELECT e.id FROM events e
  JOIN categories c ON c.id = e.category_id
  WHERE c.area_id = (SELECT id FROM areas WHERE name = 'Financije')
);

-- Step 2: Delete event_attributes
DELETE FROM event_attributes
WHERE event_id IN (
  SELECT e.id FROM events e
  JOIN categories c ON c.id = e.category_id
  WHERE c.area_id = (SELECT id FROM areas WHERE name = 'Financije')
);

-- Step 3: Delete events
DELETE FROM events
WHERE category_id IN (
  SELECT c.id FROM categories c
  WHERE c.area_id = (SELECT id FROM areas WHERE name = 'Financije')
);

-- Step 4: Delete activity_presets (shortcuts)
DELETE FROM activity_presets
WHERE category_id IN (
  SELECT c.id FROM categories c
  WHERE c.area_id = (SELECT id FROM areas WHERE name = 'Financije')
);

-- Step 5: Delete data_shares
DELETE FROM data_shares
WHERE target_id = (SELECT id FROM areas WHERE name = 'Financije')
  AND share_type = 'area';

-- Step 6: Delete share_invites
DELETE FROM share_invites
WHERE target_id = (SELECT id FROM areas WHERE name = 'Financije');

-- Step 7: Delete attribute_definitions
DELETE FROM attribute_definitions
WHERE category_id IN (
  SELECT c.id FROM categories c
  WHERE c.area_id = (SELECT id FROM areas WHERE name = 'Financije')
);

-- Step 8: Delete categories
DELETE FROM categories
WHERE area_id = (SELECT id FROM areas WHERE name = 'Financije');

-- Step 9: Delete the area itself
DELETE FROM areas WHERE name = 'Financije';
