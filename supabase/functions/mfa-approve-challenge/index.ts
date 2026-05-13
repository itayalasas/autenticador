import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import bcrypt from "npm:bcryptjs@2.4.3";
import { hashDeviceToken } from '../_shared/device-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ApproveRequest {
  application_id: string;
  api_key: string;
  email?: string;
  password?: string;
  device_token?: string;
  challenge_id: string;
  challenge_code: string;
  verification_number?: string;
  action?: 'approve' | 'reject';
}

const DYNAMIC_MFA_WINDOW_SECONDS = 60;

function computeDynamicChallengeCode(applicationInternalId: string, appUserId: string, timestampMs: number, secret: string): string {
  const window = Math.floor(timestampMs / (DYNAMIC_MFA_WINDOW_SECONDS * 1000));
  const seed = `${secret}|${applicationInternalId}|${appUserId}|${window}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;

  const code = (hash >>> 0) % 1000000;
  return code.toString().padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: ApproveRequest = await req.json();
    const { application_id, api_key, email, password, device_token, challenge_id, challenge_code, verification_number, action = 'approve' } = body;

    if (!application_id || !api_key || !challenge_id || !challenge_code || (!device_token && (!email || !password))) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields. Use device_token or email/password.' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: application } = await supabase.from('applications').select('id, application_id').eq('application_id', application_id).maybeSingle();
    if (!application) {
      return new Response(JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: apiKeyData } = await supabase.from('api_keys').select('application_id, is_active').eq('key_hash', api_key).eq('is_active', true).maybeSingle();
    if (!apiKeyData || apiKeyData.application_id !== application.id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_API_KEY', message: 'API Key inválida para la aplicación' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let user: any = null;

    if (device_token) {
      const deviceTokenHash = await hashDeviceToken(device_token);
      const { data: device } = await supabase
        .from('mfa_devices')
        .select('id, app_user_id, device_id, device_name, is_active')
        .eq('application_id', application.id)
        .eq('device_token_hash', deviceTokenHash)
        .maybeSingle();

      if (!device) {
        return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_TOKEN_NOT_FOUND', message: 'Token de dispositivo no encontrado' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!device.is_active) {
        return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_NOT_ACTIVE', message: 'El dispositivo está inactivo' } }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: deviceUser } = await supabase
        .from('app_users')
        .select('id, email, status')
        .eq('id', device.app_user_id)
        .maybeSingle();

      if (!deviceUser || deviceUser.status !== 'active') {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado o inactivo' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (email && deviceUser.email && deviceUser.email.toLowerCase() !== email.toLowerCase()) {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_MISMATCH', message: 'El correo no coincide con el dispositivo vinculado' } }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      user = deviceUser;

      await supabase
        .from('mfa_devices')
        .update({
          last_seen_at: new Date().toISOString(),
          device_token_last_used_at: new Date().toISOString(),
        })
        .eq('id', device.id);
    } else {
      const { data: passwordUser } = await supabase.from('app_users').select('id, email, password_hash, status').eq('application_id', application.id).eq('email', email).maybeSingle();
      if (!passwordUser || passwordUser.status !== 'active') {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado o inactivo' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const validPassword = await bcrypt.compare(password || '', passwordUser.password_hash || '');
      if (!validPassword) {
        return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      user = passwordUser;
    }

    const { data: challenge } = await supabase
      .from('mfa_login_challenges')
      .select('id, app_user_id, challenge_code, status, expires_at, metadata')
      .eq('id', challenge_id)
      .eq('application_id', application.id)
      .eq('app_user_id', user.id)
      .maybeSingle();

    if (!challenge) {
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_NOT_FOUND', message: 'Desafío no encontrado' } }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (challenge.status !== 'pending') {
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_NOT_PENDING', message: 'El desafío ya fue procesado' } }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (new Date(challenge.expires_at) < new Date()) {
      await supabase.from('mfa_login_challenges').update({ status: 'expired' }).eq('id', challenge.id);
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_EXPIRED', message: 'El desafío expiró' } }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const mfaSecret = Deno.env.get('MFA_CHALLENGE_SECRET') || 'authsystem-mfa-secret';
    const nowMs = Date.now();
    const currentDynamicCode = computeDynamicChallengeCode(application.id, challenge.app_user_id, nowMs, mfaSecret);
    const previousDynamicCode = computeDynamicChallengeCode(application.id, challenge.app_user_id, nowMs - (DYNAMIC_MFA_WINDOW_SECONDS * 1000), mfaSecret);

    const staticMatch = challenge.challenge_code === challenge_code;
    const dynamicMatch = challenge_code === currentDynamicCode || challenge_code === previousDynamicCode;

    if (!staticMatch && !dynamicMatch) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CHALLENGE_CODE', message: 'Código de desafío incorrecto' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'approve') {
      const expectedVerificationNumber = String((challenge as any)?.metadata?.verification_number || '').padStart(2, '0');
      if (expectedVerificationNumber) {
        const rawVerificationNumber = typeof verification_number === 'string' ? verification_number.trim() : '';
        if (rawVerificationNumber) {
          const providedVerificationNumber = rawVerificationNumber.padStart(2, '0');
          if (providedVerificationNumber !== expectedVerificationNumber) {
            return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_VERIFICATION_NUMBER', message: 'El número de verificación no coincide' } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      }
    }

    const nextStatus = action === 'reject' ? 'rejected' : 'approved';
    const patch: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'approved') patch.approved_at = new Date().toISOString();

    await supabase.from('mfa_login_challenges').update(patch).eq('id', challenge.id);

    return new Response(JSON.stringify({ success: true, data: { challenge_id: challenge.id, status: nextStatus } }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-approve-challenge error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
