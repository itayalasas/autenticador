import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

interface ResetPasswordRequest {
  email: string
  application_id: string
  api_key: string
  callback_url?: string
  client_ip?: string
}

function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sendResetPasswordEmailViaAPI(
  email: string,
  name: string,
  resetUrl: string,
  expiresAt: Date,
  expirationMinutes: number,
  applicationName: string,
  emailConfig: Record<string, any> = {}
): Promise<boolean> {
  try {
    const DEFAULT_API_KEY = 'sk_4b762d5e0cbf7382c81daf86487cef7baf6581168b2c224592f9b125679b654e';
    const EMAIL_API_URL = emailConfig?.external_email_api_url || Deno.env.get('EMAIL_API_URL') || 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email';
    const EMAIL_API_KEY = emailConfig?.external_email_api_key || Deno.env.get('EMAIL_API_KEY') || DEFAULT_API_KEY;
    const TEMPLATE_NAME = emailConfig?.reset_password_template_name || 'reset-password-authsystem';

    console.log('📧 Sending reset password email via external API...');
    console.log('📧 API URL:', EMAIL_API_URL);
    console.log('📧 Template:', TEMPLATE_NAME);
    console.log('📧 Recipient:', email);
    console.log('📧 Using app-specific key:', !!emailConfig?.external_email_api_key);

    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EMAIL_API_KEY
      },
      body: JSON.stringify({
        template_name: TEMPLATE_NAME,
        recipient_email: email,
        data: {
          client_name: name,
          aplication_name: applicationName,
          application_name: applicationName,
          reset_url: resetUrl,
          expiration_minutes: String(expirationMinutes),
          expiration_hours: String(Math.round((expirationMinutes / 60) * 10) / 10),
          expires_at: expiresAt.toISOString(),
          expires_at_formatted: expiresAt.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Email API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Email API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Email sent successfully via external API:', result);
    return true;
  } catch (error: any) {
    console.error('❌ Error calling email API:', error);
    throw error;
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

    const { email, application_id, api_key, callback_url, client_ip }: ResetPasswordRequest = requestBody

    if (!email || !application_id || !api_key) {
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
        event_type: 'failed_reset_password',
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

    // Check if password reset emails are enabled
    const emailConfig = application.email_config || {};
    const shouldSendPasswordResetEmail = emailConfig.send_password_reset_email !== false; // Default to true

    console.log('📧 Email config:', {
      send_password_reset_email: shouldSendPasswordResetEmail
    });

    // Generate reset token
    const resetToken = generateResetToken()
    const tokenExpirationMinutes = Number(application?.email_config?.reset_token_expiration_minutes) || 60 // default 1 hour
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + tokenExpirationMinutes)

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
    
    // Build reset URL - usando /reset-password-confirm para el nuevo formulario
    const baseUrl = callback_url ? callback_url.split('/callback')[0] : `https://${application.domain}`
    const resetUrl = `${baseUrl}/reset-password-confirm?token=${resetToken}&email=${encodeURIComponent(email)}`

    console.log('🔗 Reset URL generated:', resetUrl);

    // Send reset email via external API
    if (shouldSendPasswordResetEmail) {
      try {
        await sendResetPasswordEmailViaAPI(
          email,
          appUser.name,
          resetUrl,
          expiresAt,
          tokenExpirationMinutes,
          application.name,
          application.email_config || {}
        );
        console.log('✅ Reset email sent successfully');
      } catch (emailError: any) {
        console.error('⚠️ Email sending failed, but continuing with reset flow:', emailError.message);
        // Don't throw - we still want the reset password flow to succeed even if email fails
      }
    } else {
      console.log('📧 Email sending disabled for this application');
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