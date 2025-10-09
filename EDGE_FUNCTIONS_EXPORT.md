# Edge Functions Export

Este documento contiene todas las Edge Functions del sistema con sus códigos completos.

## Lista de Edge Functions

1. **auth-login** - Autenticación de usuarios
2. **auth-register** - Registro de nuevos usuarios
3. **auth-reset-password** - Solicitud de reseteo de contraseña
4. **auth-reset-password-confirm** - Confirmación de reseteo de contraseña
5. **check-ip-status** - Verificar estado de IPs bloqueadas
6. **debug-email-config** - Debug de configuración de email
7. **debug-env-vars** - Debug de variables de ambiente
8. **send-email** - Envío de emails
9. **sync-dlocal-plans** - Sincronizar planes de dLocal
10. **sync-dlocal-subscriptions** - Sincronizar suscripciones de dLocal
11. **test-dlocal-auth** - Probar autenticación con dLocal

---


## auth-login

```typescript
// File: supabase/functions/auth-login/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

interface LoginRequest {
  email: string
  password: string
  application_id: string
  callback_url?: string
  client_ip?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
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
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log('🔧 Supabase client initialized with service role');

    let requestBody;
    try {
      requestBody = await req.json()
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
      )
    }

    const { email, password, application_id, callback_url, client_ip }: LoginRequest = requestBody

    if (!email || !password || !application_id) {
      const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
      
      // Log missing fields error
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Campos requeridos faltantes',
        metadata: { 
          email: email || 'missing',
          application_id: application_id || 'missing',
          error_type: 'validation_error'
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Email, password, and application_id are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
    
    console.log('🔍 Processing login request:', {
      email,
      application_id,
      ip_address: ipAddress,
      has_password: !!password
    });

    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle()

    if (blockedIP) {
      console.log('🚫 IP is blocked:', ipAddress, blockedIP.reason);
      
      // Log blocked IP attempt
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'IP bloqueada',
        metadata: { 
          email,
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
      )
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single()

    if (appError || !application) {
      console.log('❌ Application not found:', application_id);
      
      // Log application not found error
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Aplicación no encontrada',
        metadata: { 
          email,
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
      )
    }

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('application_id', application.id)
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.log('❌ User not found:', email, 'in application:', application.name);
      
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Usuario no encontrado',
        metadata: { 
          email,
          error_type: 'user_not_found',
          application_name: application.name
        }
      });
      
      if (logError) {
        console.error('❌ Error logging failed login attempt:', logError);
      } else {
        console.log('📝 Logged failed login attempt for:', email);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('🔐 Checking password for user:', user.email);

    // Use bcrypt for secure password verification
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      console.log('❌ Invalid password for user:', user.email);
      
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Contraseña incorrecta',
        metadata: { 
          email,
          user_name: user.name,
          error_type: 'invalid_password',
          application_name: application.name
        }
      });
      
      if (logError) {
        console.error('❌ Error logging invalid password attempt:', logError);
      } else {
        console.log('📝 Logged invalid password attempt for:', email);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (user.status !== 'active') {
      console.log('❌ User not active:', user.email, 'status:', user.status);
      
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: user.status === 'pending' ? 'Email no verificado' : `Usuario en estado: ${user.status}`,
        metadata: { 
          email,
          user_name: user.name,
          status: user.status,
          error_type: user.status === 'pending' ? 'email_not_verified' : 'user_inactive',
          application_name: application.name
        }
      });
      
      if (logError) {
        console.error('❌ Error logging inactive user attempt:', logError);
      } else {
        console.log('📝 Logged inactive user attempt for:', email);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_ACTIVE',
            message: user.status === 'pending' 
              ? 'Por favor verifica tu email para activar tu cuenta'
              : `Tu cuenta está ${user.status}. Contacta al administrador.`
          }
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has active subscription
    console.log('🔍 Checking user subscription...');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', authUser.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error checking subscription:', subError);
    }

    if (!subscription) {
      console.log('⚠️  User does not have an active subscription');

      await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'No active subscription',
        metadata: {
          email,
          error_type: 'no_active_subscription',
          application_name: application.name
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NO_ACTIVE_SUBSCRIPTION',
            message: 'No tienes una suscripción activa. Por favor suscríbete para acceder.'
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ User has active subscription: ${subscription.subscription_plans?.name}`);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_name, permissions')
      .eq('app_user_id', user.id)

    const userRoles = roles?.map(r => r.role_name) || ['user']
    const userPermissions = roles?.flatMap(r => r.permissions || []) || ['read']

    console.log('✅ Login successful for user:', user.email);
    
    // Update last_login timestamp
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
    const { error: logError } = await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      event_type: 'login',
      ip_address: ipAddress,
      user_agent: req.headers.get('user-agent') || 'unknown',
      success: true,
      metadata: { 
        email,
        user_name: user.name,
        method: 'email_password',
        application_name: application.name,
        roles: userRoles,
        permissions: userPermissions
      }
    });
    
    if (logError) {
      console.error('❌ Error logging successful login:', logError);
    } else {
      console.log('📝 Logged successful login for:', email);
    }

    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      app_id: application_id,
      roles: userRoles,
      permissions: userPermissions,
      iat: now,
      exp: now + (24 * 60 * 60),
      iss: 'AuthSystem',
      aud: application.domain
    }

    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({...accessTokenPayload, type: 'refresh', exp: now + (30 * 24 * 60 * 60)}))}.signature`

    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: userRoles,
          permissions: userPermissions,
          metadata: user.metadata || {},
          created_at: user.created_at
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        }
      }
    }

    if (callback_url) {
      const callbackParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: user.id,
        state: 'authenticated'
      })
      response.data.callback_url = `${callback_url}?${callbackParams.toString()}`
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Login error:', error)
    
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
    
    // Log internal server error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Error interno del servidor',
        metadata: { 
          error_type: 'internal_error',
          error_message: error.message,
          endpoint: 'auth-login'
        }
      })
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
    )
  }
})```

---

## auth-register

