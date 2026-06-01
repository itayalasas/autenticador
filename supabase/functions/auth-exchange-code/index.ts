import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveApplicationJwtSecret, verifyAuthToken } from '../_shared/auth-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ExchangeRequest {
  code: string;
  application_id?: string;
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
            message: 'Only POST method is allowed'
          }
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { code, application_id }: ExchangeRequest = requestBody;

    if (!code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Code is required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Looking up auth code:', code);

    const { data: authCode, error: codeError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (codeError || !authCode) {
      console.log('Auth code not found:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid or expired authorization code'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (authCode.used_at) {
      console.log('Auth code already used:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CODE_ALREADY_USED',
            message: 'Authorization code has already been used'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (new Date(authCode.expires_at) < new Date()) {
      console.log('Auth code expired:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CODE_EXPIRED',
            message: 'Authorization code has expired'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: application } = await supabase
      .from('applications')
      .select('application_id, jwt_secret')
      .eq('id', authCode.application_id)
      .single();

    if (!application) {
      console.log('Application not found for auth code');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Application not found for authorization code'
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (application_id && application.application_id !== application_id) {
      console.log('Application ID mismatch');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_MISMATCH',
            message: 'Application ID does not match'
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    await supabase
      .from('auth_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code', code);

    const jwtSecret = await resolveApplicationJwtSecret(supabase, authCode.application_id, application.jwt_secret);

    try {
      await verifyAuthToken(authCode.access_token, jwtSecret);
    } catch (error) {
      console.error('Error verifying token signature:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN_SIGNATURE',
            message: 'El token asociado al código no tiene una firma válida'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Code exchanged successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          access_token: authCode.access_token,
          refresh_token: authCode.refresh_token,
          token_type: 'Bearer',
          expires_in: 86400,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Exchange code error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
