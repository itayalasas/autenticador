import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { buildRedirectUrl } from '../_shared/application-auth-url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CheckRequest {
  challenge_id: string;
  application_id: string;
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
      return new Response(JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: CheckRequest = await req.json();
    const { challenge_id, application_id } = body;

    if (!challenge_id || !application_id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'challenge_id and application_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

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

    const { data: challenge } = await supabase
      .from('mfa_login_challenges')
      .select('id, app_user_id, challenge_code, status, expires_at, consumed_at, approved_at, access_token, refresh_token, callback_url, metadata')
      .eq('id', challenge_id)
      .eq('application_id', application.id)
      .maybeSingle();

    if (!challenge) {
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_NOT_FOUND', message: 'Desafío no encontrado' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (challenge.status === 'pending' && new Date(challenge.expires_at) < new Date()) {
      await supabase.from('mfa_login_challenges').update({ status: 'expired' }).eq('id', challenge.id);
      return new Response(JSON.stringify({ success: true, data: { status: 'expired' } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (challenge.status !== 'approved') {
      const mfaSecret = Deno.env.get('MFA_CHALLENGE_SECRET') || 'authsystem-mfa-secret';
      const nowMs = Date.now();
      const nextRotationSeconds = DYNAMIC_MFA_WINDOW_SECONDS - (Math.floor(nowMs / 1000) % DYNAMIC_MFA_WINDOW_SECONDS);
      const verificationNumber = String((challenge as any)?.metadata?.verification_number || '').padStart(2, '0');

      return new Response(JSON.stringify({ success: true, data: {
        status: challenge.status,
        approved_at: challenge.approved_at,
        expires_at: challenge.expires_at,
        challenge_code: challenge.status === 'pending' ? computeDynamicChallengeCode(application.id, challenge.app_user_id, nowMs, mfaSecret) : null,
        challenge_code_ttl_seconds: DYNAMIC_MFA_WINDOW_SECONDS,
        challenge_code_expires_in_seconds: nextRotationSeconds,
        verification_number: verificationNumber || null,
      } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (challenge.consumed_at) {
      return new Response(JSON.stringify({ success: true, data: { status: 'approved_consumed' } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let callback_url: string | null = null;

    if (challenge.callback_url) {
      const authCode = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase.from('auth_codes').insert({
        code: authCode,
        access_token: challenge.access_token,
        refresh_token: challenge.refresh_token,
        user_id: challenge.app_user_id,
        application_id: application.id,
        expires_at: expiresAt,
      });

      callback_url = buildRedirectUrl(challenge.callback_url, {
        code: authCode,
        application_id: application.application_id,
        state: 'authenticated'
      });
    }

    await supabase
      .from('mfa_login_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', challenge.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: 'approved',
        access_token: challenge.access_token,
        refresh_token: challenge.refresh_token,
        token_type: 'Bearer',
        expires_in: 86400,
        callback_url,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-check-challenge error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
