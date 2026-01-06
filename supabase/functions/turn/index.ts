import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function base64HmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cfApiToken = Deno.env.get("CF_API_TOKEN");
    
    if (!cfApiToken) {
      console.error('[TURN] CF_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'TURN credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttl = 3600; // 1 hour
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}`;

    const credential = await base64HmacSha256(cfApiToken, username);

    console.log('[TURN] Generated TURN credentials for user:', username);

    return new Response(
      JSON.stringify({
        urls: [
          "turn:turn.cloudflare.com:3478?transport=udp",
          "turn:turn.cloudflare.com:3478?transport=tcp",
          "turns:turn.cloudflare.com:5349?transport=tcp",
        ],
        username,
        credential,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('[TURN] Error generating credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate TURN credentials' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
