import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req: Request) => {
  console.log('=== CREATE-NOTIFICATION FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('Supabase URL:', supabaseUrl);
    console.log('Service Key exists:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase env vars missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => null);
    console.log('Request body:', body);
    
    if (!body) return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { user_id, title, message, type = 'system', link = null } = body;
    console.log('Parsed fields:', { user_id, title, message, type, link });
    
    if (!user_id || !title || !message) {
      console.error('Missing required fields:', { user_id: !!user_id, title: !!title, message: !!message });
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check user preferences: if appointment alerts are disabled, skip
    try {
      const { data: prefs, error: prefErr } = await client
        .from('notification_preferences')
        .select('appointment_alerts')
        .eq('user_id', user_id)
        .maybeSingle();

      if (prefErr) {
        console.warn('Could not read notification preferences, proceeding with insert', prefErr);
      } else if (prefs && prefs.appointment_alerts === false && type === 'appointment') {
        return new Response(JSON.stringify({ skipped: true, reason: 'User disabled appointment alerts' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.warn('Error reading preferences, continuing to insert', e);
    }

    const { data, error } = await client
      .from('notifications')
      .insert([{ user_id, title, message, type, link }]);

    if (error) {
      console.error('❌ Error inserting notification:', error);
      return new Response(JSON.stringify({ error: error.message || 'Insert failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('✅ Notification inserted successfully:', data);
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in create-notification function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
