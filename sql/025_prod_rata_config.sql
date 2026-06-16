-- Rata automation config for PROD
-- Run on PROD Supabase SQL Editor (after verifying area names below).
--
-- BEFORE RUNNING: verify which Financije area(s) exist on PROD:
--   SELECT id, name, settings->'automations' AS automations FROM areas WHERE name ILIKE 'financije%';
--
-- If area is named differently (e.g. just 'Financije'), update the WHERE clause.
-- Safe to run multiple times (jsonb_set is idempotent).
--
-- NOTE: trigger_slug = "rate" because PROD attr is named "Rate?" → slug "rate"
--       (TEST uses "Na rate?" → slug "na_rate"; configs differ per environment)
-- NOTE: After running, also fix hyphenated slugs if needed:
--   UPDATE attribute_definitions
--   SET slug = regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'), '_+$', '')
--   WHERE category_id IN (SELECT id FROM categories WHERE area_id IN (SELECT id FROM areas WHERE name ILIKE 'Financije%'))
--   AND (slug LIKE '%-%' OR slug IS NULL OR slug = '');

UPDATE areas
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{automations}',
  '{
    "rata": {
      "trigger_slug":      "rate",
      "count_slug":        "broj_rata",
      "amount_slug":       "isplata",
      "date_map_slug":     "izvor_placanja",
      "comment_attr_slug": "napomena",
      "date_map": {
        "Mastercard": 11,
        "Visa":        3
      },
      "override_attrs": {
        "status": "Planiran"
      }
    }
  }'::jsonb
)
WHERE name ILIKE 'Financije%';

-- Verify:
SELECT id, name, settings->'automations' AS automations
FROM areas
WHERE name ILIKE 'Financije%';
