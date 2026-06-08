-- 022_preset_default_attributes.sql
-- Shortcut pre-fill (S88): activity_presets dobiva default_attributes JSONB.
--
-- Format: { [attribute_definition_id]: value } — keyed by attribute_definition UUID
-- (ne slug, jer se slug može mijenjati — S56 rename feature).
--
-- Postojeće RLS politike (sql/015_activity_presets_rls.sql) pokrivaju sve kolone
-- preko user_id = auth.uid(), nije potrebna nova politika.
--
-- Pokrenuti u Supabase SQL Editor — prvo TEST, zatim PROD.
-- Idempotentno — IF NOT EXISTS sprječava grešku pri ponovnom pokretanju.

alter table activity_presets
  add column if not exists default_attributes jsonb;
