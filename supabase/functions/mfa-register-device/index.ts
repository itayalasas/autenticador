import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RegisterDeviceRequest {
  pairing_token: string;
  device_id: string;
  device_name?: string;
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

    const body: RegisterDeviceRequest = await req.json();
    const { pairing_token, device_id, device_name } = body;

    if (!pairing_token || !device_id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'pairing_token and device_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: pairing, error: pairingError } = await supabase
      .from('mfa_pairing_tokens')
      .select('id, token, application_id, app_user_id, expires_at, used_at')
      .eq('token', pairing_token)
      .maybeSingle();

    if (pairingError || !pairing) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_PAIRING_TOKEN', message: 'Token de emparejamiento inválido' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: application } = await supabase
      .from('applications')
      .select('id, application_id, name')
      .eq('id', pairing.application_id)
      .maybeSingle();

    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, email, name')
      .eq('id', pairing.app_user_id)
      .maybeSingle();

    if (pairing.used_at) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          status: 'already_linked',
          linked_at: pairing.used_at,
          application,
          user: appUser,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (new Date(pairing.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: { code: 'PAIRING_TOKEN_EXPIRED', message: 'Token de emparejamiento expirado' } }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: deviceRow, error: deviceError } = await supabase
      .from('mfa_devices')
      .upsert({
        application_id: pairing.application_id,
        app_user_id: pairing.app_user_id,
        device_id,
        device_name: device_name || 'AuthSystem Mobile',
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'application_id,app_user_id,device_id' })
      .select('id, application_id, app_user_id, device_id, device_name, is_active, created_at')
      .single();

    if (deviceError || !deviceRow) {
      console.error('Error registering mfa device:', deviceError);
      return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_REGISTRATION_ERROR', message: 'No se pudo registrar el dispositivo' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const linkedAt = new Date().toISOString();

    await supabase
      .from('mfa_pairing_tokens')
      .update({ used_at: linkedAt })
      .eq('id', pairing.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: 'linked',
        linked_at: linkedAt,
        device: deviceRow,
        application,
        user: appUser,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-register-device error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
