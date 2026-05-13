import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { buildRedirectUrl, resolveApplicationAuthUrl } from '../_shared/application-auth-url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface GenerateTestCodeRequest {
  application_id: string;
  api_key: string;
  email: string;
  callback_url?: string;
  ttl_seconds?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST method is allowed',
          },
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowTestApi = (Deno.env.get('ALLOW_TEST_AUTH_CODE_API') || '').toLowerCase() === 'true';
    if (!allowTestApi) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: 'Test code API is disabled. Set ALLOW_TEST_AUTH_CODE_API=true to enable it.',
          },
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testSecret = Deno.env.get('TEST_AUTH_CODE_SECRET');
    if (testSecret) {
      const providedSecret = req.headers.get('x-test-secret');
      if (!providedSecret || providedSecret !== testSecret) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_TEST_SECRET',
              message: 'Invalid or missing x-test-secret header',
            },
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let requestBody: GenerateTestCodeRequest;
    try {
      requestBody = await req.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { application_id, api_key, email, ttl_seconds } = requestBody;

    if (!application_id || !api_key || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'application_id, api_key and email are required',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API Key inválida o inactiva',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name, application_id, domain')
      .eq('application_id', application_id)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Aplicación no encontrada',
          },
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKeyData.application_id !== application.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'API_KEY_MISMATCH',
            message: 'API Key no pertenece a esta aplicación',
          },
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('id, email, name, status, metadata, created_at')
      .eq('application_id', application.id)
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado para esta aplicación',
          },
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (user.status !== 'active') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_ACTIVE',
            message: 'El usuario no está activo',
          },
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const accessTokenPayload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      name: user.name,
      app_id: application.application_id,
      iat: now,
      exp: now + (24 * 60 * 60),
      iss: 'AuthSystem',
      aud: application.domain,
      source: 'auth-generate-test-code',
    };

    const refreshTokenPayload: Record<string, unknown> = {
      ...accessTokenPayload,
      type: 'refresh',
      exp: now + (30 * 24 * 60 * 60),
    };

    const access_token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`;
    const refresh_token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(refreshTokenPayload))}.signature`;

    const code = crypto.randomUUID();
    const boundedTtl = Math.max(60, Math.min(900, ttl_seconds ?? 300));
    const expiresAt = new Date(Date.now() + boundedTtl * 1000).toISOString();

    const { error: insertError } = await supabase.from('auth_codes').insert({
      code,
      access_token,
      refresh_token,
      user_id: user.id,
      application_id: application.id,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('Error inserting auth code:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CODE_GENERATION_FAILED',
            message: 'No se pudo generar el código de prueba',
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData: Record<string, unknown> = {
      code,
      state: 'authenticated',
      expires_at: expiresAt,
      exchange_endpoint: '/functions/v1/auth-exchange-code',
      exchange_payload: {
        code,
        application_id: application.application_id,
      },
    };

    const { callbackUrl: configuredCallbackUrl } = await resolveApplicationAuthUrl(
      supabase,
      application.id,
      (apiKeyData as any).environment || null
    );

    if (configuredCallbackUrl) {
      responseData.callback_url = buildRedirectUrl(configuredCallbackUrl, {
        code,
        application_id: application.application_id,
        state: 'authenticated',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('auth-generate-test-code error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
