// Commissioner-only. Sets (or bootstraps) a manager's login password.
// Must run server-side: creating/updating another user's password requires the
// service-role key, which never ships to the browser bundle.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isCommissioner, error: authCheckErr } = await callerClient.rpc('is_commissioner');
  if (authCheckErr || !isCommissioner) {
    return json({ error: 'Forbidden: commissioner only' }, 403);
  }

  let body: { manager_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { manager_id, password } = body;
  if (!manager_id || !password || password.length < 8) {
    return json({ error: 'manager_id and a password of at least 8 characters are required' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: manager, error: managerErr } = await adminClient
    .from('managers')
    .select('*')
    .eq('id', manager_id)
    .single();
  if (managerErr || !manager) {
    return json({ error: 'Manager not found' }, 404);
  }

  if (manager.user_id) {
    const { error: updErr } = await adminClient.auth.admin.updateUserById(manager.user_id, { password });
    if (updErr) return json({ error: updErr.message }, 500);
  } else {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: manager.email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Could not create login for this manager' }, 500);
    }
    const { error: linkErr } = await adminClient
      .from('managers')
      .update({ user_id: created.user.id })
      .eq('id', manager_id);
    if (linkErr) return json({ error: linkErr.message }, 500);
  }

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
