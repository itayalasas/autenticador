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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
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

    // Validate request body
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

    const { email, application_id, callback_url }: ResetPasswordRequest = requestBody

    // Validate required fields
    if (!email || !application_id) {
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

    // Get IP address from request
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'

    // Check if IP is blocked
    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle()

    if (blockedIP) {
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

    // 1. Verificar que la aplicación existe
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single()

    if (appError || !application) {
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

    // 2. Buscar el usuario en la aplicación
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select('*')
      .eq('application_id', application.id)
      .eq('email', email)
      .single()

    if (userError || !appUser) {
      // Log intento con usuario no encontrado
      await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'password_reset',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
        success: false,
        error_message: 'Usuario no encontrado',
        metadata: { email, reason: 'user_not_found' }
      })

      // Por seguridad, no revelamos si el usuario existe o no
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

    // 3. Generar token de recuperación (simplificado para demo)
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

    // 4. Guardar token de recuperación en metadata del usuario
    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        metadata: {
          ...appUser.metadata,
          reset_token: resetToken,
          reset_token_expires: expiresAt.toISOString()
        }
      })
      .eq('id', appUser.id)

    if (updateError) {
      console.error('Error updating user with reset token:', updateError)
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

    // 5. Construir URL de recuperación
    const resetUrl = callback_url 
      ? `${callback_url.replace('/callback', '/reset-password')}?token=${resetToken}&email=${encodeURIComponent(email)}`
      : `https://${application.domain}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    // 6. Log evento exitoso
    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: appUser.id,
      event_type: 'password_reset',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent'),
      success: true,
      metadata: { 
        email, 
        reset_token: resetToken,
        expires_at: expiresAt.toISOString(),
        reset_url: resetUrl
      }
    })

    // 7. En un entorno real, aquí enviarías el email
    // Para demo, devolvemos la información
    const response = {
      success: true,
      data: {
        message: 'Email de recuperación enviado exitosamente.',
        email: email,
        // En producción, NO incluir estos datos sensibles
        debug_info: {
          reset_token: resetToken,
          reset_url: resetUrl,
          expires_at: expiresAt.toISOString()
        }
      }
    }

    // 8. Si hay callback_url, incluir URL de redirección
    if (callback_url) {
      response.data.callback_url = resetUrl
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