```typescript
// File: supabase/functions/auth-register/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import bcrypt from "npm:bcryptjs@2.4.3";

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
  callback_url?: string
  client_ip?: string
  metadata?: Record<string, any>
}

function generateVerificationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    const { email, password, name, application_id, callback_url, client_ip, metadata }: RegisterRequest = requestBody;

    if (!email || !password || !name || !application_id) {
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
      has_password: !!password
    });

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
        event_type: 'failed_login',
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

    const { data: application, error: appError } = await supabase
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
    const requireEmailVerification = emailConfig.require_email_verification || false;
    const userStatus = requireEmailVerification ? 'pending' : 'active';
     
    const { data: newUser, error: createError } = await supabase
      .from('app_users')
      .insert({
        application_id: application.id,
        email,
        name,
        password_hash: passwordHash,
        status: userStatus,
        metadata: metadata || {}
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

    console.log('✅ User created successfully, assigning default role...');
    
    // Get default role for this application or assign basic user role
    const { data: defaultRole } = await supabase
      .from('application_roles')
      .select('name, permissions')
      .eq('application_id', application.id)
      .eq('is_default', true)
      .maybeSingle();
    
    const roleToAssign = defaultRole || { name: 'user', permissions: ['read'] };
    
    // Assign role to user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        app_user_id: newUser.id,
        role_name: roleToAssign.name,
        permissions: roleToAssign.permissions || ['read']
      });
    
    if (roleError) {
      console.error('⚠️ Error assigning role:', roleError);
      // Continue without role assignment if it fails
    } else {
      console.log('✅ Role assigned successfully:', roleToAssign.name);
    }

    console.log('✅ Registration successful for user:', newUser.email);
    
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
          requires_verification: requireEmailVerification
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
      const baseUrl = callback_url ? callback_url.split('/callback')[0] : 'https://yourdomain.com';
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
        try {
          await sendVerificationEmail(
            supabase,
            email,
            name,
            verificationUrl,
            application.name,
            application.id,
            newUser.id,
            emailConfig
          );
        } catch (emailError) {
          console.error('Error sending verification email:', emailError);
          // Continue without sending email if it fails
        }
      }
      
      const response = {
        success: true,
        data: {
          message: 'Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.',
          user_id: newUser.id,
          email_verification_required: true,
          next_step: 'verify_email'
        }
      };
      
      if (callback_url) {
        const verifyParams = new URLSearchParams({
          user_id: newUser.id,
          email: newUser.email,
          state: 'email_verification_required',
          message: 'Por favor verifica tu email para continuar'
        });
        
        response.data.callback_url = `${callback_url.replace('/callback', '/verify-email')}?${verifyParams.toString()}`;
      }
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user roles for token generation
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_name, permissions')
      .eq('app_user_id', newUser.id);

    const roles = userRoles?.map(r => r.role_name) || ['user'];
    const permissions = userRoles?.flatMap(r => r.permissions || []) || ['read'];

    const now = Math.floor(Date.now() / 1000);
    const accessTokenPayload = {
      sub: newUser.id,
      email: newUser.email,
      name: newUser.name,
      app_id: application_id,
      roles: roles,
      permissions: permissions,
      iat: now,
      exp: now + (24 * 60 * 60),
      iss: 'AuthSystem',
      aud: application.domain
    };

    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`;
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({...accessTokenPayload, type: 'refresh', exp: now + (30 * 24 * 60 * 60)}))}.signature`;

    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          roles: roles,
          permissions: permissions,
          metadata: newUser.metadata || {},
          created_at: newUser.created_at
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        }
      }
    };

    if (callback_url) {
      const callbackParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: newUser.id,
        state: 'registered_and_logged_in'
      });
      response.data.callback_url = `${callback_url}?${callbackParams.toString()}`;
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
});```

---

## auth-reset-password-confirm

