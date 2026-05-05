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

interface PermissionNode {
  actions: string[];
  submenus?: { [submenuSlug: string]: string[] };
}

const isExpoPushToken = (token: string) => /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token);

const DYNAMIC_MFA_WINDOW_SECONDS = 60;

function computeDynamicChallengeCode(applicationInternalId: string, appUserId: string, timestampMs: number, secret: string): string {
  const window = Math.floor(timestampMs / (DYNAMIC_MFA_WINDOW_SECONDS * 1000));
  const seed = `${secret}|${applicationInternalId}|${appUserId}|${window}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;

  const code = (hash >>> 0) % 1000000;
  return code.toString().padStart(6, '0');
}

async function sendExpoPushNotifications(messages: Array<{
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}>) {
  if (!messages.length) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('⚠️ Expo push request failed:', response.status, text);
      return;
    }

    const payload = await response.json();
    console.log('📲 Expo push response:', payload?.data?.length || 0, 'tickets');
  } catch (error) {
    console.warn('⚠️ Expo push send error:', error);
  }
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
    let rolePermissionsHierarchy: { [menuSlug: string]: PermissionNode } = {};

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
          menu:application_menus!inner(id, slug, parent_menu_id),
          action:menu_actions!inner(slug)
        `)
        .eq('role_id', user.role_id)
        .eq('granted', true);

      if (permissions) {
        const menuById: { [menuId: string]: { slug: string; parent_menu_id: string | null } } = {};

        permissions.forEach((perm: any) => {
          const menuData = perm.menu;
          if (menuData?.id && menuData?.slug) {
            menuById[menuData.id] = {
              slug: menuData.slug,
              parent_menu_id: menuData.parent_menu_id || null
            };
          }
        });

        permissions.forEach((perm: any) => {
          const menuId = perm.menu?.id;
          const menuSlug = perm.menu?.slug;
          const actionSlug = perm.action?.slug;

          if (menuId && menuSlug && actionSlug) {
            if (!rolePermissions[menuSlug]) {
              rolePermissions[menuSlug] = [];
            }
            rolePermissions[menuSlug].push(actionSlug);

            const parentMenuId = menuById[menuId]?.parent_menu_id || null;
            if (parentMenuId && menuById[parentMenuId]) {
              const parentSlug = menuById[parentMenuId].slug;

              if (!rolePermissionsHierarchy[parentSlug]) {
                rolePermissionsHierarchy[parentSlug] = {
                  actions: [],
                  submenus: {}
                };
              }

              if (!rolePermissionsHierarchy[parentSlug].submenus) {
                rolePermissionsHierarchy[parentSlug].submenus = {};
              }

              if (!rolePermissionsHierarchy[parentSlug].submenus![menuSlug]) {
                rolePermissionsHierarchy[parentSlug].submenus![menuSlug] = [];
              }

              rolePermissionsHierarchy[parentSlug].submenus![menuSlug].push(actionSlug);
            } else {
              if (!rolePermissionsHierarchy[menuSlug]) {
                rolePermissionsHierarchy[menuSlug] = {
                  actions: []
                };
              }

              rolePermissionsHierarchy[menuSlug].actions.push(actionSlug);
            }
          }
        });

        Object.keys(rolePermissions).forEach((menuSlug) => {
          rolePermissions[menuSlug] = Array.from(new Set(rolePermissions[menuSlug]));
        });

        Object.keys(rolePermissionsHierarchy).forEach((menuSlug) => {
          rolePermissionsHierarchy[menuSlug].actions = Array.from(new Set(rolePermissionsHierarchy[menuSlug].actions));

          if (rolePermissionsHierarchy[menuSlug].submenus) {
            Object.keys(rolePermissionsHierarchy[menuSlug].submenus!).forEach((submenuSlug) => {
              rolePermissionsHierarchy[menuSlug].submenus![submenuSlug] = Array.from(new Set(rolePermissionsHierarchy[menuSlug].submenus![submenuSlug]));
            });
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
        permissions: rolePermissions,
        permissions_hierarchy: rolePermissionsHierarchy
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

    // Resolve tenant_id if application is in tenant mode
    let tenantId: string | null = null;
    let tenantName: string | null = null;
    if (application.auth_mode === 'tenant' && user.tenant_id) {
      tenantId = user.tenant_id;
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('name, slug, domain')
        .eq('id', user.tenant_id)
        .maybeSingle();
      if (tenantData) {
        tenantName = tenantData.name;
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const accessTokenPayload: Record<string, any> = {
      sub: user.id,
      email: user.email,
      name: user.name,
      app_id: application_id,
      role: roleName,
      permissions: rolePermissions,
      permissions_hierarchy: rolePermissionsHierarchy,
      iat: now,
      exp: now + (24 * 60 * 60),
      iss: 'AuthSystem',
      aud: application.domain
    }

    if (tenantId) {
      accessTokenPayload.tenant_id = tenantId;
      accessTokenPayload.tenant_name = tenantName;
    }

    if (validationData && validationData.success) {
      accessTokenPayload.tenant = validationData.tenant;
      accessTokenPayload.subscription = validationData.subscription;
      accessTokenPayload.license = validationData.license;
      accessTokenPayload.has_access = validationData.has_access;
      accessTokenPayload.available_plans = validationData.available_plans;
    }

    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({...accessTokenPayload, type: 'refresh', exp: now + (30 * 24 * 60 * 60)}))}.signature`

    const appTwoFactorEnabled = application?.metadata?.enable_two_factor === true;
    const planFeatures = (validationData?.subscription?.entitlements?.features || []) as Array<any>;
    const planTwoFactorFeature = planFeatures.find((f: any) => f?.code === 'two_factor_auth');
    const planTwoFactorEnabled = planTwoFactorFeature
      ? String(planTwoFactorFeature.value).toLowerCase() === 'true'
      : false;

    const twoFactorEnabled = appTwoFactorEnabled && planTwoFactorEnabled;

    console.log('🔒 2FA gating:', {
      app_enabled: appTwoFactorEnabled,
      plan_enabled: planTwoFactorEnabled,
      effective: twoFactorEnabled,
      plan: validationData?.subscription?.plan_name
    });

    if (twoFactorEnabled) {
      const { data: activeMfaDevices, error: deviceCheckError } = await supabase
        .from('mfa_devices')
        .select('id')
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (deviceCheckError) {
        console.error('❌ Error checking MFA devices:', deviceCheckError);
      }

      if (activeMfaDevices && activeMfaDevices.length > 0) {
        const challengeCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationNumber = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
        const challengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const { data: challengeRow, error: challengeError } = await supabase
          .from('mfa_login_challenges')
          .insert({
            application_id: application.id,
            app_user_id: user.id,
            challenge_code: challengeCode,
            status: 'pending',
            access_token: accessToken,
            refresh_token: refreshToken,
            callback_url: callback_url || null,
            expires_at: challengeExpiresAt,
            metadata: {
              email,
              application_id,
              user_name: user.name,
              ip_address: ipAddress,
              verification_number: verificationNumber,
            }
          })
          .select('id, expires_at')
          .single();

        if (challengeError || !challengeRow) {
          console.error('❌ Error creating MFA challenge:', challengeError);
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'MFA_CHALLENGE_ERROR',
                message: 'No se pudo iniciar el desafío de doble factor'
              }
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const mfaSecret = Deno.env.get('MFA_CHALLENGE_SECRET') || 'authsystem-mfa-secret';
        const dynamicChallengeCode = computeDynamicChallengeCode(application.id, user.id, Date.now(), mfaSecret);

        const { data: devicesForPush, error: pushDevicesError } = await supabase
          .from('mfa_devices')
          .select('id, device_name, push_token, push_provider')
          .eq('application_id', application.id)
          .eq('app_user_id', user.id)
          .eq('is_active', true)
          .not('push_token', 'is', null);

        if (pushDevicesError) {
          console.warn('⚠️ Could not load devices for push:', pushDevicesError);
        }

        const pushMessages = (devicesForPush || [])
          .filter((device: any) => device.push_provider === 'expo' && typeof device.push_token === 'string' && isExpoPushToken(device.push_token))
          .map((device: any) => ({
            to: device.push_token,
            title: `Solicitud de acceso - ${application.name || 'Authenticator'}`,
            body: `Aprueba el ingreso de ${email}. Número: ${verificationNumber}. Código (60s): ${dynamicChallengeCode}`,
            data: {
              type: 'mfa_challenge',
              challenge_id: challengeRow.id,
              challenge_code: dynamicChallengeCode,
              verification_number: verificationNumber,
              application_id,
              user_email: email,
              app_name: application.name,
              device_name: device.device_name || null,
            },
          }));

        if (pushMessages.length > 0) {
          await sendExpoPushNotifications(pushMessages);
        } else {
          console.log('ℹ️ No active push tokens found for user devices');
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'MFA_REQUIRED',
              message: 'Aprobación requerida en la app móvil Authenticator'
            },
            data: {
              challenge_id: challengeRow.id,
              challenge_code: dynamicChallengeCode,
              verification_number: verificationNumber,
              challenge_code_ttl_seconds: DYNAMIC_MFA_WINDOW_SECONDS,
              state: 'mfa_pending',
              expires_at: challengeRow.expires_at,
              polling_endpoint: '/functions/v1/mfa-check-challenge'
            }
          }),
          {
            status: 202,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const pairingExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data: pairingRow, error: pairingError } = await supabase
        .from('mfa_pairing_tokens')
        .insert({
          application_id: application.id,
          app_user_id: user.id,
          expires_at: pairingExpiresAt,
        })
        .select('token, expires_at')
        .single();

      if (pairingError || !pairingRow) {
        console.error('❌ Error creating MFA setup pairing token:', pairingError);
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'MFA_SETUP_ERROR',
              message: 'No se pudo iniciar la configuración de doble factor'
            }
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const qrPayload = {
        type: 'authsystem-mfa-pair',
        pairing_token: pairingRow.token,
        application_id: application.application_id,
        app_name: application.name,
        api_key,
        email,
        password,
        base_url: Deno.env.get('SUPABASE_URL') ?? '',
        expires_at: pairingRow.expires_at,
      };

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MFA_SETUP_REQUIRED',
            message: 'Configura tu app Authenticator para activar doble factor en esta cuenta.'
          },
          data: {
            state: 'mfa_setup_required',
            pairing_token: pairingRow.token,
            expires_at: pairingRow.expires_at,
            qr_payload: qrPayload,
            qr_text: JSON.stringify(qrPayload),
            setup_endpoint: '/functions/v1/mfa-register-device',
            setup_steps: [
              'Abre la app Authenticator en tu móvil',
              'Escanea el QR o pega el pairing token',
              'Registra el dispositivo',
              'Vuelve a iniciar sesión'
            ],
            subscription: validationData?.subscription || null,
            tenant: validationData?.tenant || null
          }
        }),
        {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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
          permissions_hierarchy: rolePermissionsHierarchy,
          metadata: user.metadata || {},
          created_at: user.created_at,
          ...(tenantId ? { tenant_id: tenantId, tenant_name: tenantName } : {})
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
      response.data.available_plans = validationData.available_plans;

      if (response.data.tenant && tenantId) {
        const { count: activeUsersCount } = await supabase
          .from('app_users')
          .select('id', { count: 'exact', head: true })
          .eq('application_id', application.id)
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

        response.data.tenant = {
          ...response.data.tenant,
          active_users_count: activeUsersCount || 0
        };
      }
    }

    if (callback_url) {
      // Generar un código temporal corto en lugar de pasar el token completo en la URL
      const authCode = crypto.randomUUID();

      // Guardar el código con los tokens en la base de datos (expira en 5 minutos)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase.from('auth_codes').insert({
        code: authCode,
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: user.id,
        application_id: application.id,
        expires_at: expiresAt
      });

      const callbackParams = new URLSearchParams({
        code: authCode,
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
