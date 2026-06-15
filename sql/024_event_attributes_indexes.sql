-- Fix: Add missing indexes on event_attributes for attribute filter performance
-- Without these indexes, filtered queries (e.g. Status=Izvrsen, Smjer=Isplata)
-- scan the entire event_attributes table and hit Supabase's 8s statement timeout.
--
-- Run on: TEST first, then PROD
-- Safe to run multiple times (IF NOT EXISTS).

-- Primary lookup: join events → event_attributes by event_id
-- Note: PostgreSQL does NOT auto-create indexes on FK columns (only on PK/referenced cols).
CREATE INDEX IF NOT EXISTS idx_event_attributes_event_id
  ON public.event_attributes(event_id);

-- Filter by attribute type (used in attr filter dropdown queries)
CREATE INDEX IF NOT EXISTS idx_event_attributes_attr_def_id
  ON public.event_attributes(attribute_definition_id);

-- Filter by attribute type + text value (the core attr filter query)
-- Enables: WHERE attribute_definition_id = X AND value_text = 'Isplata'
CREATE INDEX IF NOT EXISTS idx_event_attributes_attr_def_value_text
  ON public.event_attributes(attribute_definition_id, value_text);

-- Verify (run after creating indexes):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'event_attributes'
-- ORDER BY indexname;
