-- ============================================================
-- 037_financije_dashboard.sql — Overview config for Financije_all
-- ============================================================
-- Spec: docs/OVERVIEW_TAB_SPEC.md §2.3 (widget shape), §2.10 (the rule this
--       encodes), §2.15 (why this is configuration and not code).
--
-- Requires 035 + 036.
--
-- THIS FILE IS DATA, NOT SCHEMA. It writes the missing layer of MEANING over a
-- generic EAV model: which slug is money in, which is money out, what counts as
-- "already happened". Nothing in 035/036 knows any of that — and nothing here
-- is a code change. That is the §2.15 test of generality: a new Area must cost
-- configuration, not lines of TypeScript.
--
-- ⚠ THE FILTER IS THE WHOLE POINT, AND IT IS COUNTER-INTUITIVE
--   `izvorplacanja ∈ {Racun, Cash}`, NOT a plain sum per `Racun`.
--   `Racun` means "the account this is eventually charged to", so a card
--   purchase and the later lump settlement BOTH sit on the same account and a
--   naive sum counts the money twice. Measured on TEST (2025+2026):
--       this filter  →  ZABA    150,80        RF  −1.978,32   ← matches the model
--       naive sum    →  ZABA −22.943,71       RF  −2.280,23   ← nonsense
--   Full proof against the bank: SALDO_MODEL_NALAZI.md (17/30 months to the
--   cent; the naive sum 0/30).
--
-- `split` is `Status = Planiran` — genuinely outstanding items, in both
-- directions. It is deliberately NOT "Izvor ∈ {Visa, Mastercard}": those rows
-- are historical card purchases that the lump settlement has long since paid,
-- so showing them as "planned" would be badly wrong. Splitting the planned
-- total into Dospjelo/Uskoro/Kasnije needs a bound on `Datum naplate` (§2.13)
-- and belongs to a later phase.
--
-- Run in Supabase SQL Editor. Idempotent — re-running replaces the config.
-- Paste the target area id in ONE place below.
-- ============================================================

DO $$
DECLARE
  -- Financije_all on TEST. On PROD, look the id up first:
  --   SELECT id, name, slug FROM areas WHERE slug = 'financije-all';
  v_area_id uuid := '98dd91f3-de77-4619-9d08-d1ade604640a';
  v_name    text;
BEGIN
  SELECT name INTO v_name FROM areas WHERE id = v_area_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Area % not found — check the id.', v_area_id;
  END IF;

  -- Merge, never replace: settings already carries automations, comment_template
  -- and export_profiles, and clobbering them would take the rata modal with it.
  UPDATE areas
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
    'dashboard', jsonb_build_object(
      'widgets', jsonb_build_array(
        jsonb_build_object(
          'type',      'balance_by_group',
          'title',     'Stanje po računu',
          'group_by',  'racun',
          'plus',      'uplata',
          'minus',     'isplata',
          'unit',      '€',
          'reconcile', true,
          'filters', jsonb_build_array(
            jsonb_build_object('slug', 'izvorplacanja', 'op', 'in',     'values', jsonb_build_array('Racun', 'Cash')),
            jsonb_build_object('slug', 'status',        'op', 'not_in', 'values', jsonb_build_array('Planiran'))
          ),
          'split', jsonb_build_object(
            'label', 'planirano',
            'filters', jsonb_build_array(
              jsonb_build_object('slug', 'status', 'op', 'in', 'values', jsonb_build_array('Planiran'))
            )
          )
        )
      )
    )
  )
  WHERE id = v_area_id;

  RAISE NOTICE 'dashboard config written to area "%" (%)', v_name, v_area_id;
END $$;


-- Verify:
-- SELECT name, jsonb_pretty(settings -> 'dashboard') FROM areas WHERE slug = 'financije-all';
--
-- Remove it again (the Overview tab disappears — OQ-4):
-- UPDATE areas SET settings = settings - 'dashboard' WHERE slug = 'financije-all';
