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

    const { email, password, application_id, callback_url }: LoginRequest = requestBody

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
      const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'
      const clientIp = ipHeader.split(',')[0].trim()

      try {
        const { error: logError } = await supabase.from('auth_logs').insert({
          application_id: application.id,
          event_type: 'failed_login',
          ip_address: clientIp,
          user_agent: req.headers.get('user-agent') || 'unknown',
          success: false,
          error_message: 'Usuario no encontrado',
          metadata: { email }
        })
        if (logError) console.error('Error logging failed login:', logError)

        // Check and auto-block IP if threshold reached
        const { data: wasBlocked, error: blockError } = await supabase.rpc('check_and_auto_block_ip', {
          p_application_id: application.id,
          p_ip_address: clientIp
        })
        if (blockError) console.error('Error checking auto-block:', blockError)
        if (wasBlocked) console.log('IP auto-blocked:', clientIp)
      } catch (logErr) {
        console.error('Exception logging failed login:', logErr)
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

    if (appUser.status === 'pending') {
      const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'
      const clientIp = ipHeader.split(',')[0].trim()

      try {
        const { error: logError } = await supabase.from('auth_logs').insert({
          application_id: application.id,
          app_user_id: appUser.id,
          event_type: 'failed_login',
          ip_address: clientIp,
          user_agent: req.headers.get('user-agent') || 'unknown',
          success: false,
          error_message: 'Email no verificado',
          metadata: { email, reason: 'email_not_verified' }
        })
        if (logError) console.error('Error logging unverified email:', logError)
      } catch (logErr) {
        console.error('Exception logging unverified email:', logErr)
      }

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

    const isValidPassword = btoa(password) === appUser.password_hash

    if (!isValidPassword) {
      const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'
      const clientIp = ipHeader.split(',')[0].trim()

      try {
        const { error: logError } = await supabase.from('auth_logs').insert({
          application_id: application.id,
          app_user_id: appUser.id,
          event_type: 'failed_login',
          ip_address: clientIp,
          user_agent: req.headers.get('user-agent') || 'unknown',
          success: false,
          error_message: 'Contraseña incorrecta',
          metadata: { email }
        })
        if (logError) console.error('Error logging wrong password:', logError)

        // Check and auto-block IP if threshold reached
        const { data: wasBlocked, error: blockError } = await supabase.rpc('check_and_auto_block_ip', {
          p_application_id: application.id,
          p_ip_address: clientIp
        })
        if (blockError) console.error('Error checking auto-block:', blockError)
        if (wasBlocked) console.log('IP auto-blocked:', clientIp)
      } catch (logErr) {
        console.error('Exception logging wrong password:', logErr)
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

    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload = {
      sub: appUser.id,
      email: appUser.email,
      name: appUser.name,
      app_id: application_id,
      roles: appUser.user_roles?.map(r => r.role_name) || [],
      permissions: appUser.user_roles?.flatMap(r => r.permissions) || [],
      iat: now,
      exp: now + (24 * 60 * 60),
      iss: 'AuthSystem',
      aud: application.domain
    }

    const refreshTokenPayload = {
      sub: appUser.id,
      app_id: application_id,
      type: 'refresh',
      iat: now,
      exp: now + (30 * 24 * 60 * 60),
      iss: 'AuthSystem'
    }

    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(refreshTokenPayload))}.signature`

    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id)

    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0'
    const clientIp = ipHeader.split(',')[0].trim()

    try {
      const { error: logError } = await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: appUser.id,
        event_type: 'login',
        ip_address: clientIp,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: true,
        metadata: { email, login_method: 'email_password' }
      })
      if (logError) console.error('Error logging successful login:', logError)
    } catch (logErr) {
      console.error('Exception logging successful login:', logErr)
    }

    const response = {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
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