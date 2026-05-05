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
    .select('action_link')
    .eq('id', id)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !(data as { action_link?: string } | null)?.action_link) {
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Invite not found or expired' }) };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ action_link: (data as { action_link: string }).action_link }),
  };
};
