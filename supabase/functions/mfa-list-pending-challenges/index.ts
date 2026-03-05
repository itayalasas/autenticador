import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ListChallengesRequest {
  application_id: string;
  api_key: string;
  email: string;
  password: string;
  device_id?: string;
  device_name?: string;
  push_token?: string;
  push_provider?: 'expo';
  device_platform?: string;
}

interface ValidationError {
  code: string;
  message: string;
}

interface ValidationResult {
  error?: ValidationError;
  application?: { id: string; application_id: string };
  user?: { id: string };
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

async function validateUser(supabase: ReturnType<typeof createClient>, body: ListChallengesRequest): Promise<ValidationResult> {
  const { application_id, api_key, email, password } = body;

  const { data: application } = await supabase
    .from('applications')
    .select('id, application_id')
    .eq('application_id', application_id)
    .maybeSingle();

  if (!application) return { error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } };

  const { data: apiKeyData } = await supabase
    .from('api_keys')
    .select('application_id, is_active')
    .eq('key_hash', api_key)
    .eq('is_active', true)
    .maybeSingle();

  if (!apiKeyData) return { error: { code: 'INVALID_API_KEY', message: 'API Key inválida' } };
  if (apiKeyData.application_id !== application.id) return { error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicación' } };

  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, password_hash, status')
    .eq('application_id', application.id)
    .eq('email', email)
    .maybeSingle();

  if (!user) return { error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } };
  if (user.status !== 'active') return { error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' } };

  const validPassword = await bcrypt.compare(password, user.password_hash || '');
  if (!validPassword) return { error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } };

  return { application, user };
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

    const body: ListChallengesRequest = await req.json();
    const { application_id, api_key, email, password, device_id, device_name, push_token, push_provider, device_platform } = body;

    if (!application_id || !api_key || !email || !password) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'application_id, api_key, email and password are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const validation = await validateUser(supabase, body);

    if (validation.error) {
      return new Response(JSON.stringify({ success: false, error: validation.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const app = validation.application!;
    const user = validation.user!;

    if (device_id) {
      const devicePatch: Record<string, unknown> = {
        application_id: app.id,
        app_user_id: user.id,
        device_id,
        device_name: device_name || 'AuthSystem Mobile',
        device_platform: device_platform || null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      };

      if (push_token) {
        devicePatch.push_token = push_token;
        devicePatch.push_provider = push_provider || 'expo';
      }

      await supabase
        .from('mfa_devices')
        .upsert(devicePatch, { onConflict: 'application_id,app_user_id,device_id' });
    }

    await supabase
      .from('mfa_login_challenges')
      .update({ status: 'expired' })
      .eq('application_id', app.id)
      .eq('app_user_id', user.id)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    const { data: challenges, error: challengesError } = await supabase
      .from('mfa_login_challenges')
      .select('id, challenge_code, status, expires_at, metadata, created_at')
      .eq('application_id', app.id)
      .eq('app_user_id', user.id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (challengesError) {
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_QUERY_ERROR', message: 'No se pudieron consultar los desafíos pendientes' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mfaSecret = Deno.env.get('MFA_CHALLENGE_SECRET') || 'authsystem-mfa-secret';
    const nowMs = Date.now();
    const nextRotationSeconds = DYNAMIC_MFA_WINDOW_SECONDS - (Math.floor(nowMs / 1000) % DYNAMIC_MFA_WINDOW_SECONDS);
    const currentDynamicCode = computeDynamicChallengeCode(app.id, user.id, nowMs, mfaSecret);

    const normalizedChallenges = (challenges || []).map((challenge: any) => ({
      ...challenge,
      challenge_code: computeDynamicChallengeCode(app.id, user.id, nowMs, mfaSecret),
      challenge_code_ttl_seconds: DYNAMIC_MFA_WINDOW_SECONDS,
      challenge_code_expires_in_seconds: nextRotationSeconds,
    }));

    return new Response(JSON.stringify({ success: true, data: {
      challenges: normalizedChallenges,
      current_challenge_code: currentDynamicCode,
      current_challenge_code_ttl_seconds: DYNAMIC_MFA_WINDOW_SECONDS,
      current_challenge_code_expires_in_seconds: nextRotationSeconds,
    } }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-list-pending-challenges error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
