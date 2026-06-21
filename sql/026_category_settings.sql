-- Add settings JSONB column to categories table.
-- Used for per-category overrides, starting with comment_template.
-- { "comment_template": "{napomena} ({tip})" }

ALTER TABLE categories ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
