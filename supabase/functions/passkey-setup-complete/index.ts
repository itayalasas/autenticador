import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { verifyRegistrationResponse } from 'npm:@simplewebauthn/server';
import { bytesToBase64Url, getOriginAndRpId } from '../_shared/webauthn.ts';
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
  credential: any;
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
    const credential = body.credential;

    if (!token || !applicationId || !credential) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'token, application_id and credential are required' } }), {
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

    if (!invite.challenge || !invite.challenge_expires_at || new Date(invite.challenge_expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: { code: 'CHALLENGE_EXPIRED', message: 'El desafío de la clave de paso expiró. Vuelve a abrir el enlace.' } }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { baseUrl: resolvedAuthUrl } = await resolveApplicationAuthUrl(supabase, application.id, null);
    const authUrl = resolvedAuthUrl || Deno.env.get('PUBLIC_AUTH_URL') || '';
    const { origin, rpId } = getOriginAndRpId(authUrl);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: invite.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ success: false, error: { code: 'VERIFICATION_FAILED', message: 'No se pudo verificar la clave de paso' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    const registrationInfo: any = verification.registrationInfo;
    const credentialId = bytesToBase64Url(registrationInfo.credentialID);
    const publicKey = bytesToBase64Url(registrationInfo.credentialPublicKey);
    const transports = Array.isArray(credential?.response?.transports) ? credential.response.transports : [];
    const nowIso = new Date().toISOString();

    const { data: passkeyRow, error: passkeyError } = await supabase
      .from('passkeys')
      .insert({
        application_id: application.id,
        app_user_id: user.id,
        credential_id: credentialId,
        public_key: publicKey,
        counter: registrationInfo.counter || 0,
        transports,
        device_name: invite.device_name || credential?.response?.clientExtensionResults?.deviceName || 'Clave de paso',
        credential_device_type: registrationInfo.credentialDeviceType || null,
        credential_backed_up: !!registrationInfo.credentialBackedUp,
        is_active: true,
        last_used_at: nowIso,
      })
      .select('id, credential_id, device_name, created_at, last_used_at, is_active')
      .single();

    if (passkeyError || !passkeyRow) {
      console.error('Error saving passkey:', passkeyError);
      return new Response(JSON.stringify({ success: false, error: { code: 'PASSKEY_SAVE_ERROR', message: 'No se pudo guardar la clave de paso' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: updateError } = await supabase
      .from('passkey_setup_tokens')
      .update({
        used_at: nowIso,
        status: 'completed',
        passkey_id: passkeyRow.id,
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Error updating invite as used:', updateError);
      return new Response(JSON.stringify({ success: false, error: { code: 'INVITE_MARK_USED_ERROR', message: 'No se pudo finalizar la activación' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      event_type: 'passkey_created',
      success: true,
      metadata: {
        passkey_id: passkeyRow.id,
        credential_id: credentialId,
        device_name: passkeyRow.device_name,
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Clave de paso creada correctamente',
        passkey: passkeyRow,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('passkey-setup-complete error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
