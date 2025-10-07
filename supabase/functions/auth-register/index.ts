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
    
    // Assign default user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        app_user_id: newUser.id,
        role_name: 'user',
        permissions: ['read']
      });
    
    if (roleError) {
      console.error('⚠️ Error assigning default role:', roleError);
      // Continue without role assignment if it fails
    } else {
      console.log('✅ Default role assigned successfully');
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
});