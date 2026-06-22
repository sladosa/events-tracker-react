-- S96: Add filter_state JSONB column to activity_presets
-- Stores dynamic period + sort order + filters for shortcut restoration.
-- Format: { "periodKey": "this-year", "sortOrder": "asc", "commentSearch": "", "attrFilter": null }

ALTER TABLE activity_presets
ADD COLUMN IF NOT EXISTS filter_state jsonb DEFAULT NULL;

COMMENT ON COLUMN activity_presets.filter_state IS 'Saved filter state: periodKey, sortOrder, commentSearch, attrFilter';