```typescript
// File: supabase/functions/auth-reset-password-confirm/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
  "Access-Control-Max-Age": "86400",
};

interface ResetPasswordConfirmRequest {
  token: string;
  email: string;
  new_password: string;
}

async function generateAuthTokens(userId: string, applicationId: string, jwtSecret: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(jwtSecret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const accessTokenPayload = {
    sub: userId,
    app_id: applicationId,
    type: "access",
    exp: getNumericDate(60 * 60), // 1 hour
    iat: getNumericDate(0),
  };

  const refreshTokenPayload = {
    sub: userId,
    app_id: applicationId,
    type: "refresh",
    exp: getNumericDate(60 * 60 * 24 * 30), // 30 days
    iat: getNumericDate(0),
  };

  const accessToken = await create({ alg: "HS256", typ: "JWT" }, accessTokenPayload, key);
  const refreshToken = await create({ alg: "HS256", typ: "JWT" }, refreshTokenPayload, key);

  return { accessToken, refreshToken };
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only POST method is allowed",
          },
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { token, email, new_password }: ResetPasswordConfirmRequest = requestBody;

    if (!token || !email || !new_password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "Token, email and new_password are required",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("🔍 Validating reset token for:", email);

    const { data: tokenData, error: tokenError } = await supabase
      .from("email_verification_tokens")
      .select(`
        *,
        app_users (
          id,
          email,
          application_id
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log("❌ Token not found");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Token inválido o expirado",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("❌ Token expired");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "El token ha expirado. Por favor solicita uno nuevo.",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (tokenData.used_at) {
      console.log("❌ Token already used");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "TOKEN_ALREADY_USED",
            message: "Este token ya ha sido utilizado",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appUser = tokenData.app_users;
    if (!appUser || appUser.email !== email) {
      console.log("❌ Email mismatch");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "EMAIL_MISMATCH",
            message: "El email no coincide con el token",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get application password policies
    const { data: application } = await supabase
      .from("applications")
      .select("email_config")
      .eq("id", appUser.application_id)
      .maybeSingle();

    const emailConfig = application?.email_config || {};
    const passwordMinLength = emailConfig.password_min_length || 8;
    const requireUppercase = emailConfig.password_require_uppercase !== false;
    const requireLowercase = emailConfig.password_require_lowercase !== false;
    const requireNumbers = emailConfig.password_require_numbers !== false;
    const requireSymbols = emailConfig.password_require_symbols || false;

    console.log("🔒 Validating password against policies:", {
      minLength: passwordMinLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSymbols,
    });

    // Validate password against policies
    const validationErrors: string[] = [];

    if (new_password.length < passwordMinLength) {
      validationErrors.push(`La contraseña debe tener al menos ${passwordMinLength} caracteres`);
    }

    if (requireUppercase && !/[A-Z]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos una letra mayúscula");
    }

    if (requireLowercase && !/[a-z]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos una letra minúscula");
    }

    if (requireNumbers && !/[0-9]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos un número");
    }

    if (requireSymbols && !/[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos un carácter especial");
    }

    if (validationErrors.length > 0) {
      console.log("❌ Password validation failed:", validationErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "PASSWORD_POLICY_VIOLATION",
            message: validationErrors.join(". "),
            validation_errors: validationErrors,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Password validation passed, updating password...");

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        password_hash: hashedPassword,
      })
      .eq("id", appUser.id);

    if (updateError) {
      console.error("❌ Error updating password:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "Error al actualizar la contraseña",
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: markUsedError } = await supabase
      .from("email_verification_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    if (markUsedError) {
      console.error("⚠️ Error marking token as used:", markUsedError);
    }

    console.log("✅ Password updated successfully");

    // Get application JWT secret
    const { data: appData } = await supabase
      .from("applications")
      .select("jwt_secret")
      .eq("id", appUser.application_id)
      .maybeSingle();

    let authTokens = null;
    if (appData?.jwt_secret) {
      try {
        const tokens = await generateAuthTokens(
          appUser.id,
          appUser.application_id,
          appData.jwt_secret
        );

        authTokens = {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          user: {
            id: appUser.id,
            email: appUser.email,
          },
        };

        console.log("✅ Auth tokens generated for auto-login");
      } catch (tokenError) {
        console.error("⚠️ Error generating auth tokens:", tokenError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contraseña actualizada exitosamente",
        data: authTokens,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Error interno del servidor",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

---

## auth-reset-password

```typescript
// File: supabase/functions/auth-reset-password/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

interface ResetPasswordRequest {
  email: string
  application_id: string
  callback_url?: string
  client_ip?: string
}

function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
    const port = config.smtp_port || 587;
    const useTLS = config.smtp_secure ?? (port === 465);

    console.log('📧 SMTP Connection Details:', {
      host: config.smtp_host,
      port: port,
      useTLS: useTLS,
      user: config.smtp_user,
      from: config.from_email
    });

    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host || '',
        port: port,
        tls: useTLS,
        auth: {
          username: config.smtp_user || '',
          password: config.smtp_password || '',
        },
      },
    });

    console.log('📤 Sending email to:', to);

    const result = await client.send({
      from: `${config.from_name} <${config.from_email}>`,
      to,
      subject,
      content: html,
      html,
    });

    console.log('📬 SMTP Send Result:', result);

    await client.close();
    console.log('✅ Email sent successfully via SMTP');
    return true;
  } catch (error: any) {
    console.error('❌ SMTP Error Details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
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

function getResetPasswordEmailHTML(
  name: string,
  resetUrl: string,
  appName: string,
  logoUrl?: string,
  primaryColor: string = '#3B82F6'
): string {
  const darkerColor = adjustColor(primaryColor, -20);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperar Contraseña</title>
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
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Recupera tu contraseña</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 48px 40px;">
                  <p style="margin: 0 0 24px; color: #1f2937; font-size: 18px; font-weight: 600;">
                    Hola ${name},
                  </p>
                  <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color: #1f2937;">${appName}</strong>.
                  </p>
                  <p style="margin: 0 0 32px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Haz clic en el botón de abajo para crear una nueva contraseña:
                  </p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 16px 48px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s;">
                          Restablecer Contraseña
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Security Note -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                          <strong>🔒 Nota de seguridad:</strong> Si no solicitaste este cambio, ignora este email y tu contraseña permanecerá sin cambios. El enlace expirará en 24 horas.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Alternative Link -->
                  <p style="margin: 32px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${resetUrl}" style="color: ${primaryColor}; word-break: break-all; text-decoration: underline;">${resetUrl}</a>
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

async function sendResetPasswordEmail(
  supabase: any,
  email: string,
  name: string,
  resetUrl: string,
  appName: string,
  applicationId: string,
  userId: string,
  emailConfig: EmailConfig
) {
  console.log('📧 Starting sendResetPasswordEmail function...');
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

  const rawHtml = getResetPasswordEmailHTML(name, resetUrl, appName, logoUrl, primaryColor);
  const html = rawHtml.replace(/\r?\n/g, '\r\n');
  const subject = `Recupera tu contraseña - ${appName}`;

  let status = 'sent';
  let errorMessage = null;
  let actuallySent = false;

  try {
    // Send email based on provider
    console.log('📤 Attempting to send email using provider:', emailConfig.email_provider);

    switch (emailConfig.email_provider) {
      case 'smtp':
        console.log('🔧 Using SMTP provider');
        if (emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password) {
          console.log('✅ SMTP configuration complete, sending email...');
          console.log('🔧 SMTP Config:', {
            host: emailConfig.smtp_host,
            port: emailConfig.smtp_port,
            user: emailConfig.smtp_user,
            secure: emailConfig.smtp_secure
          });
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

  // Store email in database for tracking
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
    console.error('⚠️ Email sending failed, but continuing with reset flow. Error:', errorMessage);
    // Don't throw - we still want the reset password flow to succeed even if email fails
    // The user can still recover using the token that was created
  } else {
    console.log('✅ Reset password email processed successfully');
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
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
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let requestBody;
    try {
      requestBody = await req.json()
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
      )
    }

    const { email, application_id, callback_url, client_ip }: ResetPasswordRequest = requestBody

    if (!email || !application_id) {
      const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
      
      // Log missing fields error
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Campos requeridos faltantes en reset password',
        metadata: { 
          email: email || 'missing',
          application_id: application_id || 'missing',
          error_type: 'validation_error'
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Email and application_id are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get IP address
    const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'

    console.log('🔍 Processing reset password request:', {
      email,
      application_id,
      ip_address: ipAddress
    });

    // Check if IP is blocked
    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle()

    if (blockedIP) {
      console.log('🚫 IP is blocked:', ipAddress, blockedIP.reason);
      
      // Log blocked IP attempt
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'IP bloqueada',
        metadata: { 
          email,
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
      )
    }

    // Verify application exists
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single()

    if (appError || !application) {
      console.log('❌ Application not found:', application_id);
      
      // Log application not found error
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Aplicación no encontrada en reset password',
        metadata: { 
          email,
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
      )
    }

    // Search for user
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('application_id', application.id)
      .eq('email', email)
      .single()

    if (userError || !appUser) {
      console.log('❌ User not found for reset password:', email, 'in application:', application.name);
      
      // Log attempt with user not found
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'password_reset',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Usuario no encontrado',
        metadata: { email, reason: 'user_not_found' }
      });
      
      if (logError) {
        console.error('❌ Error logging reset password attempt:', logError);
      } else {
        console.log('📝 Logged reset password attempt for non-existent user:', email);
      }

      // For security, don't reveal if user exists
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            message: 'Si el email existe en nuestro sistema, recibirás un enlace de recuperación.',
            email: email
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Load email config from application
    console.log('📧 Raw application.email_config:', application.email_config);

    const emailConfig: EmailConfig = {
      email_provider: 'system',
      from_name: 'AuthSystem',
      from_email: 'noreply@authsystem.com',
      ...(application.email_config || {})
    }

    console.log('📧 Final emailConfig:', {
      provider: emailConfig.email_provider,
      from_name: emailConfig.from_name,
      from_email: emailConfig.from_email,
      has_smtp_host: !!emailConfig.smtp_host,
      has_smtp_user: !!emailConfig.smtp_user,
      has_smtp_password: !!emailConfig.smtp_password
    });

    const shouldSendPasswordResetEmail = emailConfig.send_password_reset_email !== false // Default to true

    // Generate reset token
    const resetToken = generateResetToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours

    // Store reset token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        app_user_id: appUser.id,
        token: resetToken,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Error creating reset token:', tokenError)
      
      console.log('❌ Error creating reset token for user:', appUser.email);
      
      // Log token creation error
      const { error: logError2 } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: appUser.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Error al crear token de reset',
        metadata: { 
          email,
          user_name: appUser.name,
          error_type: 'database_error',
          db_error: tokenError.message,
          application_name: application.name
        }
      });
      
      if (logError2) {
        console.error('❌ Error logging token creation failure:', logError2);
      } else {
        console.log('📝 Logged token creation failure for:', email);
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
      )
    }

    console.log('✅ Reset password successful for user:', appUser.email);
    
    // Build reset URL
    const baseUrl = callback_url ? callback_url.split('/callback')[0] : `https://${application.domain}`
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    // Send reset email if enabled
    if (shouldSendPasswordResetEmail) {
      await sendResetPasswordEmail(
        supabase,
        email,
        appUser.name,
        resetUrl,
        application.name,
        application.id,
        appUser.id,
        emailConfig
      )
    }

    // Log successful event
    const { error: logError } = await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: appUser.id,
      event_type: 'password_reset',
      ip_address: ipAddress,
      user_agent: req.headers.get('user-agent') || 'unknown',
      success: true,
      metadata: {
        email,
        user_name: appUser.name,
        application_name: application.name,
        email_sent: shouldSendPasswordResetEmail,
        expires_at: expiresAt.toISOString()
      }
    });
    
    if (logError) {
      console.error('❌ Error logging successful reset password:', logError);
    } else {
      console.log('📝 Logged successful reset password for:', email);
    }

    const response = {
      success: true,
      data: {
        message: 'Email de recuperación enviado exitosamente.',
        email: email
      }
    }

    if (callback_url) {
      response.data.callback_url = callback_url
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Reset password error:', error)
    
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
    
    // Log internal server error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Error interno del servidor en reset password',
        metadata: { 
          error_type: 'internal_error',
          error_message: error.message,
          endpoint: 'auth-reset-password'
        }
      })
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
    )
  }
})```

---

## check-ip-status

```typescript
// File: supabase/functions/check-ip-status/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get IP address from multiple sources
    // 1. Check if client sent their IP in the body (for development environments)
    let clientIp = '0.0.0.0';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.client_ip) {
          clientIp = body.client_ip;
          console.log('Using client-provided IP:', clientIp);
        }
      } catch (e) {
        // If parsing fails, continue with header detection
      }
    }

    // 2. Try to get IP from headers (for production environments)
    if (clientIp === '0.0.0.0') {
      const ipAddress = req.headers.get('x-forwarded-for') ||
                       req.headers.get('x-real-ip') ||
                       req.headers.get('cf-connecting-ip') ||
                       '0.0.0.0';
      clientIp = ipAddress.split(',')[0].trim();
      console.log('Using header-detected IP:', clientIp);
    }

    console.log('Final IP to check:', clientIp);

    // Check if IP is blocked
    const { data: blockedIP, error } = await supabase
      .from('blocked_ips')
      .select('id, ip_address, reason, blocked_at, expires_at')
      .eq('ip_address', clientIp)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (error) {
      console.error('Error checking IP status:', error);
    }

    console.log('Blocked IP result:', blockedIP);

    const isBlocked = !!blockedIP;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ip_address: clientIp,
          is_blocked: isBlocked,
          blocked_info: blockedIP ? {
            reason: blockedIP.reason,
            blocked_at: blockedIP.blocked_at,
            expires_at: blockedIP.expires_at
          } : null
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Check IP status error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al verificar el estado de la IP'
        }
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
```

---

## debug-email-config

```typescript
// File: supabase/functions/debug-email-config/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const applicationId = url.searchParams.get('application_id');

    if (!applicationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'application_id parameter is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get application with email config
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, name, application_id, email_config')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching application',
          details: appError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!app) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Application not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get recent email logs
    const { data: emailLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(5);

    const emailConfig = app.email_config || {};

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          application: {
            id: app.id,
            name: app.name,
            application_id: app.application_id
          },
          email_config: {
            provider: emailConfig.email_provider || 'not_set',
            from_email: emailConfig.from_email || 'not_set',
            from_name: emailConfig.from_name || 'not_set',
            require_email_verification: emailConfig.require_email_verification ?? false,
            send_password_reset_email: emailConfig.send_password_reset_email ?? true,
            has_smtp_config: !!(emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password),
            has_api_key: !!emailConfig.api_key,
            smtp_configured: {
              host: emailConfig.smtp_host ? 'configured' : 'not_set',
              port: emailConfig.smtp_port || 'not_set',
              user: emailConfig.smtp_user ? 'configured' : 'not_set',
              password: emailConfig.smtp_password ? 'configured (hidden)' : 'not_set',
              secure: emailConfig.smtp_secure ?? 'not_set'
            }
          },
          recent_emails: emailLogs || [],
          diagnosis: {
            can_send_emails: emailConfig.email_provider !== 'system' && emailConfig.email_provider !== undefined,
            issue: emailConfig.email_provider === 'system' || !emailConfig.email_provider
              ? 'Email provider is set to "system" which only logs emails but does not send them. Change to SMTP, Resend, or SendGrid in Authentication settings.'
              : null,
            recommendation: emailConfig.email_provider === 'smtp' && !emailConfig.smtp_host
              ? 'SMTP selected but configuration is incomplete. Please configure SMTP host, user, and password.'
              : emailConfig.email_provider === 'resend' && !emailConfig.api_key
              ? 'Resend selected but API key is missing. Please add your Resend API key.'
              : emailConfig.email_provider === 'sendgrid' && !emailConfig.api_key
              ? 'SendGrid selected but API key is missing. Please add your SendGrid API key.'
              : emailConfig.email_provider !== 'system'
              ? 'Configuration looks good! Emails should be sending.'
              : 'Configure a real email provider (SMTP, Resend, or SendGrid) to send actual emails.'
          }
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Debug email config error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

---

## debug-env-vars

```typescript
// File: supabase/functions/debug-env-vars/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const envVars = {
      DLOCAL_API_KEY: Deno.env.get('DLOCAL_API_KEY') ? 'SET (length: ' + Deno.env.get('DLOCAL_API_KEY')!.length + ')' : 'NOT SET',
      DLOCAL_SECRET_KEY: Deno.env.get('DLOCAL_SECRET_KEY') ? 'SET (length: ' + Deno.env.get('DLOCAL_SECRET_KEY')!.length + ')' : 'NOT SET',
      DLOCAL_API_URL: Deno.env.get('DLOCAL_API_URL') ? 'SET (' + Deno.env.get('DLOCAL_API_URL') + ')' : 'NOT SET',
      VITE_DLOCAL_API_KEY: Deno.env.get('VITE_DLOCAL_API_KEY') ? 'SET (length: ' + Deno.env.get('VITE_DLOCAL_API_KEY')!.length + ')' : 'NOT SET',
      VITE_DLOCAL_SECRET_KEY: Deno.env.get('VITE_DLOCAL_SECRET_KEY') ? 'SET (length: ' + Deno.env.get('VITE_DLOCAL_SECRET_KEY')!.length + ')' : 'NOT SET',
      VITE_DLOCAL_API_URL: Deno.env.get('VITE_DLOCAL_API_URL') ? 'SET (' + Deno.env.get('VITE_DLOCAL_API_URL') + ')' : 'NOT SET',
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SET' : 'NOT SET',
    };

    console.log('Environment Variables Check:', envVars);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Environment variables check',
        env_vars: envVars,
        note: 'VITE_ prefixed variables are NOT available in Edge Functions. You must configure secrets in Supabase Dashboard.'
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## send-email

```typescript
// File: supabase/functions/send-email/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  application_id?: string;
  app_user_id?: string;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { to, subject, html, application_id, app_user_id }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: to, subject, html'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get email configuration from application
    let emailConfig: EmailConfig = {
      email_provider: 'system',
      from_name: 'AuthSystem',
      from_email: 'noreply@authsystem.com',
    };

    if (application_id) {
      console.log('🔍 Looking for application config with ID:', application_id);

      // Try to find application by numeric ID or by application_id string
      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('email_config')
        .or(`id.eq.${application_id},application_id.eq.${application_id}`)
        .maybeSingle();

      if (appError) {
        console.error('❌ Error fetching application config:', appError);
      }

      if (app?.email_config) {
        console.log('📧 Found email config:', {
          provider: app.email_config.email_provider,
          from_email: app.email_config.from_email,
          has_smtp_host: !!app.email_config.smtp_host,
          has_api_key: !!app.email_config.api_key
        });
        emailConfig = { ...emailConfig, ...app.email_config };
      } else {
        console.log('⚠️ No email config found for application, using defaults');
      }
    } else {
      console.log('⚠️ No application_id provided, using default email config');
    }

    let status = 'sent';
    let errorMessage = null;
    let actuallySent = false;

    // Send email based on provider
    console.log('📤 Attempting to send email using provider:', emailConfig.email_provider);

    try {
      switch (emailConfig.email_provider) {
        case 'smtp':
          console.log('🔧 Using SMTP provider');
          if (emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password) {
            console.log('✅ SMTP configuration complete, sending email...');
            await sendWithSMTP(emailConfig, to, subject, html);
            actuallySent = true;
          } else {
            console.error('❌ SMTP configuration incomplete:', {
              has_host: !!emailConfig.smtp_host,
              has_user: !!emailConfig.smtp_user,
              has_password: !!emailConfig.smtp_password
            });
            throw new Error('SMTP configuration incomplete');
          }
          break;

        case 'resend':
          console.log('🔧 Using Resend provider');
          if (emailConfig.api_key) {
            console.log('✅ Resend API key found, sending email...');
            await sendWithResend(emailConfig.api_key, emailConfig, to, subject, html);
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
            await sendWithSendGrid(emailConfig.api_key, emailConfig, to, subject, html);
            actuallySent = true;
          } else {
            console.error('❌ SendGrid API key not configured');
            throw new Error('SendGrid API key not configured');
          }
          break;

        case 'system':
        default:
          console.log('⚠️ Using SYSTEM mode - Email will be logged but NOT sent physically');
          console.log('📧 Email logged (system mode - not sent physically):', {
            to,
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

    // Store email in database for tracking
    console.log('💾 Attempting to save email log to database...');
    const emailLogData = {
      to_email: to,
      from_email: emailConfig.from_email,
      from_name: emailConfig.from_name,
      subject,
      html_content: html,
      status,
      error_message: errorMessage,
      application_id: application_id || null,
      app_user_id: app_user_id || null,
      sent_at: actuallySent ? new Date().toISOString() : null
    };

    console.log('📝 Email log data:', {
      ...emailLogData,
      html_content: '(html omitted)',
      application_id: application_id,
      app_user_id: app_user_id
    });

    const { data: insertedData, error: dbError } = await supabase
      .from('email_logs')
      .insert(emailLogData)
      .select();

    if (dbError) {
      console.error('❌ ERROR logging email to database:', {
        error: dbError,
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      });
    } else {
      console.log('✅ Email log saved successfully to database:', insertedData);
    }

    const isSuccess = status !== 'failed';

    return new Response(
      JSON.stringify({
        success: isSuccess,
        message: status === 'failed'
          ? `Email sending failed: ${errorMessage}`
          : (actuallySent
            ? 'Email sent successfully'
            : 'Email logged (not sent - configure email provider)'),
        provider: emailConfig.email_provider,
        actually_sent: actuallySent,
        status: status,
        error: status === 'failed' ? errorMessage : undefined
      }),
      {
        status: isSuccess ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});```

---

## sync-dlocal-plans

```typescript
// File: supabase/functions/sync-dlocal-plans/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DLocalPlan {
  id: number;
  merchant_id: number;
  name: string;
  description: string;
  country: string;
  currency: string;
  amount: number;
  frequency_type: 'MONTHLY' | 'YEARLY';
  frequency_value: number;
  active: boolean;
  free_trial_days: number;
  plan_token: string;
  created_at: string;
  updated_at: string;
  subscribe_url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let dlocalApiUrl = Deno.env.get('DLOCAL_API_URL');
    let dlocalApiKey = Deno.env.get('DLOCAL_API_KEY');
    let dlocalSecretKey = Deno.env.get('DLOCAL_SECRET_KEY');

    if (!dlocalApiKey) {
      dlocalApiKey = Deno.env.get('VITE_DLOCAL_API_KEY');
    }
    if (!dlocalSecretKey) {
      dlocalSecretKey = Deno.env.get('VITE_DLOCAL_SECRET_KEY');
    }
    if (!dlocalApiUrl) {
      dlocalApiUrl = Deno.env.get('VITE_DLOCAL_API_URL');
    }

    if (!dlocalApiUrl) {
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    if (dlocalApiUrl.includes('api.dlocalgo.com') && !dlocalApiUrl.includes('sbx')) {
      console.warn('\u26a0\ufe0f Production URL detected, forcing sandbox environment');
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    console.log('\ud83d\udd04 Syncing dLocal plans...');
    console.log('\ud83d\udccd API URL:', dlocalApiUrl);

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured');
    }

    console.log('\ud83d\udccb Fetching plans from dLocal API...');
    const response = await fetch(`${dlocalApiUrl}/v1/subscription/plan/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${dlocalApiKey}`,
        'X-API-Secret': dlocalSecretKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch dLocal plans: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const dlocalPlans: DLocalPlan[] = data.data || [];

    console.log(`\u2705 Found ${dlocalPlans.length} plans from dLocal`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const plan of dlocalPlans) {
      try {
        const { data: existingPlan } = await supabase
          .from('dlocal_plans_cache')
          .select('id, dlocal_updated_at')
          .eq('id', plan.id)
          .maybeSingle();

        const planData = {
          id: plan.id,
          merchant_id: plan.merchant_id,
          name: plan.name,
          description: plan.description || '',
          country: plan.country,
          currency: plan.currency,
          amount: plan.amount,
          frequency_type: plan.frequency_type,
          frequency_value: plan.frequency_value,
          active: plan.active,
          free_trial_days: plan.free_trial_days,
          plan_token: plan.plan_token,
          subscribe_url: plan.subscribe_url,
          dlocal_created_at: plan.created_at,
          dlocal_updated_at: plan.updated_at,
          synced_at: new Date().toISOString()
        };

        if (existingPlan) {
          const { error } = await supabase
            .from('dlocal_plans_cache')
            .update(planData)
            .eq('id', plan.id);

          if (error) {
            console.error(`Error updating plan ${plan.id}:`, error);
          } else {
            console.log(`\u2705 Updated plan: ${plan.name}`);
            updated++;
          }
        } else {
          const { error } = await supabase
            .from('dlocal_plans_cache')
            .insert(planData);

          if (error) {
            console.error(`Error inserting plan ${plan.id}:`, error);
          } else {
            console.log(`\u2705 Created plan: ${plan.name}`);
            created++;
          }
        }
      } catch (error: any) {
        console.error(`Error processing plan ${plan.id}:`, error);
        skipped++;
      }
    }

    const result = {
      success: true,
      message: 'Plans sync completed',
      stats: {
        total: dlocalPlans.length,
        created,
        updated,
        skipped
      },
      timestamp: new Date().toISOString()
    };

    console.log('\ud83d\udcca Sync Summary:', result.stats);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('\u274c Sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});```

---

## sync-dlocal-subscriptions

```typescript
// File: supabase/functions/sync-dlocal-subscriptions/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DLocalSubscription {
  id: number;
  plan: {
    id: number;
    merchant_id: number;
    name: string;
    plan_token: string;
    amount: number;
    currency: string;
  };
  subscription_token: string;
  status: string;
  client_email: string;
  client_id: string;
  active: boolean;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (cronSecret && cronSecret !== requestSecret) {
      console.warn('\u274c Invalid cron secret provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid authentication'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let dlocalApiUrl = Deno.env.get('DLOCAL_API_URL');
    let dlocalApiKey = Deno.env.get('DLOCAL_API_KEY');
    let dlocalSecretKey = Deno.env.get('DLOCAL_SECRET_KEY');

    if (!dlocalApiKey) {
      dlocalApiKey = Deno.env.get('VITE_DLOCAL_API_KEY');
    }
    if (!dlocalSecretKey) {
      dlocalSecretKey = Deno.env.get('VITE_DLOCAL_SECRET_KEY');
    }
    if (!dlocalApiUrl) {
      dlocalApiUrl = Deno.env.get('VITE_DLOCAL_API_URL');
    }

    if (!dlocalApiUrl) {
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    // IMPORTANT: Force sandbox URL if production URL is set by mistake
    if (dlocalApiUrl.includes('api.dlocalgo.com') && !dlocalApiUrl.includes('sbx')) {
      console.warn('\u26a0\ufe0f Production URL detected, forcing sandbox environment');
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    console.log('\ud83d\udd04 Iniciando sincronizaci\u00f3n de suscripciones con dLocal...');
    console.log('\ud83d\udccd API URL:', dlocalApiUrl);
    console.log('\ud83d\udd11 API Key configured:', dlocalApiKey ? 'Yes (length: ' + dlocalApiKey.length + ')' : 'No');
    console.log('\ud83d\udd10 Secret Key configured:', dlocalSecretKey ? 'Yes (length: ' + dlocalSecretKey.length + ')' : 'No');

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured. Check DLOCAL_API_KEY and DLOCAL_SECRET_KEY environment variables.');
    }

    console.log('\ud83c\udfab Setting up dLocal authentication headers');

    console.log('\n\ud83d\udccb Step 1: Checking plans cache...');

    // First, check if we have cached plans
    const { data: cachedPlans, error: cacheError } = await supabase
      .from('dlocal_plans_cache')
      .select('*')
      .eq('active', true);

    let dlocalPlans = cachedPlans || [];

    // If no cached plans, fetch from API and cache them
    if (!cachedPlans || cachedPlans.length === 0) {
      console.log('\u26a0\ufe0f  No cached plans found, fetching from dLocal API...');

      const plansResponse = await fetch(`${dlocalApiUrl}/v1/subscription/plan/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${dlocalApiKey}`,
          'X-API-Secret': dlocalSecretKey,
          'Content-Type': 'application/json'
        }
      });

      if (!plansResponse.ok) {
        const errorText = await plansResponse.text();
        throw new Error(`Failed to fetch dLocal plans: ${plansResponse.status} - ${errorText}`);
      }

      const dlocalPlansData = await plansResponse.json();
      const apiPlans = dlocalPlansData.data || [];

      console.log(`\u2705 Found ${apiPlans.length} plans from API, caching them...`);

      // Cache the plans
      for (const plan of apiPlans) {
        const planData = {
          id: plan.id,
          merchant_id: plan.merchant_id,
          name: plan.name,
          description: plan.description || '',
          country: plan.country,
          currency: plan.currency,
          amount: plan.amount,
          frequency_type: plan.frequency_type,
          frequency_value: plan.frequency_value,
          active: plan.active,
          free_trial_days: plan.free_trial_days,
          plan_token: plan.plan_token,
          subscribe_url: plan.subscribe_url,
          dlocal_created_at: plan.created_at,
          dlocal_updated_at: plan.updated_at,
          synced_at: new Date().toISOString()
        };

        await supabase
          .from('dlocal_plans_cache')
          .upsert(planData, { onConflict: 'id' });
      }

      dlocalPlans = apiPlans;
    } else {
      console.log(`\u2705 Using ${cachedPlans.length} cached plans`);
    }

    if (dlocalPlans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No plans found',
          stats: { total_synced: 0, created: 0, updated: 0, errors: 0 }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('\n\ud83d\udccb Step 2: Matching with database plans...');
    const { data: dbPlans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('provider', 'dlocal')
      .not('provider_plan_id', 'is', null);

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      throw plansError;
    }

    console.log(`\ud83d\udccb Found ${dbPlans?.length || 0} dLocal plans in database`);

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: any[] = [];

    console.log('\n\ud83d\udd04 Step 3: Syncing subscriptions...');
    for (const dlocalPlan of dlocalPlans) {
      try {
        const dbPlan = dbPlans?.find(p => p.provider_plan_id === String(dlocalPlan.id));

        if (!dbPlan) {
          console.log(`\u23ed\ufe0f  Skipping dLocal plan "${dlocalPlan.name}" (ID: ${dlocalPlan.id}) - not found in database`);
          continue;
        }

        console.log(`\n\ud83d\udd0d Fetching subscriptions for plan: ${dlocalPlan.name} (ID: ${dlocalPlan.id})`);

        const apiUrl = `${dlocalApiUrl}/v1/subscription/plan/${dlocalPlan.id}/subscription/all`;
        console.log(`\ud83d\udd17 API URL: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${dlocalApiKey}`,
            'X-API-Secret': dlocalSecretKey,
            'Content-Type': 'application/json'
          }
        });

        console.log(`\ud83d\udce1 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`\u274c Error fetching subscriptions for plan ${dlocalPlan.id}:`);
          console.error(`   Status: ${response.status} ${response.statusText}`);
          console.error(`   Response: ${errorText}`);
          errors.push({
            plan_id: dbPlan.id,
            plan_name: dlocalPlan.name,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText
          });
          continue;
        }

        const data = await response.json();
        const subscriptions: DLocalSubscription[] = data.data || [];

        console.log(`\u2705 Found ${subscriptions.length} subscriptions for plan ${dlocalPlan.name}`);

        for (const dlocalSub of subscriptions) {
          try {
            if (dlocalSub.status !== 'CONFIRMED' || !dlocalSub.active) {
              console.log(`\u23ed\ufe0f  Skipping subscription ${dlocalSub.id} (status: ${dlocalSub.status}, active: ${dlocalSub.active})`);
              continue;
            }

            const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

            if (userError) {
              console.error('Error listing users:', userError);
              continue;
            }

            const user = userData.users.find(u => u.email === dlocalSub.client_email);

            if (!user) {
              console.log(`\u26a0\ufe0f  User not found for email: ${dlocalSub.client_email}`);
              continue;
            }

            const internalStatus = mapDLocalStatus(dlocalSub.status);

            const currentPeriodStart = new Date(dlocalSub.created_at).toISOString();
            const scheduledDate = new Date(dlocalSub.scheduled_date);
            const currentPeriodEnd = scheduledDate.toISOString();

            const { data: existingSubscription, error: checkError } = await supabase
              .from('subscriptions')
              .select('id, status')
              .eq('user_id', user.id)
              .eq('provider_subscription_id', dlocalSub.subscription_token)
              .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
              console.error('Error checking subscription:', checkError);
              continue;
            }

            if (existingSubscription) {
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  plan_id: dbPlan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_plan_id: String(dlocalPlan.id),
                  current_period_start: currentPeriodStart,
                  current_period_end: currentPeriodEnd,
                  metadata: {
                    dlocal_id: dlocalSub.id,
                    client_id: dlocalSub.client_id,
                    payment_method_code: (dlocalSub as any).payment_method_code,
                    last_synced: new Date().toISOString()
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id);

              if (updateError) {
                console.error('Error updating subscription:', updateError);
                errors.push({
                  user_email: dlocalSub.client_email,
                  error: updateError.message
                });
              } else {
                console.log(`\u2705 Updated subscription for ${dlocalSub.client_email}`);
                totalUpdated++;
              }
            } else {
              const { error: insertError } = await supabase
                .from('subscriptions')
                .insert({
                  user_id: user.id,
                  plan_id: dbPlan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_subscription_id: dlocalSub.subscription_token,
                  provider_plan_id: String(dlocalPlan.id),
                  current_period_start: currentPeriodStart,
                  current_period_end: currentPeriodEnd,
                  cancel_at_period_end: false,
                  metadata: {
                    dlocal_id: dlocalSub.id,
                    client_id: dlocalSub.client_id,
                    payment_method_code: (dlocalSub as any).payment_method_code,
                    synced_from_api: true,
                    last_synced: new Date().toISOString()
                  }
                });

              if (insertError) {
                console.error('Error creating subscription:', insertError);
                errors.push({
                  user_email: dlocalSub.client_email,
                  error: insertError.message
                });
              } else {
                console.log(`\u2705 Created subscription for ${dlocalSub.client_email}`);
                totalCreated++;
              }
            }

            totalSynced++;
          } catch (subError: any) {
            console.error(`Error processing subscription ${dlocalSub.id}:`, subError);
            errors.push({
              subscription_id: dlocalSub.id,
              error: subError.message
            });
          }
        }
      } catch (planError: any) {
        console.error(`Error processing plan ${dlocalPlan.id}:`, planError);
        errors.push({
          plan_id: dlocalPlan.id,
          plan_name: dlocalPlan.name,
          error: planError.message
        });
      }
    }

    const result = {
      success: true,
      message: 'Subscription sync completed',
      stats: {
        total_synced: totalSynced,
        created: totalCreated,
        updated: totalUpdated,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('\n\ud83d\udcca Sync Summary:', result.stats);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('\u274c Sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function mapDLocalStatus(dlocalStatus: string): string {
  const statusMap: Record<string, string> = {
    'CONFIRMED': 'active',
    'PENDING': 'pending',
    'CANCELLED': 'cancelled',
    'EXPIRED': 'expired',
    'FAILED': 'payment_failed'
  };

  return statusMap[dlocalStatus] || 'inactive';
}
```

---

## test-dlocal-auth

```typescript
// File: supabase/functions/test-dlocal-auth/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const results: any[] = [];

    const test1ApiKey = Deno.env.get('DLOCAL_API_KEY');
    const test1SecretKey = Deno.env.get('DLOCAL_SECRET_KEY');

    if (test1ApiKey && test1SecretKey) {
      console.log('\ud83e\uddea Test 1: Using DLOCAL_* variables');
      console.log('API Key:', test1ApiKey.substring(0, 8) + '...' + test1ApiKey.substring(test1ApiKey.length - 4));
      console.log('Secret Key:', test1SecretKey.substring(0, 8) + '...' + test1SecretKey.substring(test1SecretKey.length - 4));

      try {
        const response = await fetch('https://api-sbx.dlocalgo.com/v1/subscription/plan/all', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${test1ApiKey}`,
            'X-API-Secret': test1SecretKey,
            'Content-Type': 'application/json'
          }
        });

        results.push({
          test: 'DLOCAL_* variables',
          status: response.status,
          success: response.ok,
          response: response.ok ? 'SUCCESS' : await response.text()
        });
      } catch (error: any) {
        results.push({
          test: 'DLOCAL_* variables',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        test: 'DLOCAL_* variables',
        success: false,
        error: 'Variables not set'
      });
    }

    const test2ApiKey = Deno.env.get('VITE_DLOCAL_API_KEY');
    const test2SecretKey = Deno.env.get('VITE_DLOCAL_SECRET_KEY');

    if (test2ApiKey && test2SecretKey) {
      console.log('\ud83e\uddea Test 2: Using VITE_DLOCAL_* variables');
      console.log('API Key:', test2ApiKey.substring(0, 8) + '...' + test2ApiKey.substring(test2ApiKey.length - 4));
      console.log('Secret Key:', test2SecretKey.substring(0, 8) + '...' + test2SecretKey.substring(test2SecretKey.length - 4));

      try {
        const response = await fetch('https://api-sbx.dlocalgo.com/v1/subscription/plan/all', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${test2ApiKey}`,
            'X-API-Secret': test2SecretKey,
            'Content-Type': 'application/json'
          }
        });

        results.push({
          test: 'VITE_DLOCAL_* variables',
          status: response.status,
          success: response.ok,
          response: response.ok ? 'SUCCESS' : await response.text()
        });
      } catch (error: any) {
        results.push({
          test: 'VITE_DLOCAL_* variables',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        test: 'VITE_DLOCAL_* variables',
        success: false,
        error: 'Variables not set'
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication tests completed',
        results,
        env_check: {
          'DLOCAL_API_KEY': test1ApiKey ? `SET (${test1ApiKey.length} chars)` : 'NOT SET',
          'DLOCAL_SECRET_KEY': test1SecretKey ? `SET (${test1SecretKey.length} chars)` : 'NOT SET',
          'VITE_DLOCAL_API_KEY': test2ApiKey ? `SET (${test2ApiKey.length} chars)` : 'NOT SET',
          'VITE_DLOCAL_SECRET_KEY': test2SecretKey ? `SET (${test2SecretKey.length} chars)` : 'NOT SET',
        }
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('\u274c Test error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});```

---
