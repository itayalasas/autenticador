import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function getResetPasswordEmailHTML(name: string, resetUrl: string, appName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperar Contraseña</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Recuperar Contraseña</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hola <strong>${name}</strong>,
                  </p>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${appName}</strong>.
                  </p>
                  <p style="margin: 0 0 30px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Haz clic en el botón de abajo para crear una nueva contraseña:
                  </p>
                  
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(240, 147, 251, 0.4);">
                          Restablecer Contraseña
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; color: #856404; font-size: 13px; line-height: 1.6;">
                    <strong>⚠️ Nota de seguridad:</strong> Si no solicitaste este cambio, ignora este email y tu contraseña permanecerá sin cambios. El enlace expirará en 24 horas.
                  </p>
                  
                  <p style="margin: 20px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <a href="${resetUrl}" style="color: #f5576c; word-break: break-all;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    Este email fue enviado por <strong>${appName}</strong>
                  </p>
                  <p style="margin: 10px 0 0; color: #999999; font-size: 12px;">
                    Powered by AuthSystem
                  </p>
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

async function sendResetPasswordEmail(
  supabase: any,
  email: string,
  name: string,
  resetUrl: string,
  appName: string,
  applicationId: string,
  userId: string,
  emailConfig: any
) {
  console.log('📧 Starting sendResetPasswordEmail function...');
  console.log('📧 Parameters:', {
    email,
    name,
    appName,
    applicationId,
    userId
  });

  const html = getResetPasswordEmailHTML(name, resetUrl, appName);
  const subject = `Recupera tu contraseña - ${appName}`;

  try {
    // Call send-email edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    console.log('📧 Supabase URL:', supabaseUrl);
    console.log('📧 Service Key exists:', !!serviceKey);
    console.log('📧 Target URL:', `${supabaseUrl}/functions/v1/send-email`);

    const payload = {
      to: email,
      subject: subject,
      html: html,
      application_id: applicationId,
      app_user_id: userId
    };

    console.log('📧 Request payload:', {
      to: payload.to,
      subject: payload.subject,
      application_id: payload.application_id,
      app_user_id: payload.app_user_id,
      html_length: html.length
    });

    console.log('📧 Making fetch request...');

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload)
    });

    console.log('📧 Response status:', response.status);
    console.log('📧 Response ok:', response.ok);

    const result = await response.json();

    console.log('📧 Response body:', result);

    if (result.success) {
      console.log('✅ Reset password email sent successfully to:', email);
    } else {
      console.error('❌ Failed to send reset password email:', result.error);
    }
  } catch (error) {
    console.error('❌ EXCEPTION sending reset email:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

serve(async (req) => {
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

    const emailConfig = application.email_config || {}
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