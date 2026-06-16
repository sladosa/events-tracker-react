-- Rata automation config for PROD
-- Run on PROD Supabase SQL Editor (after verifying area names below).
--
-- BEFORE RUNNING: verify which Financije area(s) exist on PROD:
--   SELECT id, name, settings->'automations' AS automations FROM areas WHERE name ILIKE 'financije%';
--
-- If area is named differently (e.g. just 'Financije'), update the WHERE clause.
-- Safe to run multiple times (jsonb_set is idempotent).

UPDATE areas
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{automations}',
  '{
    "rata": {
      "trigger_slug":      "na_rate",
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
