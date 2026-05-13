import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { generateDeviceToken, hashDeviceToken } from '../_shared/device-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RegisterDeviceRequest {
  pairing_token: string;
  pairing_code?: string;
  device_id: string;
  device_name?: string;
  push_token?: string;
  push_provider?: 'expo';
  device_platform?: string;
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
    const { pairing_token, pairing_code, device_id, device_name, push_token, push_provider, device_platform } = body;

    if ((!pairing_token && !pairing_code) || !device_id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'pairing_code or pairing_token and device_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const pairingQuery = supabase
      .from('mfa_pairing_tokens')
      .select('id, token, pairing_code, application_id, app_user_id, expires_at, used_at');

    const { data: pairing, error: pairingError } = pairing_code
      ? await pairingQuery.eq('pairing_code', pairing_code.trim().toUpperCase()).maybeSingle()
      : await pairingQuery.eq('token', pairing_token).maybeSingle();

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

    const { data: apiKeyRow } = await supabase
      .from('api_keys')
      .select('key_hash, created_at')
      .eq('application_id', pairing.application_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const applicationWithApiKey = application
      ? { ...application, api_key: apiKeyRow?.key_hash || null }
      : null;

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
          application: applicationWithApiKey,
          user: appUser,
          pairing_code: pairing.pairing_code,
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

    const deviceToken = generateDeviceToken();
    const deviceTokenHash = await hashDeviceToken(deviceToken);
    const tokenIssuedAt = new Date().toISOString();

    const { data: deviceRow, error: deviceError } = await supabase
      .from('mfa_devices')
      .upsert({
        application_id: pairing.application_id,
        app_user_id: pairing.app_user_id,
        device_id,
        device_name: device_name || 'AuthSystem Mobile',
        push_token: push_token || null,
        push_provider: push_provider || (push_token ? 'expo' : null),
        device_platform: device_platform || null,
        device_token_hash: deviceTokenHash,
        device_token_issued_at: tokenIssuedAt,
        device_token_last_used_at: tokenIssuedAt,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'application_id,app_user_id,device_id' })
      .select('id, application_id, app_user_id, device_id, device_name, push_token, push_provider, device_platform, is_active, created_at')
      .single();

    if (deviceError || !deviceRow) {
      console.error('Error registering mfa device:', deviceError);
      return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_REGISTRATION_ERROR', message: 'No se pudo registrar el dispositivo' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const linkedAt = new Date().toISOString();

    const { error: markUsedError } = await supabase
      .from('mfa_pairing_tokens')
      .update({ used_at: linkedAt })
      .eq('id', pairing.id);

    if (markUsedError) {
      console.error('Error marking pairing token as used:', markUsedError);
      return new Response(JSON.stringify({ success: false, error: { code: 'PAIRING_CONFIRMATION_ERROR', message: 'No se pudo confirmar la vinculación' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
        data: {
          status: 'linked',
          linked_at: linkedAt,
          device: deviceRow,
          device_token: deviceToken,
          application: applicationWithApiKey,
          user: appUser,
          pairing_code: pairing.pairing_code,
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
