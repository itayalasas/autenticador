import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface PairingRequest {
  application_id: string;
  api_key: string;
  email: string;
  password: string;
}

const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let raw = '';

  for (let index = 0; index < bytes.length; index += 1) {
    raw += PAIRING_CODE_ALPHABET[bytes[index] % PAIRING_CODE_ALPHABET.length];
  }

  return raw.match(/.{1,4}/g)?.join('-') || raw;
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

    const body: PairingRequest = await req.json();
    const { application_id, api_key, email, password } = body;

    if (!application_id || !api_key || !email || !password) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'application_id, api_key, email and password are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, application_id, name, metadata')
      .eq('application_id', application_id)
      .maybeSingle();

    if (appError || !application) {
      return new Response(JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('id, application_id, is_active')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (!apiKeyData) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_API_KEY', message: 'API Key inválida o inactiva' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (apiKeyData.application_id !== application.id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicación' } }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, name, password_hash, status')
      .eq('application_id', application.id)
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (user.status !== 'active') {
      return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' } }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash || '');
    if (!validPassword) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const pairingCode = generatePairingCode();

    const { data: tokenRow, error: tokenError } = await supabase
      .from('mfa_pairing_tokens')
      .insert({
        application_id: application.id,
        app_user_id: user.id,
        expires_at: expiresAt,
        pairing_code: pairingCode,
      })
      .select('token, pairing_code, expires_at')
      .single();

    if (tokenError || !tokenRow) {
      console.error('Error creating pairing token:', tokenError);
      return new Response(JSON.stringify({ success: false, error: { code: 'PAIRING_TOKEN_ERROR', message: 'No se pudo generar token de emparejamiento' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const qrPayload = {
      type: 'authsystem-mfa-pair',
      pairing_token: tokenRow.token,
      pairing_code: tokenRow.pairing_code,
      application_id: application.application_id,
      app_name: application.name,
      expires_at: tokenRow.expires_at,
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        pairing_token: tokenRow.token,
        pairing_code: tokenRow.pairing_code,
        expires_at: tokenRow.expires_at,
        qr_payload: qrPayload,
        qr_text: JSON.stringify(qrPayload),
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-generate-pairing-token error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
