import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import bcrypt from "npm:bcryptjs@2.4.3";
import { buildRedirectUrl, normalizeUrl, resolveApplicationAuthUrl, resolveTrustedApplicationCallbackUrl } from '../_shared/application-auth-url.ts';
import { ensureSelectedPlanSubscription } from '../_shared/application-billing.ts';
import { buildEnvironmentScopedMetadata, normalizeEnvironmentName } from '../_shared/environment-access.ts';
import { resolveRoleAccess } from '../_shared/role-access.ts';
import { issueAuthTokens, resolveApplicationJwtSecret } from '../_shared/auth-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

interface RegisterRequest {
  email: string
  password: string
  name: string
  application_id: string
  api_key: string
  role?: string
  callback_url?: string
  client_ip?: string
  metadata?: Record<string, any>
  tenant_id?: string
}

function generateVerificationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sendExternalConfirmationEmail(params: {
  recipientEmail: string;
  userName: string;
  applicationName: string;
  confirmUrl: string;
  requestIp: string;
}, emailConfig: Record<string, any> = {}) {
  const now = new Date();
  const requestDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const notificationCfg =
    emailConfig?.notifications?.registration ||
    emailConfig?.notifications?.email_verification ||
    emailConfig?.notifications?.confirmation ||
    {};
  const apiUrl = notificationCfg.api_url || emailConfig?.external_email_api_url || Deno.env.get('EMAIL_API_URL') || '';
  const apiKey = notificationCfg.api_key || emailConfig?.external_email_api_key || Deno.env.get('EMAIL_API_KEY') || '';
  const normalizedApiUrl = apiUrl.trim().replace(/\/$/, '');

  if (!normalizedApiUrl || !apiKey.trim()) {
    throw new Error('Missing external email API configuration');
  }

  const payload = {
    template_name: 'confirmacion_registro',
    recipient_email: params.recipientEmail,
    data: {
      user_name: params.userName,
      aplication_name: params.applicationName,
      confirm_url: params.confirmUrl,
      request_date: requestDate,
      expires_in_hour: '24',
      request_ip: params.requestIp
    }
  };

  const response = await fetch(normalizedApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim()
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `External email API error ${response.status}`);
  }

  return data;
}

interface EmailConfig {
  email_provider: 'system' | 'smtp' | 'resend' | 'sendgrid';
  from_name: string;
  from_email: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  api_key?: string;
}

async function sendWithSMTP(config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host || '',
        port: config.smtp_port || 587,
        tls: config.smtp_secure ?? true,
        auth: {
          username: config.smtp_user || '',
          password: config.smtp_password || '',
        },
      },
    });

    await client.send({
      from: `${config.from_name} <${config.from_email}>`,
      to,
      subject,
      content: html,
      html,
    });

    await client.close();
    console.log('✅ Email sent successfully via SMTP');
    return true;
  } catch (error) {
    console.error('❌ SMTP Error:', error);
    throw error;
  }
}

async function sendWithResend(apiKey: string, config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${config.from_name} <${config.from_email}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    console.log('✅ Email sent successfully via Resend');
    return true;
  } catch (error) {
    console.error('❌ Resend Error:', error);
    throw error;
  }
}

