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
--   `izvorplacanja = Racun` ONLY, NOT a plain sum per `Racun`.
--   `Racun` means "the account this is eventually charged to", so a card
--   purchase and the later lump settlement BOTH sit on the same account and a
--   naive sum counts the money twice. Measured on TEST (2025+2026):
--       this filter  →  ZABA    150,80        RF  −1.978,32   ← matches the model
--       naive sum    →  ZABA −22.943,71       RF  −2.280,23   ← nonsense
--   Full proof against the bank: SALDO_MODEL_NALAZI.md (17/30 months to the
--   cent; the naive sum 0/30).
--
-- ⚠ `Cash` WAS IN THIS FILTER UNTIL 2026-08-18 (S111) AND WAS WRONG
--   Same double count as the naive sum, one pot over. Cash is a POT, mirroring
--   the card: an ATM withdrawal is `Transfer | cash - bankomat` with
--   `Izvor = Racun` and ALREADY took the money off the account. Spending that
--   cash (`Izvor = Cash`) is what happened to money the bank has already lost.
--   Counting both takes it twice.
--       18.05.2026  −150,00  Transfer | cash - bankomat   (Izvor = Racun)
--       20.05.2026   −66,00  auto C5 | popravci           (Izvor = Cash)
--   Bank lost 150. This filter used to subtract 216.
--   Invisible for 18 months because the Area holds 46 withdrawals and exactly
--   ONE cash expense — and ZABA has no `Cash` row at all, which is why the
--   17/30 verification is untouched: it was true on the data it was measured on.
--   Mirror rule, two axes: a Transfer is IN the balance and OUT of the per-Tip
--   breakdown; a cash expense is OUT of the balance and IN the breakdown.
--   Rejected alternative (a real `Gotovina` account): OVERVIEW_TAB_SPEC §2.10.
--
-- `split` is `Status = Planiran` — genuinely outstanding items, in both
-- directions. It is deliberately NOT "Izvor ∈ {Visa, Mastercard}": those rows
-- are historical card purchases that the lump settlement has long since paid,
-- so showing them as "planned" would be badly wrong. Splitting the planned
-- total into Dospjelo/Uskoro/Kasnije needs a bound on `Datum naplate` (§2.13)
-- and belongs to a later phase.
--
-- ⚠ `split` CARRIES THE SAME `Izvor` FILTER AS THE BALANCE (added 2026-08-19)
--   It did not, and the two numbers therefore spoke about different money.
--   Measured on TEST:
--       split = Status Planiran only        →  −2.521,38  (13 rows)
--       split = Izvor Racun + Planiran      →  −2.089,86  ( 2 rows)
--   The 431,52 difference is planned CARD items, which will never leave the
--   account on their own — they leave through the planned lump settlement of
--   1.244,74, which is ALSO in that total. Same double count the balance filter
--   exists to prevent, one number to the right. A tile that says "balance X,
--   planned Y" must mean "Y will move X"; without the filter it did not.
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
            jsonb_build_object('slug', 'izvorplacanja', 'op', 'in',     'values', jsonb_build_array('Racun')),
            jsonb_build_object('slug', 'status',        'op', 'not_in', 'values', jsonb_build_array('Planiran'))
          ),
          'split', jsonb_build_object(
            'label', 'planirano',
            'filters', jsonb_build_array(
              jsonb_build_object('slug', 'izvorplacanja', 'op', 'in', 'values', jsonb_build_array('Racun')),
              jsonb_build_object('slug', 'status',        'op', 'in', 'values', jsonb_build_array('Planiran'))
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
