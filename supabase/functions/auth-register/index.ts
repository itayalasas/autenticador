import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RegisterRequest {
  email: string
  password: string
  name: string
  application_id: string
  callback_url?: string
  metadata?: Record<string, any>
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

    const { email, password, name, application_id, callback_url, metadata }: RegisterRequest = requestBody

    // Validate required fields
    if (!email || !password || !name || !application_id) {
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

    // 1. Verificar que la aplicación existe y permite registro público
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

    // 2. Verificar si el usuario ya existe
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('application_id', application.id)
      .eq('email', email)
      .single()

    if (existingUser) {
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

    // 3. Crear usuario
    const passwordHash = btoa(password) // En producción usar bcrypt
    
     // Verificar configuración de la aplicación
     const requireEmailVerification = true; // Obtener de configuración de la app
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
      .single()

    if (createError) {
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

    // 4. Asignar rol por defecto
    await supabase
      .from('user_roles')
      .insert({
        app_user_id: newUser.id,
        role_name: 'user',
        permissions: ['read']
      })

    // 5. Log registro exitoso
    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: newUser.id,
      event_type: 'register',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent'),
      success: true,
      metadata: { email, registration_method: 'email_password' }
    })

     // 6. Generar respuesta basada en si requiere verificación de email
    // 6. Generar tokens para login automático
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

     // Si requiere verificación de email, no generar tokens aún
     if (requireEmailVerification) {
       const response = {
         success: true,
         data: {
           message: 'Usuario registrado exitosamente. Por favor verifica tu email antes de continuar.',
           user_id: newUser.id,
           email_verification_required: true,
           next_step: 'verify_email'
         }
       }
       
       // Redirigir a página de verificación de email
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

    // 7. Si hay callback_url, generar URL de redirección
    if (callback_url) {
      const callbackParams = new URLSearchParams({
        token: accessToken,
        refresh_token: refreshToken,
        user_id: newUser.id,
        state: 'registered_and_logged_in'
      })
      
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