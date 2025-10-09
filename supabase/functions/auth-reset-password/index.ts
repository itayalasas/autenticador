import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
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
})