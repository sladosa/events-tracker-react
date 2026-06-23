-- S97: GIN trigram index on event_attributes.value_text
-- Needed for "In any attribute" filter which uses ILIKE '%text%' without
-- attribute_definition_id restriction. Without this, full table scan → timeout.
-- pg_trgm is pre-enabled on Supabase.

CREATE INDEX IF NOT EXISTS idx_ea_value_text_trgm
ON event_attributes USING gin (value_text gin_trgm_ops);