async function sendWithSendGrid(apiKey: string, config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: {
          email: config.from_email,
          name: config.from_name,
        },
        subject,
        content: [{
          type: 'text/html',
          value: html,
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    console.log('✅ Email sent successfully via SendGrid');
    return true;
  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    throw error;
  }
}

function getVerificationEmailHTML(
  name: string,
  verificationUrl: string,
  appName: string,
  logoUrl?: string,
  primaryColor: string = '#3B82F6'
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifica tu email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">

              <!-- Header with Logo -->
              <tr>
                <td style="background-color: ${primaryColor}; padding: 48px 40px; text-align: center;">
                  ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="max-width: 180px; height: auto; margin-bottom: 20px;">` : ''}
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">¡Bienvenido a ${appName}!</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 48px 40px;">
                  <p style="margin: 0 0 24px; color: #1f2937; font-size: 18px; font-weight: 600;">
                    Hola ${name},
                  </p>
                  <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Gracias por registrarte en <strong style="color: #1f2937;">${appName}</strong>. Estamos emocionados de tenerte con nosotros.
                  </p>
                  <p style="margin: 0 0 32px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Para completar tu registro y activar tu cuenta, solo necesitas verificar tu dirección de email haciendo clic en el botón de abajo:
                  </p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 16px 48px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s;">
                          Verificar Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Note -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 20px; background-color: #dbeafe; border-radius: 8px; border-left: 4px solid ${primaryColor};">
                        <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
                          <strong>ℹ️ Nota:</strong> Este enlace de verificación expirará en 24 horas. Si no verificas tu email, no podrás acceder a todas las funciones de tu cuenta.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Alternative Link -->
                  <p style="margin: 32px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${verificationUrl}" style="color: ${primaryColor}; word-break: break-all; text-decoration: underline;">${verificationUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                    Este email fue enviado por <strong style="color: #1f2937;">${appName}</strong>
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    Powered by AuthSystem
                  </p>
                </td>
              </tr>
            </table>

            <!-- Footer Text -->
            <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} ${appName}. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function sendVerificationEmail(
  supabase: any,
  email: string,
  name: string,
  verificationUrl: string,
  appName: string,
  applicationId: string,
  userId: string,
  emailConfig: EmailConfig
) {
  console.log('📧 Starting sendVerificationEmail function...');
  console.log('📧 Email Config:', {
    provider: emailConfig.email_provider,
    from_email: emailConfig.from_email,
    from_name: emailConfig.from_name
  });

  // Get branding config
  const { data: branding } = await supabase
    .from('branding_configs')
    .select('primary_color, secondary_color, logo_url')
    .eq('application_id', applicationId)
    .maybeSingle();

  const primaryColor = branding?.primary_color || '#3B82F6';
  const logoUrl = branding?.logo_url;

  console.log('🎨 Branding config:', { primaryColor, hasLogo: !!logoUrl });

  const rawHtml = getVerificationEmailHTML(name, verificationUrl, appName, logoUrl, primaryColor);
  const html = rawHtml.replace(/\r?\n/g, '\r\n');
  const subject = `Verifica tu email - ${appName}`;

  let status = 'sent';
  let errorMessage = null;
  let actuallySent = false;

  try {
    console.log('📤 Attempting to send email using provider:', emailConfig.email_provider);

    switch (emailConfig.email_provider) {
      case 'smtp':
        console.log('🔧 Using SMTP provider');
        if (emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password) {
          console.log('✅ SMTP configuration complete, sending email...');
          await sendWithSMTP(emailConfig, email, subject, html);
          actuallySent = true;
        } else {
          console.error('❌ SMTP configuration incomplete');
          throw new Error('SMTP configuration incomplete');
        }
        break;

      case 'resend':
        console.log('🔧 Using Resend provider');
        if (emailConfig.api_key) {
          console.log('✅ Resend API key found, sending email...');
          await sendWithResend(emailConfig.api_key, emailConfig, email, subject, html);
          actuallySent = true;
        } else {
          console.error('❌ Resend API key not configured');
          throw new Error('Resend API key not configured');
        }
        break;

      case 'sendgrid':
        console.log('🔧 Using SendGrid provider');
        if (emailConfig.api_key) {
          console.log('✅ SendGrid API key found, sending email...');
          await sendWithSendGrid(emailConfig.api_key, emailConfig, email, subject, html);
          actuallySent = true;
        } else {
          console.error('❌ SendGrid API key not configured');
          throw new Error('SendGrid API key not configured');
        }
        break;

      case 'system':
      default:
        console.log('⚠️ Using SYSTEM mode - Email will be logged but NOT sent physically');
        console.log('📧 Email logged (system mode):', {
          to: email,
          from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
          subject,
        });
        break;
    }
  } catch (error: any) {
    status = 'failed';
    errorMessage = error.message;
    console.error('❌ Email sending failed:', error);
  }

  console.log('💾 Saving email log to database...');
  const emailLogData = {
    to_email: email,
    from_email: emailConfig.from_email,
    from_name: emailConfig.from_name,
    subject,
    html_content: html,
    status,
    error_message: errorMessage,
    application_id: applicationId || null,
    app_user_id: userId || null,
    sent_at: actuallySent ? new Date().toISOString() : null
  };

  const { data: insertedData, error: dbError } = await supabase
    .from('email_logs')
    .insert(emailLogData)
    .select();

  if (dbError) {
    console.error('❌ ERROR logging email to database:', dbError);
  } else {
    console.log('✅ Email log saved successfully to database');
  }

  if (status === 'failed') {
    console.error('⚠️ Email sending failed, but continuing with registration flow. Error:', errorMessage);
  } else {
    console.log('✅ Verification email processed successfully');
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
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
    } catch (error) {
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

    const { email, password, name, application_id, api_key, role, callback_url, client_ip, metadata, tenant_id: requestedTenantId }: RegisterRequest = requestBody;

    if (!email || !password || !name || !application_id || !api_key) {
      const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0';
      
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Campos requeridos faltantes en registro',
        metadata: { 
          email: email || 'missing',
          name: name || 'missing',
          application_id: application_id || 'missing',
          error_type: 'validation_error'
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Email, password, name, and application_id are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0';

    console.log('🔍 Processing register request:', {
      email,
      name,
      application_id,
      ip_address: ipAddress,
      has_password: !!password,
      has_api_key: !!api_key
    });

    // Validate API Key
    console.log('🔑 Validating API Key...');
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      console.log('❌ Invalid API Key provided');

      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_register',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'API Key inválida',
        metadata: {
          email,
          application_id,
          error_type: 'invalid_api_key'
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API Key inválida o inactiva'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ API Key found and active, will verify ownership after loading application');

    // Check if IP is blocked
    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (blockedIP) {
      console.log('🚫 IP is blocked:', ipAddress, blockedIP.reason);

      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_register',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'IP bloqueada',
        metadata: {
          email,
          name,
          application_id,
          error_type: 'ip_blocked',
          block_reason: blockedIP.reason
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message: 'Su dirección IP ha sido bloqueada. Contacte al administrador.',
            reason: blockedIP.reason
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Rate limiting check
    console.log('🛡️ Checking rate limit for IP:', ipAddress);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ipAddress,
      p_endpoint: 'auth-register',
      p_max_attempts: 3,
      p_window_minutes: 5
    });

    if (rateLimitError) {
      console.error('❌ Rate limit check error:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log('🚫 Rate limit exceeded for IP:', ipAddress);

      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_register',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Rate limit excedido',
        metadata: {
          email,
          name,
          application_id,
          error_type: 'rate_limit_exceeded',
          blocked_until: rateLimitResult.blocked_until
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiados intentos de registro. Por favor espera antes de intentar nuevamente.',
            blocked_until: rateLimitResult.blocked_until,
            reason: rateLimitResult.reason
          }
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '900' }
        }
      );
    }

    console.log('✅ Rate limit check passed:', rateLimitResult);

    const { data: application, error: appError} = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      console.log('❌ Application not found:', application_id);
      
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Aplicación no encontrada en registro',
        metadata: { 
          email,
          name,
          application_id,
          error_type: 'application_not_found'
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Aplicación no encontrada'
          }
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify API Key belongs to the application (compare with internal id)
    if (apiKeyData.application_id !== application.id) {
      console.log('❌ API Key does not belong to this application');
      console.log('  API Key application_id:', apiKeyData.application_id);
      console.log('  Application internal id:', application.id);

      await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_register',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'API Key no pertenece a esta aplicación',
        metadata: {
          email,
          application_id,
          error_type: 'api_key_mismatch',
          api_key_app_id: apiKeyData.application_id,
          expected_app_id: application.id
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'API_KEY_MISMATCH',
            message: 'API Key no pertenece a esta aplicación'
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ API Key belongs to application');

    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      console.log('❌ Email already exists:', email, 'in application:', application.name);
      
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Email ya existe',
        metadata: { 
          email,
          name,
          error_type: 'email_already_exists',
          application_name: application.name
        }
      });
      
      if (logError) {
        console.error('❌ Error logging email exists attempt:', logError);
      } else {
        console.log('📝 Logged email already exists attempt for:', email);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Ya existe un usuario con este email'
          }
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use bcrypt for secure password hashing
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('📧 Raw application.email_config:', application.email_config);

    const emailConfig: EmailConfig = {
      email_provider: 'system',
      from_name: 'AuthSystem',
      from_email: 'noreply@authsystem.com',
      ...(application.email_config || {})
    };

    console.log('📧 Final emailConfig:', {
      provider: emailConfig.email_provider,
      from_name: emailConfig.from_name,
      from_email: emailConfig.from_email,
      has_smtp_host: !!emailConfig.smtp_host,
      has_smtp_user: !!emailConfig.smtp_user,
      has_smtp_password: !!emailConfig.smtp_password
    });
    const appMetadata = (application as any).metadata || {};
    const requireEmailVerification =
      appMetadata.enable_email_verification === true ||
      emailConfig.require_email_verification === true;
    const userStatus = requireEmailVerification ? 'pending' : 'active';
     
    // If application is in tenant mode, resolve tenant_id (prefer the one provided in the request)
    let tenantId: string | null = null;
    if (application.auth_mode === 'tenant') {
      if (requestedTenantId) {
        const { data: requestedTenant } = await supabase
          .from('tenants')
          .select('id, name, status, application_id')
          .eq('id', requestedTenantId)
          .maybeSingle();

        if (!requestedTenant || requestedTenant.application_id !== application.id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_TENANT',
                message: 'El tenant indicado no pertenece a esta aplicación'
              }
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (requestedTenant.status !== 'active') {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'TENANT_NOT_ACTIVE',
                message: 'El tenant indicado no está activo'
              }
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        tenantId = requestedTenant.id;
        console.log('✅ Using tenant_id provided in request:', requestedTenant.name, tenantId);
      } else {
        const { data: activeTenant } = await supabase
          .from('tenants')
          .select('id, name')
          .eq('application_id', application.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!activeTenant) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'NO_TENANT_FOUND',
                message: 'Esta aplicación requiere un tenant activo. Por favor registre una empresa antes de registrar usuarios.'
              }
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        tenantId = activeTenant.id;
        console.log('⚠️ No tenant_id in request, defaulted to oldest active tenant:', activeTenant.name, tenantId);
      }
    }

    const registrationEnvironment = normalizeEnvironmentName((apiKeyData as any).environment || null);
    const scopedUserMetadata = buildEnvironmentScopedMetadata(metadata || {}, registrationEnvironment);

    const { data: newUser, error: createError } = await supabase
      .from('app_users')
      .insert({
        application_id: application.id,
        email,
        name,
        password_hash: passwordHash,
        status: userStatus,
        metadata: scopedUserMetadata,
        ...(tenantId ? { tenant_id: tenantId } : {})
      })
      .select()
      .single();

    if (createError) {
      console.log('❌ Error creating user:', {
        message: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint
      });
      
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: `Database error: ${createError.message}`,
        metadata: { 
          email,
          name,
          error_type: 'database_error',
          db_error: createError,
          application_name: application.name
        }
      });
      
      if (logError) {
        console.error('❌ Error logging user creation failure:', logError);
      } else {
        console.log('📝 Logged user creation failure for:', email);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database error saving new user',
            details: createError.message
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ User created successfully, assigning role...');
    console.log('🎭 Role from request:', role || 'not specified');

    let roleToAssign: { id: string; name: string; display_name: string; permissions: any[] } | null = null;

    // If role is specified in the request, try to find it
    if (role) {
      const { data: requestedRole } = await supabase
        .from('application_roles')
        .select('id, name, display_name, permissions')
        .eq('application_id', application.id)
        .eq('display_name', role)
        .maybeSingle();

      if (requestedRole) {
        roleToAssign = requestedRole;
        console.log('✅ Using requested role:', role);
      } else {
        // Try finding by name (lowercase)
        const { data: roleByName } = await supabase
          .from('application_roles')
          .select('id, name, display_name, permissions')
          .eq('application_id', application.id)
          .ilike('name', role)
          .maybeSingle();

        if (roleByName) {
          roleToAssign = roleByName;
          console.log('✅ Using role by name:', role);
        } else {
          console.warn('⚠️ Requested role not found:', role);
        }
      }
    }

    // If no role was specified or found, get the default role
    if (!roleToAssign) {
      const { data: defaultRole } = await supabase
        .from('application_roles')
        .select('id, name, display_name, permissions')
        .eq('application_id', application.id)
        .eq('is_default', true)
        .maybeSingle();

      if (defaultRole) {
        roleToAssign = defaultRole;
        console.log('✅ Using default role:', defaultRole.name);
      } else {
        console.warn('⚠️ No default role found, user will be created without role');
      }
    }

    // Update user with role_id
    if (roleToAssign) {
      const { error: roleError } = await supabase
        .from('app_users')
        .update({ role_id: roleToAssign.id })
        .eq('id', newUser.id);

      if (roleError) {
        console.error('⚠️ Error assigning role_id to user:', roleError);
      } else {
        console.log('✅ Role assigned successfully:', roleToAssign.display_name || roleToAssign.name);
        // Update the newUser object with role_id for later use
        newUser.role_id = roleToAssign.id;
      }
    }

    console.log('✅ Registration successful for user:', newUser.email);

    // Provision internal billing when enabled, otherwise keep legacy external sync
    try {
      const internalBillingEnabled = application?.billing_config?.enabled === true;
      let selectedPlanId = (metadata?.plan_id as string | undefined) || null;

      if (tenantId) {
        const { data: currentTenant } = await supabase
          .from('tenants')
          .select('metadata')
          .eq('id', tenantId)
          .maybeSingle();

        const tenantMetadata = {
          ...(currentTenant?.metadata || {}),
          billing_email: (currentTenant?.metadata?.billing_email as string | undefined) || email,
        };

        if (!selectedPlanId && currentTenant?.metadata?.plan_id) {
          selectedPlanId = String(currentTenant.metadata.plan_id);
        }

        if (selectedPlanId) {
          tenantMetadata.plan_id = selectedPlanId;
        }

        await supabase
          .from('tenants')
          .update({ metadata: tenantMetadata })
          .eq('id', tenantId);
      }

      if (internalBillingEnabled) {
        const provisioned = await ensureSelectedPlanSubscription({
          supabase,
          application,
          selectedPlanId,
          tenantId,
          appUserId: newUser.id,
          payerEmail: email,
          context: 'initial_registration',
          source: 'user_registration_trial',
        });

        console.log('internal billing provisioning result:', {
          enabled: internalBillingEnabled,
          selectedPlanId,
          tenantId,
          subscriptionId: provisioned?.id || null,
          status: provisioned?.status || null,
        });
      } else {
        const syncEnabled = appMetadata.subscription_sync_enabled === true;
        const syncApiKey = appMetadata.subscription_sync_api_key as string | undefined;
        const syncPlanId = selectedPlanId || (appMetadata.subscription_sync_plan_id as string | undefined);
        const syncBaseUrl = (appMetadata.subscription_sync_api_url as string | undefined) || Deno.env.get('SUBSCRIPTION_SYNC_API_URL') || '';
        const normalizedSyncBaseUrl = syncBaseUrl.trim().replace(/\/$/, '');
        const syncEndpoint = normalizedSyncBaseUrl
          ? (normalizedSyncBaseUrl.endsWith('/activate-trial')
            ? normalizedSyncBaseUrl
            : `${normalizedSyncBaseUrl}/activate-trial`)
          : '';

        if (syncEnabled && syncApiKey && syncPlanId && tenantId && syncEndpoint) {
          console.log('Triggering activate-trial for tenant:', tenantId);
          const trialRes = await fetch(
            syncEndpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': syncApiKey,
              },
              body: JSON.stringify({
                application_id: application_id,
                plan_id: syncPlanId,
                tenant_id: tenantId,
              }),
            }
          );
          if (!trialRes.ok) {
            const errText = await trialRes.text();
            console.error('activate-trial failed in auth-register:', trialRes.status, errText);
          } else {
            console.log('activate-trial succeeded in auth-register');
          }
        } else {
          console.log('activate-trial skipped:', {
            syncEnabled,
            hasApiKey: !!syncApiKey,
            hasPlanId: !!syncPlanId,
            hasTenantId: !!tenantId,
            hasSyncEndpoint: !!syncEndpoint,
          });
        }
      }
    } catch (syncError: any) {
      console.error('billing provisioning exception in auth-register:', syncError?.message || syncError);
    }

    try {
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: newUser.id,
        event_type: 'register',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: true,
        metadata: { 
          email,
          user_name: newUser.name,
          registration_method: 'email_password',
          application_name: application.name,
          user_status: userStatus,
          requires_verification: requireEmailVerification,
          environment: registrationEnvironment,
          allowed_environments: scopedUserMetadata?.environment_access?.allowed_environments || []
        }
      });
      if (logError) console.error('Error logging registration:', logError);
    } catch (logErr) {
      console.error('Exception logging registration:', logErr);
    }

    if (requireEmailVerification) {
      const verificationToken = generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      const { error: tokenError } = await supabase.from('email_verification_tokens').insert({
        app_user_id: newUser.id,
        token: verificationToken,
        expires_at: expiresAt.toISOString()
      });
      
      if (tokenError) {
        console.error('Error creating verification token:', tokenError);
        // Continue without email verification if token creation fails
      } else {
        const { baseUrl, callbackUrl: resolvedCallbackUrl, environmentName } = await resolveApplicationAuthUrl(
          supabase,
          application.id,
          (apiKeyData as any).environment || null
        );
        const configuredCallbackUrl = resolveTrustedApplicationCallbackUrl({
          requestedCallbackUrl: callback_url,
          configuredCallbackUrl: resolvedCallbackUrl,
          configuredBaseUrl: baseUrl,
          applicationDomain: application.domain || null,
          applicationMetadata: application.metadata || null
        });

        if (!baseUrl) {
          console.error('❌ No auth_url configured for application environment; cannot build verification URL safely.');
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'AUTH_URL_NOT_FOUND',
                message: 'No se encontró una URL de autenticación configurada para esta aplicación'
              }
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        if (normalizeUrl(callback_url) && configuredCallbackUrl && normalizeUrl(callback_url) !== configuredCallbackUrl) {
          console.warn('⚠️ Replacing requested callback_url during registration with trusted application callback URL.', {
            requested: normalizeUrl(callback_url),
            configured: configuredCallbackUrl,
            environment: environmentName || (apiKeyData as any).environment || null
          });
        }

        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

        try {
          await sendExternalConfirmationEmail({
            recipientEmail: email,
            userName: name,
            applicationName: application.name,
            confirmUrl: verificationUrl,
            requestIp: ipAddress
          }, emailConfig);

          await supabase.from('email_logs').insert({
            to_email: email,
            from_email: emailConfig.from_email,
            from_name: emailConfig.from_name,
            subject: `Confirma tu cuenta - ${application.name}`,
            html_content: null,
            status: 'sent',
            application_id: application.id,
            app_user_id: newUser.id,
            sent_at: new Date().toISOString()
          });
        } catch (emailError: any) {
          console.error('Error sending external confirmation email:', emailError);
          await supabase.from('email_logs').insert({
            to_email: email,
            from_email: emailConfig.from_email,
            from_name: emailConfig.from_name,
            subject: `Confirma tu cuenta - ${application.name}`,
            html_content: null,
            status: 'failed',
            error_message: emailError?.message || 'Unknown error',
            application_id: application.id,
            app_user_id: newUser.id
          });
        }
      }
      
      const response = {
        success: true,
        data: {
          message: 'Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.',
          user_id: newUser.id,
          email_verification_required: true,
          next_step: 'verify_email',
          environment: registrationEnvironment
        }
      };
      
      if (configuredCallbackUrl) {
        const verifyParams = new URLSearchParams({
          user_id: newUser.id,
          email: newUser.email,
          state: 'email_verification_required',
          message: 'Por favor verifica tu email para continuar'
        });
        
        response.data.callback_url = buildRedirectUrl(
          configuredCallbackUrl.replace(/\/callback\/?$/, '/verify-email'),
          Object.fromEntries(verifyParams.entries())
        );
      }
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user role for token generation
    let roles = ['user'];
    let permissions: any = ['read'];
    let roleName = 'user';
    let rolePermissions: Record<string, string[]> = {};
    let rolePermissionsHierarchy: Record<string, any> = {};

    if (newUser.role_id && roleToAssign) {
      roles = [roleToAssign.name];
      permissions = roleToAssign.permissions || ['read'];
    } else if (newUser.role_id) {
      // If role_id exists but roleToAssign is not available, fetch the role
      const { data: userRole } = await supabase
        .from('application_roles')
        .select('name, permissions')
        .eq('id', newUser.role_id)
        .maybeSingle();

      if (userRole) {
        roles = [userRole.name];
        permissions = userRole.permissions || ['read'];
      }
    }

    if (newUser.role_id) {
      const resolvedRoleAccess = await resolveRoleAccess(supabase, newUser.role_id);
      roleName = resolvedRoleAccess.roleName || roles[0] || 'user';
      rolePermissions = resolvedRoleAccess.rolePermissions;
      rolePermissionsHierarchy = resolvedRoleAccess.rolePermissionsHierarchy;
      roles = roleName ? [roleName] : roles;
    } else if (roles[0]) {
      roleName = roles[0];
    }

    const jwtSecret = await resolveApplicationJwtSecret(supabase, application.id, application.jwt_secret);
    const accessTokenPayload: Record<string, any> = {
      sub: newUser.id,
      email: newUser.email,
      name: newUser.name,
      app_id: application_id,
      app_name: application.name,
      app_domain: application.domain,
      role: roleName,
      roles: roles,
      permissions: Object.keys(rolePermissions).length > 0 ? rolePermissions : permissions,
      permissions_hierarchy: rolePermissionsHierarchy,
      iss: 'AuthSystem',
      aud: application.domain,
      user_metadata: newUser.metadata || {},
      user_created_at: newUser.created_at,
      environment: registrationEnvironment,
    };

    if (tenantId) {
      accessTokenPayload.tenant_id = tenantId;
    }

    const { accessToken, refreshToken } = await issueAuthTokens(jwtSecret, accessTokenPayload);

    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400
      }
    };

    const { baseUrl: finalBaseUrl, callbackUrl: resolvedFinalCallbackUrl, environmentName: finalEnvironmentName } = await resolveApplicationAuthUrl(
      supabase,
      application.id,
      (apiKeyData as any).environment || null
    );
    const finalCallbackUrl = resolveTrustedApplicationCallbackUrl({
      requestedCallbackUrl: callback_url,
      configuredCallbackUrl: resolvedFinalCallbackUrl,
      configuredBaseUrl: finalBaseUrl,
      applicationDomain: application.domain || null,
      applicationMetadata: application.metadata || null
    });

    if (normalizeUrl(callback_url) && finalCallbackUrl && normalizeUrl(callback_url) !== finalCallbackUrl) {
      console.warn('⚠️ Replacing requested callback_url for final registration redirect with trusted application callback URL.', {
        requested: normalizeUrl(callback_url),
        configured: finalCallbackUrl,
        environment: finalEnvironmentName || (apiKeyData as any).environment || null
      });
    }

    if (finalCallbackUrl) {
      const authCode = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: authCodeError } = await supabase.from('auth_codes').insert({
        code: authCode,
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: newUser.id,
        application_id: application.id,
        expires_at: expiresAt
      });

      if (authCodeError) {
        console.error('⚠️ Error saving auth code for registration callback:', authCodeError);
      } else {
        response.data.callback_url = buildRedirectUrl(finalCallbackUrl, {
          code: authCode,
          state: 'registered_and_logged_in'
        });
      }
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Register error:', error);
    
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0';
    
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Error interno del servidor en registro',
        metadata: { 
          error_type: 'internal_error',
          error_message: error.message,
          endpoint: 'auth-register'
        }
      });
    } catch (logError) {
      console.error('Error logging internal error:', logError);
    }
    
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
