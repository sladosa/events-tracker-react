-- Fix: Add missing index on event_attachments.event_id
-- Same class of bug as 024_event_attributes_indexes.sql: PostgreSQL does NOT
-- auto-create indexes on FK columns, so `.eq('event_id', ...)` on event_attachments
-- was a full table scan. On PROD (much more data than TEST) this hits Supabase's
-- statement timeout and PostgREST returns 500 — this is what caused View/Edit
-- Activity to fail loading event_attachments for a session (S104 follow-up, 2026-07-06).
--
-- Run on: TEST first, then PROD (Supabase SQL Editor).
-- Safe to run multiple times (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id
  ON public.event_attachments(event_id);

-- Verify (run after creating index):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'event_attachments'
-- ORDER BY indexname;
