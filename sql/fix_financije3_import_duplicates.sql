-- Fix: Remove duplicate events created by failed import (2026-06-14)
-- Root cause: smartReclassify query failed silently (URL too long) →
--   all rows reclassified as CREATE → duplicates instead of updates.
--
-- Logic:
--   ORIGINAL events  = events WITHOUT 'status' attribute (Python import never set Status)
--   DUPLICATE events = events WITH 'status' attribute that share session_start with an original
--
-- Run on: TEST database (Supabase SQL Editor)
-- Safe to run multiple times (idempotent — will delete 0 rows on second run).

-- ── STEP 1: Preview — run this first, verify counts before deleting ──────────

WITH status_def AS (
  -- Find attribute_definition.id for 'status' in Financije_3
  SELECT ad.id
  FROM attribute_definitions ad
  JOIN categories c ON c.id = ad.category_id
  JOIN areas a ON a.id = c.area_id
  WHERE ad.slug = 'status'
    AND a.name = 'Financije_3'
  LIMIT 1
),
dup_ids AS (
  SELECT DISTINCT e.id
  FROM events e
  -- event has a Status attribute
  JOIN event_attributes ea ON ea.event_id = e.id
  JOIN status_def sd ON ea.attribute_definition_id = sd.id
  -- AND another event exists at the same session WITHOUT Status
  WHERE EXISTS (
    SELECT 1
    FROM events e2
    WHERE e2.user_id    = e.user_id
      AND e2.category_id = e.category_id
      AND e2.session_start = e.session_start
      AND e2.id != e.id
      AND NOT EXISTS (
        SELECT 1 FROM event_attributes ea2
        WHERE ea2.event_id = e2.id
          AND ea2.attribute_definition_id = sd.id
      )
  )
)
SELECT
  COUNT(*)                         AS duplicates_to_delete,
  (SELECT COUNT(*) FROM events
   JOIN categories c ON c.id = events.category_id
   JOIN areas a ON a.id = c.area_id
   WHERE a.name = 'Financije_3')   AS total_financije3_events,
  (SELECT COUNT(*) FROM events
   JOIN categories c ON c.id = events.category_id
   JOIN areas a ON a.id = c.area_id
   WHERE a.name = 'Financije_3')
  - COUNT(*)                       AS expected_after_delete
FROM dup_ids;

-- ── STEP 2: Delete (uncomment when preview looks correct) ────────────────────
-- Expected: duplicates_to_delete ≈ 3163, total ≈ 6326, expected_after ≈ 3163

/*
BEGIN;

CREATE TEMP TABLE dup_event_ids AS
WITH status_def AS (
  SELECT ad.id
  FROM attribute_definitions ad
  JOIN categories c ON c.id = ad.category_id
  JOIN areas a ON a.id = c.area_id
  WHERE ad.slug = 'status'
    AND a.name = 'Financije_3'
  LIMIT 1
)
SELECT DISTINCT e.id
FROM events e
JOIN event_attributes ea ON ea.event_id = e.id
JOIN status_def sd ON ea.attribute_definition_id = sd.id
WHERE EXISTS (
  SELECT 1
  FROM events e2
  WHERE e2.user_id     = e.user_id
    AND e2.category_id  = e.category_id
    AND e2.session_start = e.session_start
    AND e2.id != e.id
    AND NOT EXISTS (
      SELECT 1 FROM event_attributes ea2
      WHERE ea2.event_id = e2.id
        AND ea2.attribute_definition_id = sd.id
    )
);

-- Verify count before deleting
SELECT COUNT(*) AS about_to_delete FROM dup_event_ids;

-- Delete child rows first (event_attributes, event_attachments)
DELETE FROM event_attributes WHERE event_id IN (SELECT id FROM dup_event_ids);
DELETE FROM event_attachments WHERE event_id IN (SELECT id FROM dup_event_ids);

-- Delete the duplicate events
DELETE FROM events WHERE id IN (SELECT id FROM dup_event_ids);

DROP TABLE dup_event_ids;

COMMIT;
*/

-- ── STEP 3: Verify after delete ──────────────────────────────────────────────
-- Run after uncommenting and executing Step 2:
/*
SELECT COUNT(*) AS financije3_events_remaining
FROM events e
JOIN categories c ON c.id = e.category_id
JOIN areas a ON a.id = c.area_id
WHERE a.name = 'Financije_3';
-- Expected: ~3163 (original count from Python import)
*/
