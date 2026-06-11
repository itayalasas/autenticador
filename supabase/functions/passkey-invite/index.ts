import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveApplicationAuthUrl } from '../_shared/application-auth-url.ts';
import { resolveNotificationConfig, sendTemplatedEmail } from '../_shared/email-notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface InviteRequest {
  application_id: string;
  api_key: string;
  email: string;
  device_name?: string;
}

function resolvePasskeyEmailConfig(emailConfig: Record<string, any> = {}) {
  return resolveNotificationConfig({
    emailConfig,
    notificationKeys: ['passkey_setup'],
    defaultTemplate: 'confirmation_passkey',
    enabledDefault: false,
  });
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
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: InviteRequest = await req.json();
    const { application_id, api_key, email, device_name } = body;

    if (!application_id || !api_key || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'application_id, api_key and email are required' },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, application_id, name, email_config')
      .eq('application_id', application_id)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicacion no encontrada' },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('application_id, is_active, environment')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (!apiKeyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_API_KEY', message: 'API Key invalida o inactiva' },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (apiKeyData.application_id !== application.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicacion' },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, name, status')
      .eq('application_id', application.id)
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (user.status !== 'active') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { baseUrl, environmentName } = await resolveApplicationAuthUrl(
      supabase,
      application.id,
      (apiKeyData as any).environment || 'development'
    );

    if (!baseUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_URL_NOT_FOUND',
            message: 'No se encontro una URL de autenticacion para esta aplicacion',
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { enabled, templateName, apiUrl, apiKey } = resolvePasskeyEmailConfig(application.email_config || {});

    if (!enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PASSKEY_SETUP_EMAIL_DISABLED',
            message: 'La notificacion de passkey_setup no esta activada para esta aplicacion',
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!apiUrl || !apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'EMAIL_API_CONFIG_MISSING',
            message: 'No se encontro la configuracion de email para passkey_setup',
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const setupUrl = `${baseUrl}/passkey-setup?token=${token}&app_id=${encodeURIComponent(application.application_id)}`;

    const tokenPayloadFull = {
      application_id: application.id,
      app_user_id: user.id,
      token,
      email,
      device_name: device_name || null,
      expires_at: expiresAt,
      auth_url: baseUrl,
      environment_name: environmentName || null,
    };

    const tokenPayloadFallback = {
      application_id: application.id,
      app_user_id: user.id,
      token,
      email,
      device_name: device_name || null,
      expires_at: expiresAt,
    };

    const attemptInsert = async (payload: Record<string, unknown>) =>
      await supabase.from('passkey_setup_tokens').insert(payload);

    let { error: tokenError } = await attemptInsert(tokenPayloadFull);
    if (tokenError) {
      const errorText = `${tokenError.message || ''} ${tokenError.details || ''} ${tokenError.hint || ''}`.toLowerCase();
      if (errorText.includes('auth_url') || errorText.includes('environment_name') || errorText.includes('column')) {
        const retry = await attemptInsert(tokenPayloadFallback);
        tokenError = retry.error;
      }
    }

    if (tokenError) {
      console.error('Error creating passkey invite token:', tokenError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOKEN_CREATE_ERROR',
            message: tokenError.message || 'No se pudo generar la invitacion',
            details: {
              code: tokenError.code || null,
              details: tokenError.details || null,
              hint: tokenError.hint || null,
            },
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      await sendTemplatedEmail({
        apiUrl,
        apiKey,
        templateName: templateName || 'confirmation_passkey',
        recipientEmail: user.email,
        data: {
          client_name: user.name || user.email,
          passkey: token,
          setup_url: setupUrl,
          application_name: application.name,
          expires_at: expiresAt,
        },
      });
    } catch (emailError: any) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        to_email: user.email,
        from_email: application.email_config?.from_email || 'noreply@authsystem.com',
        from_name: application.email_config?.from_name || application.name || 'AuthSystem',
        subject: `Configuracion de passkey - ${application.name}`,
        html_content: '',
        status: 'failed',
        error_message: emailError?.message || 'Unknown error',
      });

      console.error('Email API error:', {
        message: emailError?.message || 'Unknown error',
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'EMAIL_SEND_ERROR',
            message: emailError?.message || 'No se pudo enviar la invitacion por correo',
            details: {
              api_url_configured: !!apiUrl,
              passkey_setup_enabled: enabled,
            },
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase.from('email_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      to_email: user.email,
      from_email: application.email_config?.from_email || 'noreply@authsystem.com',
      from_name: application.email_config?.from_name || application.name || 'AuthSystem',
      subject: `Configuracion de passkey - ${application.name}`,
      html_content: '',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      event_type: 'passkey_invite_sent',
      success: true,
      metadata: {
        email: user.email,
        device_name: device_name || null,
        setup_url: setupUrl,
        expires_at: expiresAt,
        template_name: templateName,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: 'Invitacion enviada exitosamente',
          setup_url: setupUrl,
          expires_at: expiresAt,
          template_name: templateName,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('passkey-invite error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
