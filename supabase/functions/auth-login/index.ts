import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface LoginRequest {
  email: string
  password: string
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

    const { email, password, application_id, callback_url }: LoginRequest = requestBody

    // Validate required fields
    if (!email || !password || !application_id) {
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
      .select(`
        *,
        user_roles(
          role_name,
          permissions
        )
      `)
      .eq('application_id', application.id)
      .eq('email', email)
      .eq('status', 'active')
      .single()

    if (userError || !appUser) {
      // Log intento fallido
      await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
        success: false,
        error_message: 'Usuario no encontrado',
        metadata: { email }
      })

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

    // 3.5. Verificar si el usuario requiere verificación de email
    if (appUser.status === 'pending') {
      // Log intento de login con email no verificado
      await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: appUser.id,
        event_type: 'failed_login',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
        success: false,
        error_message: 'Email no verificado',
        metadata: { email, reason: 'email_not_verified' }
      })

      const response = {
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Debes verificar tu email antes de iniciar sesión',
          user_id: appUser.id,
          email: appUser.email,
          next_step: 'verify_email'
        }
      }

      // Si hay callback_url, redirigir a página de verificación
      if (callback_url) {
        const verifyParams = new URLSearchParams({
          user_id: appUser.id,
          email: appUser.email,
          state: 'email_verification_required',
          message: 'Debes verificar tu email antes de continuar'
        })
        
        response.error.callback_url = `${callback_url.replace('/callback', '/verify-email')}?${verifyParams.toString()}`
      }

      return new Response(
        JSON.stringify(response),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 3. Verificar contraseña (en producción usar bcrypt)
    const isValidPassword = btoa(password) === appUser.password_hash

    if (!isValidPassword) {
      // Log intento fallido
      await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: appUser.id,
        event_type: 'failed_login',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
        success: false,
        error_message: 'Contraseña incorrecta',
        metadata: { email }
      })

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

    // 4. Generar tokens JWT
    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload = {
      sub: appUser.id,
      email: appUser.email,
      name: appUser.name,
      app_id: application_id,
      roles: appUser.user_roles?.map(r => r.role_name) || [],
      permissions: appUser.user_roles?.flatMap(r => r.permissions) || [],
      iat: now,
      exp: now + (24 * 60 * 60), // 24 horas
      iss: 'AuthSystem',
      aud: application.domain
    }

    const refreshTokenPayload = {
      sub: appUser.id,
      app_id: application_id,
      type: 'refresh',
      iat: now,
      exp: now + (30 * 24 * 60 * 60), // 30 días
      iss: 'AuthSystem'
    }

    // Generar tokens (simplificado para demo - usar librería JWT real)
    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(refreshTokenPayload))}.signature`

    // 5. Actualizar último login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id)

    // 6. Log login exitoso
    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: appUser.id,
      event_type: 'login',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent'),
      success: true,
      metadata: { email, login_method: 'email_password' }
    })

    // 7. Preparar respuesta
    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 horas en segundos
        user: {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          roles: appUser.user_roles?.map(r => r.role_name) || [],
          permissions: appUser.user_roles?.flatMap(r => r.permissions) || [],
          metadata: appUser.metadata || {},
          last_login: new Date().toISOString()
        },
        application: {
          id: application_id,
          name: application.name,
          domain: application.domain
        }
      }
    }

    // 8. Si hay callback_url, generar URL de redirección
    if (callback_url) {
      const callbackParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: appUser.id,
        state: 'success'
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