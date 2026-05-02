-- Migration 017: Add settings JSONB column to areas
-- Used for per-area behaviour flags, starting with disable_save_plus.
-- { "disable_save_plus": true } hides the Save+ button in Add Activity
-- for areas where each entry is a separate transaction (e.g. Financije).

ALTER TABLE areas ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
