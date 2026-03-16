-- ============================================================
-- Migration 005 — Drop lookup_values table
-- Date: 2026-03-16
-- Session: S15
-- ============================================================
-- lookup_values was created in migration 001 but has never been
-- used by the React application. Dropdown options are stored in
-- attribute_definitions.validation_rules (jsonb) instead.
-- The useLookupValues() hook in useAttributeDefinitions.ts also
-- becomes dead code after this migration (see note below).
-- ============================================================
-- VERIFY before running:
--   SELECT COUNT(*) FROM public.lookup_values;   -- expect 0
-- ============================================================

DROP TABLE IF EXISTS public.lookup_values;

-- ============================================================
-- Post-migration cleanup required in React codebase:
--   src/hooks/useAttributeDefinitions.ts  — remove useLookupValues()
--   src/hooks/index.ts                    — remove useLookupValues export
--   src/types/database.ts                 — remove LookupValue interface
-- (These are safe to remove since the hook is never called)
-- ============================================================
