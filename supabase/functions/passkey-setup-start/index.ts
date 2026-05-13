import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { generateRegistrationOptions } from 'npm:@simplewebauthn/server';
import { getOriginAndRpId } from '../_shared/webauthn.ts';
import { resolveApplicationAuthUrl } from '../_shared/application-auth-url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RequestBody {
  token: string;
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

    const body: RequestBody = await req.json();
    const token = (body.token || '').trim();
    const applicationId = (body.application_id || '').trim();

    if (!token || !applicationId) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'token and application_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: application } = await supabase
      .from('applications')
      .select('id, application_id, name')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (!application) {
      return new Response(JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: invite } = await supabase
      .from('passkey_setup_tokens')
      .select('*')
      .eq('token', token)
      .eq('application_id', application.id)
      .maybeSingle();

    if (!invite) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVITE_NOT_FOUND', message: 'La invitación no existe' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (invite.used_at) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVITE_USED', message: 'La invitación ya fue utilizada' } }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (invite.status === 'cancelled') {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVITE_CANCELLED', message: 'La invitación fue cancelada' } }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVITE_EXPIRED', message: 'La invitación expiró' } }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { baseUrl: resolvedAuthUrl } = await resolveApplicationAuthUrl(supabase, application.id, null);
    const authUrl = resolvedAuthUrl || Deno.env.get('PUBLIC_AUTH_URL') || '';
    const { origin, rpId } = getOriginAndRpId(authUrl);

    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, name')
      .eq('id', invite.app_user_id)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: branding } = await supabase
      .from('branding_configs')
      .select('primary_color, secondary_color, background_color, text_color, logo_url, favicon_url, custom_texts')
      .eq('application_id', application.id)
      .maybeSingle();

    const { data: existingPasskeys } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('application_id', application.id)
      .eq('app_user_id', user.id)
      .eq('is_active', true);

    const options = await generateRegistrationOptions({
      rpName: application.name,
      rpID: rpId,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: (existingPasskeys || []).map((item: any) => ({
        id: item.credential_id,
        type: 'public-key' as const,
      })),
    });

    const challengeExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('passkey_setup_tokens')
      .update({
        challenge: options.challenge,
        challenge_expires_at: challengeExpiresAt,
        status: 'challenge_ready',
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Error saving passkey challenge:', updateError);
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_SAVE_ERROR', message: 'No se pudo preparar el desafío de la clave de paso' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      event_type: 'passkey_setup_started',
      success: true,
      metadata: {
        invite_id: invite.id,
        origin,
        rp_id: rpId,
        device_name: invite.device_name || null,
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        application: {
          id: application.id,
          application_id: application.application_id,
          name: application.name,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        options,
        expires_at: invite.expires_at,
        challenge_expires_at: challengeExpiresAt,
        device_name: invite.device_name || 'Mi teléfono',
        branding: branding || {},
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('passkey-setup-start error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
