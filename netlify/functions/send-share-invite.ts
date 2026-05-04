import { createClient } from '@supabase/supabase-js';

interface InviteRequest {
  granteeEmail: string;
  areaId: string;
  areaName: string;
  permission: 'read' | 'write';
  redirectTo: string;
}

export const handler = async (event: {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
}) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Verify caller JWT
    const token = (event.headers['authorization'] || event.headers['Authorization'])?.replace('Bearer ', '');
    if (!token) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { data: { user: callerUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !callerUser) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const req: InviteRequest = JSON.parse(event.body || '{}');
    const { granteeEmail, areaId, areaName, permission, redirectTo } = req;

    if (!granteeEmail || !areaId || !permission) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const email = granteeEmail.toLowerCase().trim();

    // Insert share_invites BEFORE inviteUserByEmail to avoid race with DB trigger chain:
    // inviteUserByEmail → auth.users INSERT → handle_new_user → profiles INSERT → handle_pending_invites → data_shares INSERT
    const { error: inviteInsertErr } = await supabaseAdmin
      .from('share_invites')
      .insert({
        owner_id: callerUser.id,
        grantee_email: email,
        share_type: 'area',
        target_id: areaId,
        permission,
        status: 'pending',
      });

    // 23505 = duplicate key — pending invite already exists, still send email
    if (inviteInsertErr && inviteInsertErr.code !== '23505') {
      throw inviteInsertErr;
    }

    // Send Supabase invite email (creates user in auth.users if not exists)
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || `${process.env.URL || ''}/login`,
      data: {
        invited_by: callerUser.email ?? '',
        area_name: areaName ?? '',
      },
    });

    if (inviteErr) {
      // User already has a confirmed account — shouldn't normally reach here
      // (client checks profiles first), but handle gracefully
      if (inviteErr.message?.toLowerCase().includes('already been registered')) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ already_registered: true }),
        };
      }
      throw inviteErr;
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('send-share-invite error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to send invite' }),
    };
  }
};
