import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
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
  api_key: string
  callback_url?: string
  client_ip?: string
}

Deno.serve(async (req) => {
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

    const { email, password, application_id, api_key, callback_url, client_ip }: LoginRequest = requestBody

    if (!email || !password || !application_id || !api_key) {
      const ipAddress = client_ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
      
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
            message: 'Email, password, application_id, and api_key are required'
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
      has_password: !!password,
      has_api_key: !!api_key
    });

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
        event_type: 'failed_login',
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

    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', ipAddress)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle()

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

    console.log('🛡️ Checking rate limit for IP:', ipAddress);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ipAddress,
      p_endpoint: 'auth-login',
      p_max_attempts: 5,
      p_window_minutes: 1
    });

    if (rateLimitError) {
      console.error('❌ Rate limit check error:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log('🚫 Rate limit exceeded for IP:', ipAddress);

      await supabase.from('auth_logs').insert({
        application_id: null,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'Rate limit excedido',
        metadata: {
          email,
          application_id,
          error_type: 'rate_limit_exceeded',
          blocked_until: rateLimitResult.blocked_until
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiados intentos de login. Por favor espera antes de intentar nuevamente.',
            blocked_until: rateLimitResult.blocked_until,
            reason: rateLimitResult.reason
          }
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '900' }
        }
      );
    }

    console.log('✅ Rate limit check passed:', rateLimitResult);

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', application_id)
      .single()

    if (appError || !application) {
      console.log('❌ Application not found:', application_id);
      
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

    if (apiKeyData.application_id !== application.id) {
      console.log('❌ API Key does not belong to this application');
      console.log('  API Key application_id:', apiKeyData.application_id);
      console.log('  Application internal id:', application.id);

      await supabase.from('auth_logs').insert({
        application_id: application.id,
        event_type: 'failed_login',
        ip_address: ipAddress,
        user_agent: req.headers.get('user-agent') || 'unknown',
        success: false,
        error_message: 'API Key no pertenece a esta aplicación',
        metadata: {
          email,
          application_id,
          error_type: 'api_key_mismatch',
          api_key_app_id: apiKeyData.application_id,
          expected_app_id: application.id
        }
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'API_KEY_MISMATCH',
            message: 'API Key no pertenece a esta aplicación'
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ API Key belongs to application');

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

    let roleName = 'user';
    let rolePermissions: { [menuSlug: string]: string[] } = {};

    if (user.role_id) {
      const { data: roleData } = await supabase
        .from('application_roles')
        .select('name')
        .eq('id', user.role_id)
        .maybeSingle();

      if (roleData) {
        roleName = roleData.name;
      }

      const { data: permissions } = await supabase
        .from('role_permissions')
        .select(`
          granted,
          menu:application_menus!inner(slug),
          action:menu_actions!inner(slug)
        `)
        .eq('role_id', user.role_id)
        .eq('granted', true);

      if (permissions) {
        permissions.forEach((perm: any) => {
          const menuSlug = perm.menu?.slug;
          const actionSlug = perm.action?.slug;

          if (menuSlug && actionSlug) {
            if (!rolePermissions[menuSlug]) {
              rolePermissions[menuSlug] = [];
            }
            rolePermissions[menuSlug].push(actionSlug);
          }
        });
      }
    }

    console.log('✅ Login successful for user:', user.email);

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
        role: roleName,
        permissions: rolePermissions
      }
    });

    if (logError) {
      console.error('❌ Error logging successful login:', logError);
    } else {
      console.log('📝 Logged successful login for:', email);
    }

    let validationData = null;

    try {
      console.log('🔍 Validating user license with external API...');

      const validationPayload = {
        external_app_id: application_id,
        external_user_id: user.id
      };

      console.log('📤 Sending validation request with payload:', validationPayload);

      const validationResponse = await fetch(
        'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/validation-api/validate-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validationPayload)
        }
      );

      console.log('📥 Validation API response status:', validationResponse.status);

      if (validationResponse.ok) {
        validationData = await validationResponse.json();
        console.log('✅ License validation successful:', {
          has_access: validationData.has_access,
          subscription_status: validationData.subscription?.status,
          plan_name: validationData.subscription?.plan_name
        });
      } else {
        console.warn('⚠️ License validation failed with status:', validationResponse.status);
        const errorText = await validationResponse.text();
        console.warn('⚠️ License validation error:', errorText);
      }
    } catch (validationError) {
      console.error('❌ Error validating license:', validationError);
    }

    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      app_id: application_id,
      role: roleName,
      permissions: rolePermissions,
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
          role: roleName,
          permissions: rolePermissions,
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

    if (validationData && validationData.success) {
      response.data.tenant = validationData.tenant;
      response.data.subscription = validationData.subscription;
      response.data.license = validationData.license;
      response.data.has_access = validationData.has_access;
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
})
