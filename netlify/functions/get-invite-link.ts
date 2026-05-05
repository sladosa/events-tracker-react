import { createClient } from '@supabase/supabase-js';

export const handler = async (event: {
  httpMethod: string;
  queryStringParameters: Record<string, string> | null;
}) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing id' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin
    .from('share_invites')
    .select('action_link, status')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Invite not found' }) };
  }

  const row = data as { action_link: string | null; status: string };

  // Invite was already processed (DB trigger auto-accepted it)
  if (row.status === 'accepted') {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ already_accepted: true }) };
  }

  if (!row.action_link) {
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Invite link not available — try requesting a new invite' }) };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ action_link: row.action_link }),
  };
};
