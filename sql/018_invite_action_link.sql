-- S70: add action_link to share_invites for clean invite URL redirect
-- /invite/:id route reads this column to redirect to Supabase verify URL
ALTER TABLE share_invites ADD COLUMN IF NOT EXISTS action_link text;
