-- Set rata automation config on Financije areas
-- Run on TEST first, then PROD after verification
--
-- Config:
--   trigger_slug:   "na_rate"         — boolean/suggest attr, true = installment
--   count_slug:     "broj_rata"        — number attr: how many installments
--   amount_slug:    "iznos"            — number attr: total amount
--   date_map_slug:  "izvor_placanja"   — suggest attr: determines due day per month
--   date_map:       Mastercard → 11th, Visa → 3rd, default → 15th
--   override_attrs: status → Planiran (future), na_rate → false (rata itself is not an installment)

UPDATE areas
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{automations}',
  '{
    "rata": {
      "trigger_slug": "na_rate",
      "count_slug": "broj_rata",
      "amount_slug": "iznos",
      "date_map_slug": "izvor_placanja",
      "date_map": {
        "Mastercard kartica": 11,
        "Visa kartica": 3,
        "Visa debitna": 3
      },
      "override_attrs": {
        "status": "Planiran",
        "na_rate": "false"
      }
    }
  }'::jsonb
)
WHERE name LIKE 'Financije%';

-- Verify
SELECT id, name, settings->'automations' AS automations
FROM areas
WHERE name LIKE 'Financije%';
