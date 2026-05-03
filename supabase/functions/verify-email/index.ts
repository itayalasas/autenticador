import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerifyRequest {
  token: string;
  email?: string;
  application_id?: string;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let token: string | null = null;
    let email: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
      email = url.searchParams.get('email');
    } else if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as VerifyRequest;
      token = body.token || null;
      email = body.email || null;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'MISSING_TOKEN', message: 'Token is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tokenRow, error: tokenErr } = await supabase
      .from('email_verification_tokens')
      .select('id, app_user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token inválido' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenRow.used_at) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'TOKEN_USED', message: 'Este token ya fue utilizado' } }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'El token de verificación ha expirado' } }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: userErr } = await supabase
      .from('app_users')
      .select('id, email, name, status, metadata, application_id')
      .eq('id', tokenRow.app_user_id)
      .maybeSingle();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (email && user.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'EMAIL_MISMATCH', message: 'El email no coincide con el token' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const verifiedAt = new Date().toISOString();

    const verificationMeta = {
      email_verified: true,
      email_verified_at: verifiedAt,
      verification_token_id: tokenRow.id,
      verification_ip: ip,
      verification_user_agent: userAgent
    };

    const mergedMetadata = { ...(user.metadata || {}), ...verificationMeta };

    const { error: updateErr } = await supabase
      .from('app_users')
      .update({ status: 'active', metadata: mergedMetadata })
      .eq('id', user.id);

    if (updateErr) {
      console.error('Error activating user:', updateErr);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'DATABASE_ERROR', message: 'No se pudo activar la cuenta', details: updateErr.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('email_verification_tokens')
      .update({ used_at: verifiedAt })
      .eq('id', tokenRow.id);

    await supabase.from('auth_logs').insert({
      application_id: user.application_id,
      app_user_id: user.id,
      event_type: 'email_verified',
      ip_address: ip,
      user_agent: userAgent,
      success: true,
      metadata: {
        email: user.email,
        verified_at: verifiedAt,
        token_id: tokenRow.id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: 'Cuenta verificada y activada exitosamente',
          user_id: user.id,
          email: user.email,
          name: user.name,
          status: 'active',
          verified_at: verifiedAt
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('verify-email error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
