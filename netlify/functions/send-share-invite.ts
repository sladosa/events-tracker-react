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

    // Insert share_invites BEFORE generateLink to avoid race with DB trigger chain:
    // auth.users INSERT → handle_new_user → profiles INSERT → handle_pending_invites → data_shares INSERT
    const { data: insertedInvite, error: inviteInsertErr } = await supabaseAdmin
      .from('share_invites')
      .insert({
        owner_id: callerUser.id,
        grantee_email: email,
        share_type: 'area',
        target_id: areaId,
        permission,
        status: 'pending',
      })
      .select('id')
      .single();

    // 23505 = duplicate key — pending invite already exists, fetch its ID
    let inviteId: string | null = null;
    if (inviteInsertErr?.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('share_invites')
        .select('id')
        .eq('owner_id', callerUser.id)
        .eq('grantee_email', email)
        .eq('status', 'pending')
        .maybeSingle();
      inviteId = (existing as { id?: string } | null)?.id ?? null;
    } else if (inviteInsertErr) {
      throw inviteInsertErr;
    } else {
      inviteId = (insertedInvite as { id?: string } | null)?.id ?? null;
    }

    // Generate invite link via admin API (no email rate limits, works regardless of SMTP config).
    // The returned action_link is equivalent to the email link — AuthPage #type=invite handles it.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: redirectTo || `${process.env.URL || ''}/login`,
        data: {
          invited_by: callerUser.email ?? '',
          area_name: areaName ?? '',
        },
      },
    });

    if (linkErr) {
      const msg = linkErr.message?.toLowerCase() ?? '';
      if (msg.includes('already been registered') || msg.includes('email already confirmed')) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ already_registered: true }),
        };
      }
      throw linkErr;
    }

    const actionLink = linkData?.properties?.action_link ?? null;

    // Save action_link to DB so /invite/:id redirect can look it up
    if (inviteId && actionLink) {
      await supabaseAdmin
        .from('share_invites')
        .update({ action_link: actionLink })
        .eq('id', inviteId);
    }

    // Return clean URL on our domain instead of raw Supabase verify URL
    const baseUrl = process.env.URL || 'http://localhost:8888';
    const cleanInviteUrl = inviteId ? `${baseUrl}/invite/${inviteId}` : actionLink;
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, invite_link: cleanInviteUrl }),
    };
  } catch (err) {
    console.error('send-share-invite error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to send invite' }),
    };
  }
};
