-- ============================================================
-- 013_help_tables.sql
-- AI Help log + User Feedback tables
-- Run on: TEST + PROD
-- ============================================================

-- help_log: logs AI help queries (inserted by Netlify Function via service role)
CREATE TABLE IF NOT EXISTS public.help_log (
  id           uuid         DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid,
  question     text         NOT NULL,
  answer       text,
  context      jsonb        DEFAULT '{}',
  tokens_used  integer,
  created_at   timestamptz  DEFAULT now(),
  CONSTRAINT help_log_pkey PRIMARY KEY (id),
  CONSTRAINT help_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.help_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log; insert is done by service role (no INSERT policy needed)
CREATE POLICY "help_log_select" ON public.help_log
  FOR SELECT USING (auth.uid() = user_id);

-- feedback: user feedback submitted from the app (inserted by frontend via anon key + RLS)
CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid,
  type        text        NOT NULL CHECK (type IN ('wish', 'bug', 'question')),
  message     text        NOT NULL,
  context     jsonb       DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback_select" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Verify after running:
-- SELECT count(*) FROM public.help_log;   -- expected: 0
-- SELECT count(*) FROM public.feedback;   -- expected: 0
-- ============================================================
