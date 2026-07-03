import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveApplicationAuthUrl } from '../_shared/application-auth-url.ts';
import { resolveNotificationConfig, sendTemplatedEmail } from '../_shared/email-notifications.ts';

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

function extractVerificationToken(...rawCandidates: Array<string | null | undefined>): string {
  for (const rawToken of rawCandidates) {
    const value = (rawToken || '').trim();
    if (!value) continue;

    const match = value.match(/[a-f0-9]{64}/i);
    if (match?.[0]) {
      return match[0];
    }
  }

  return '';
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

Deno.serve(async (req: Request) => {
  const rid = crypto.randomUUID();
  console.log(`[verify-email][${rid}] incoming`, req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    console.log(`[verify-email][${rid}] env check`, {
      has_url: !!supabaseUrl,
      has_service_key: !!serviceKey,
      url_prefix: supabaseUrl.slice(0, 40)
    });

    const supabase = createClient(supabaseUrl, serviceKey);

    let token: string | null = null;
    let email: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = extractVerificationToken(
        url.searchParams.get('token'),
        req.url
      );
      email = url.searchParams.get('email');
    } else if (req.method === 'POST') {
      const raw = await req.text();
      console.log(`[verify-email][${rid}] raw body`, raw);
      let body: VerifyRequest = {} as any;
      try { body = raw ? JSON.parse(raw) : {}; } catch (e) {
        console.error(`[verify-email][${rid}] JSON parse error`, e);
      }
      token = extractVerificationToken(
        body.token || null,
        raw
      );
      email = body.email || null;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-email][${rid}] parsed`, {
      token_length: token?.length ?? 0,
      token_preview: token ? `${token.slice(0, 8)}...${token.slice(-6)}` : null,
      email,
      request_url_preview: req.url.slice(0, 220)
    });

    if (!token) {
      console.warn(`[verify-email][${rid}] MISSING_TOKEN`);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'MISSING_TOKEN', message: 'Token is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tokenRow, error: tokenErr } = await supabase
      .from('email_verification_tokens')
      .select('id, app_user_id, expires_at, used_at, created_at')
      .eq('token', token)
      .maybeSingle();

    console.log(`[verify-email][${rid}] token lookup`, {
      found: !!tokenRow,
      error: tokenErr?.message,
      error_code: (tokenErr as any)?.code,
      error_details: (tokenErr as any)?.details,
      row: tokenRow
    });

    if (tokenErr) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'DB_ERROR', message: 'Error buscando el token', details: tokenErr.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenRow) {
      console.warn(`[verify-email][${rid}] TOKEN NOT FOUND`);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token inválido' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenRow.used_at) {
      console.warn(`[verify-email][${rid}] TOKEN_USED`, tokenRow.used_at);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'TOKEN_USED', message: 'Este token ya fue utilizado' } }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresAtMs = new Date(tokenRow.expires_at).getTime();
    const nowMs = Date.now();
    console.log(`[verify-email][${rid}] expiry check`, {
      expires_at: tokenRow.expires_at,
      now: new Date(nowMs).toISOString(),
      expired: expiresAtMs < nowMs
    });

    if (expiresAtMs < nowMs) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'El token de verificación ha expirado' } }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: user, error: userErr } = await supabase
      .from('app_users')
      .select('id, email, name, status, metadata, application_id, applications:application_id(application_id)')
      .eq('id', tokenRow.app_user_id)
      .maybeSingle();

    console.log(`[verify-email][${rid}] user lookup`, {
      found: !!user,
      error: userErr?.message,
      user_id: user?.id,
      user_email: user?.email,
      user_status: user?.status
    });

    if (userErr) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'DB_ERROR', message: 'Error buscando el usuario', details: userErr.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (email && user.email.toLowerCase() !== email.toLowerCase()) {
      console.warn(`[verify-email][${rid}] EMAIL_MISMATCH_IGNORED`, {
        provided: email,
        actual: user.email,
        reason: 'token is already the source of truth for verification',
      });
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
      console.error(`[verify-email][${rid}] user update error`, updateErr);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'DATABASE_ERROR', message: 'No se pudo activar la cuenta', details: updateErr.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: tokenUpdateErr } = await supabase
      .from('email_verification_tokens')
      .update({ used_at: verifiedAt })
      .eq('id', tokenRow.id);

    if (tokenUpdateErr) {
      console.error(`[verify-email][${rid}] token update error`, tokenUpdateErr);
    }

    const { error: logErr } = await supabase.from('auth_logs').insert({
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

    if (logErr) {
      console.error(`[verify-email][${rid}] auth_log insert error`, logErr);
    }

    const { data: application } = await supabase
      .from('applications')
      .select('id, application_id, name, domain, metadata, email_config')
      .eq('id', user.application_id)
      .maybeSingle();

    const { data: publicKey } = await supabase
      .from('api_keys')
      .select('key, key_hash, environment')
      .eq('application_id', user.application_id)
      .eq('is_public', true)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const publicApiKey = publicKey?.key ?? publicKey?.key_hash ?? null;
    const applicationSlug = application?.application_id ?? (user as any)?.applications?.application_id ?? null;

    try {
      const emailConfig = application?.email_config || {};
      const welcomeNotification = resolveNotificationConfig({
        emailConfig,
        notificationKeys: ['welcome'],
        defaultTemplate: 'welcome-authsystem',
        enabledDefault: false,
        enabledCandidates: [
          { source: 'application.email_config.send_welcome_email', value: emailConfig?.send_welcome_email },
        ],
      });

      console.log(`[verify-email][${rid}] welcome notification resolution`, {
        enabled: welcomeNotification.enabled,
        enabled_source: welcomeNotification.enabledSource,
        template_name: welcomeNotification.templateName,
        template_source: welcomeNotification.templateSource,
        api_url: welcomeNotification.apiUrl,
        api_url_source: welcomeNotification.apiUrlSource,
        api_key_source: welcomeNotification.apiKeySource,
        has_notification_entry: !!welcomeNotification.key,
        has_app_email_url: !!emailConfig?.external_email_api_url,
        has_app_email_key: !!emailConfig?.external_email_api_key,
        has_env_email_url: !!Deno.env.get('EMAIL_API_URL'),
        has_env_email_key: !!Deno.env.get('EMAIL_API_KEY'),
      });

      if (welcomeNotification.enabled) {
        if (!welcomeNotification.apiUrl || !welcomeNotification.apiKey) {
          throw new Error('Missing external email API configuration for welcome email');
        }

        const { baseUrl } = await resolveApplicationAuthUrl(
          supabase,
          user.application_id,
          publicKey?.environment || null
        );

        const loginBaseUrl = baseUrl || application?.domain || '';
        const loginUrl = loginBaseUrl
          ? `${loginBaseUrl.replace(/\/$/, '')}/login?app_id=${encodeURIComponent(applicationSlug || '')}${publicApiKey ? `&api_key=${encodeURIComponent(publicApiKey)}` : ''}`
          : '';

        const requestedTemplate = welcomeNotification.templateName || 'welcome-authsystem';
        const attemptedTemplates = Array.from(
          new Set([
            requestedTemplate,
            requestedTemplate === 'welcome-authsystem' ? 'welcome' : null,
          ].filter(Boolean))
        ) as string[];

        let sentTemplate: string | null = null;
        let lastTemplateError: Error | null = null;

        for (const templateName of attemptedTemplates) {
          try {
            console.log(`[verify-email][${rid}] sending welcome email`, {
              recipient: user.email,
              template_name: templateName,
              login_url: loginUrl,
            });

            await sendTemplatedEmail({
              apiUrl: welcomeNotification.apiUrl,
              apiKey: welcomeNotification.apiKey,
              templateName,
              recipientEmail: user.email,
              data: {
                user_name: user.name || user.email,
                application_name: application?.name || 'AuthSystem',
                login_url: loginUrl,
              },
            });

            sentTemplate = templateName;
            break;
          } catch (templateError: any) {
            lastTemplateError = templateError instanceof Error ? templateError : new Error(String(templateError));
            const message = lastTemplateError.message || '';
            const canRetryWithNextTemplate =
              attemptedTemplates[attemptedTemplates.length - 1] !== templateName &&
              (/template not found/i.test(message) || /404/.test(message));

            console.warn(`[verify-email][${rid}] welcome template attempt failed`, {
              template_name: templateName,
              message,
              can_retry_with_next_template: canRetryWithNextTemplate,
            });

            if (!canRetryWithNextTemplate) {
              throw lastTemplateError;
            }
          }
        }

        if (!sentTemplate) {
          throw lastTemplateError || new Error('Welcome email could not be sent');
        }

        await supabase.from('email_logs').insert({
          to_email: user.email,
          from_email: emailConfig.from_email || 'noreply@authsystem.com',
          from_name: emailConfig.from_name || application?.name || 'AuthSystem',
          subject: `Bienvenido a ${application?.name || 'AuthSystem'}`,
          html_content: '',
          status: 'sent',
          application_id: user.application_id,
          app_user_id: user.id,
          sent_at: new Date().toISOString(),
        });
        console.log(`[verify-email][${rid}] welcome email sent`, {
          recipient: user.email,
          template_name: sentTemplate,
        });
      } else {
        console.log(`[verify-email][${rid}] welcome email skipped because notification is disabled`);
      }
    } catch (welcomeError: any) {
      console.error(`[verify-email][${rid}] welcome email error`, welcomeError);
      await supabase.from('email_logs').insert({
        to_email: user.email,
        from_email: application?.email_config?.from_email || 'noreply@authsystem.com',
        from_name: application?.email_config?.from_name || application?.name || 'AuthSystem',
        subject: `Bienvenido a ${application?.name || 'AuthSystem'}`,
        html_content: '',
        status: 'failed',
        error_message: welcomeError?.message || 'Unknown error',
        application_id: user.application_id,
        app_user_id: user.id,
      });
    }

    console.log(`[verify-email][${rid}] SUCCESS`, {
      user_id: user.id,
      has_public_key: !!publicApiKey,
      application_slug: applicationSlug
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
          verified_at: verifiedAt,
          application_id: applicationSlug,
          api_key: publicApiKey
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[verify-email][${rid}] UNCAUGHT`, error, error?.stack);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor', details: error?.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
