import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CheckPairingRequest {
  pairing_token: string;
  application_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: CheckPairingRequest = await req.json();
    const { pairing_token, application_id } = body;

    if (!pairing_token || !application_id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'pairing_token and application_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: application } = await supabase
      .from('applications')
      .select('id, application_id')
      .eq('application_id', application_id)
      .maybeSingle();

    if (!application) {
      return new Response(JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: pairing } = await supabase
      .from('mfa_pairing_tokens')
      .select('id, token, expires_at, used_at, app_user_id')
      .eq('token', pairing_token)
      .eq('application_id', application.id)
      .maybeSingle();

    if (!pairing) {
      return new Response(JSON.stringify({ success: true, data: { status: 'invalid' } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pairing.used_at) {
      return new Response(JSON.stringify({ success: true, data: { status: 'linked', linked_at: pairing.used_at } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (new Date(pairing.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: true, data: { status: 'expired', expires_at: pairing.expires_at } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data: { status: 'pending', expires_at: pairing.expires_at } }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-check-pairing-token error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
