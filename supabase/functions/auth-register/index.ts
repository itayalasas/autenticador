import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function getVerificationEmailHTML(name: string, verificationUrl: string, appName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifica tu email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Verifica tu Email</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hola <strong>${name}</strong>,
                  </p>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Gracias por registrarte en <strong>${appName}</strong>. Para completar tu registro y activar tu cuenta, necesitamos verificar tu dirección de email.
                  </p>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Haz clic en el botón de abajo para verificar tu email:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                          Verificar Email
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function sendVerificationEmail(
  supabase: any,
  email: string,
  name: string,
  verificationUrl: string,
  appName: string,
  applicationId: string,
  userId: string,
  emailConfig: any
) {
  const fromName = emailConfig?.from_name || 'AuthSystem';
  const fromEmail = emailConfig?.from_email || 'noreply@authsystem.com';
  
  const html = getVerificationEmailHTML(name, verificationUrl, appName);
  
  try {
    const { error } = await supabase.from('email_logs').insert({
      to_email: email,
      from_email: fromEmail,
      from_name: fromName,
      subject: `Verifica tu email - ${appName}`,
      html_content: html,
      status: 'sent',
      application_id: applicationId,
      app_user_id: userId,
      sent_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error logging email:', error);
    }
    
    console.log('📧 Verification email logged for:', email);
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { email, password, name, application_id, callback_url, client_ip, metadata }: RegisterRequest = requestBody

    if (!email || !password || !name || !application_id) {
      const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
      
      // Log missing fields error
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
      )
    }

    const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
    
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
      )
    }

    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      console.log('❌ Email already exists:', email, 'in application:', application.name);
      
      // Log email already exists error
      await supabase.from('auth_logs').insert({
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
      )
    }

    const passwordHash = btoa(password)
    const emailConfig = application.email_config || {}
    const requireEmailVerification = emailConfig.require_email_verification || false
    const userStatus = requireEmailVerification ? 'pending' : 'active'
     
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
      .single()

    if (createError) {
      console.log('❌ Error creating user:', createError.message);
      
      // Log user creation error
      await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Error al crear usuario',
        metadata: { 
          email,
          name,
          error_type: 'database_error',
          db_error: createError.message,
          application_name: application.name
        }
      });
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CREATE_USER_FAILED',
            message: 'Error al crear el usuario'
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    await supabase
      .from('user_roles')
      .insert({
        app_user_id: newUser.id,
        role_name: 'user',
        permissions: ['read']
      })

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
      })
      if (logError) console.error('Error logging registration:', logError)
    } catch (logErr) {
      console.error('Exception logging registration:', logErr)
    }

    if (requireEmailVerification) {
      const verificationToken = generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await supabase.from('email_verification_tokens').insert({
        app_user_id: newUser.id,
        token: verificationToken,
        expires_at: expiresAt.toISOString()
      });
      
      const baseUrl = callback_url ? callback_url.split('/callback')[0] : 'https://yourdomain.com';
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
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

      if (emailConfig.notify_admin_new_user && emailConfig.admin_notification_email) {
        const adminHtml = `
          <h2>Nuevo Registro en ${application.name}</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>IP:</strong> ${ipAddress}</p>
        `;
        
        await supabase.from('email_logs').insert({
          to_email: emailConfig.admin_notification_email,
          from_email: emailConfig.from_email || 'noreply@authsystem.com',
          from_name: emailConfig.from_name || 'AuthSystem',
          subject: `Nuevo registro en ${application.name}`,
          html_content: adminHtml,
          status: 'sent',
          application_id: application.id,
          sent_at: new Date().toISOString()
        });
      }
      
      const response = {
        success: true,
        data: {
          message: 'Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.',
          user_id: newUser.id,
          email_verification_required: true,
          next_step: 'verify_email'
        }
      }
      
      if (callback_url) {
        const verifyParams = new URLSearchParams({
          user_id: newUser.id,
          email: newUser.email,
          state: 'email_verification_required',
          message: 'Por favor verifica tu email para continuar'
        })
        
        response.data.callback_url = `${callback_url.replace('/callback', '/verify-email')}?${verifyParams.toString()}`
      }
      
      return new Response(
        JSON.stringify(response),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload = {
      sub: newUser.id,
      email: newUser.email,
      name: newUser.name,
      app_id: application_id,
      roles: ['user'],
      permissions: ['read'],
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
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          roles: ['user'],
          permissions: ['read'],
          metadata: newUser.metadata || {},
          created_at: newUser.created_at
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
        user_id: newUser.id,
        state: 'registered_and_logged_in'
      })
      })
    } catch (logError) {
      response.data.callback_url = `${callback_url}?${callbackParams.toString()}`
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Register error:', error)
    
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
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0',
      user_agent: req.headers.get('user-agent') || 'unknown',
      success: false,
      error_message: 'Error interno del servidor en registro',
      metadata: { 
        error_type: 'internal_error',
        error_message: error.message,
        endpoint: 'auth-register'
      }
    }).catch(logError => {
      console.error('Error logging internal error:', logError);
    });
    
        ip_address: ipAddress,
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