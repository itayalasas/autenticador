import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveApplicationBillingAccess } from '../_shared/application-billing.ts';
import { resolveRoleAccess } from '../_shared/role-access.ts';
import { issueAuthTokens, resolveApplicationJwtSecret, verifyAuthToken } from '../_shared/auth-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const IMPERSONATION_ACCESS_TTL_SECONDS = 60 * 60; // 1h — deliberately shorter than a normal login session
const IMPERSONATION_REFRESH_TTL_SECONDS = 60 * 60;

interface ImpersonateRequest {
  action?: 'start' | 'end';
  application_id: string;
  api_key: string;
  admin_token: string;
  target_user_id?: string;
  target_email?: string;
  reason?: string;
  session_id?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

function getDefaultImpersonationAdminEmails(): string[] {
  const raw = Deno.env.get('IMPERSONATION_ADMIN_EMAILS') || 'administrador@sendcraft.net';
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || '0.0.0.0';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Only POST method is allowed', 405);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: ImpersonateRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const {
    action = 'start',
    application_id,
    api_key,
    admin_token,
    target_user_id,
    target_email,
    reason,
    session_id,
  } = body;

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!application_id || !api_key || !admin_token) {
    return errorResponse('MISSING_FIELDS', 'application_id, api_key y admin_token son requeridos', 400);
  }

  // Validate API key + application, same as auth-verify-token
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from('api_keys')
    .select('id, application_id, is_active')
    .eq('key_hash', api_key)
    .eq('is_active', true)
    .maybeSingle();

  if (apiKeyError || !apiKeyData) {
    return errorResponse('INVALID_API_KEY', 'API key inválida o inactiva', 401);
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('id, application_id, name, domain, jwt_secret, billing_config')
    .eq('application_id', application_id)
    .maybeSingle();

  if (applicationError || !application) {
    return errorResponse('APPLICATION_NOT_FOUND', 'Aplicación no encontrada', 404);
  }

  if (apiKeyData.application_id !== application.id) {
    return errorResponse('APPLICATION_MISMATCH', 'La API key no pertenece a la aplicación solicitada', 403);
  }

  const jwtSecret = await resolveApplicationJwtSecret(supabase, application.id, application.jwt_secret);

  let adminClaims: Record<string, any>;
  try {
    adminClaims = await verifyAuthToken(admin_token, jwtSecret) as Record<string, any>;
  } catch {
    return errorResponse('INVALID_TOKEN', 'admin_token inválido o con firma no válida', 401);
  }

  if (adminClaims.app_id !== application_id) {
    return errorResponse('TOKEN_APPLICATION_MISMATCH', 'El admin_token no pertenece a la aplicación solicitada', 401);
  }

  const { data: adminUser, error: adminUserError } = await supabase
    .from('app_users')
    .select('id, email, name, status')
    .eq('id', adminClaims.sub)
    .eq('application_id', application.id)
    .maybeSingle();

  if (adminUserError || !adminUser || adminUser.status !== 'active') {
    return errorResponse('ADMIN_NOT_FOUND', 'No se pudo validar la cuenta del administrador', 401);
  }

  const adminAllowlist = getDefaultImpersonationAdminEmails();
  const adminEmailNormalized = String(adminUser.email || '').trim().toLowerCase();

  if (!adminAllowlist.includes(adminEmailNormalized)) {
    return errorResponse('FORBIDDEN', 'Esta cuenta no tiene permiso para acceder como otro usuario', 403);
  }

  if (action === 'end') {
    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: target_user_id || null,
      event_type: 'impersonation_end',
      ip_address: ipAddress,
      user_agent: userAgent,
      success: true,
      metadata: {
        admin_id: adminUser.id,
        admin_email: adminUser.email,
        session_id: session_id || null,
      },
    }).then(({ error }) => {
      if (error) console.error('Error logging impersonation_end:', error);
    });

    return jsonResponse({ success: true, data: { ended: true } });
  }

  if (adminClaims.impersonation === true) {
    return errorResponse('CANNOT_CHAIN_IMPERSONATION', 'No se puede iniciar una impersonación dentro de otra', 403);
  }

  if (!reason || !reason.trim()) {
    return errorResponse('MISSING_REASON', 'El motivo de acceso es requerido', 400);
  }

  if (!target_user_id && !target_email) {
    return errorResponse('MISSING_TARGET', 'target_user_id o target_email son requeridos', 400);
  }

  let rateLimitResult: { allowed?: boolean } | null = null;
  try {
    const { data } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ipAddress,
      p_endpoint: 'auth-impersonate',
      p_max_attempts: 20,
      p_window_minutes: 5,
    });
    rateLimitResult = data;
  } catch (error) {
    console.warn('⚠️ check_rate_limit RPC failed, allowing request:', error);
  }

  if (rateLimitResult && rateLimitResult.allowed === false) {
    return errorResponse('RATE_LIMIT_EXCEEDED', 'Demasiados intentos de impersonación. Espera antes de reintentar.', 429);
  }

  let targetQuery = supabase
    .from('app_users')
    .select('*')
    .eq('application_id', application.id);

  targetQuery = target_user_id
    ? targetQuery.eq('id', target_user_id)
    : targetQuery.eq('email', target_email);

  const { data: targetUser, error: targetUserError } = await targetQuery.maybeSingle();

  if (targetUserError || !targetUser) {
    return errorResponse('TARGET_NOT_FOUND', 'Usuario objetivo no encontrado', 404);
  }

  const targetEmailNormalized = String(targetUser.email || '').trim().toLowerCase();
  if (adminAllowlist.includes(targetEmailNormalized)) {
    return errorResponse('CANNOT_IMPERSONATE_ADMIN', 'No se puede acceder como otra cuenta administradora', 403);
  }

  // auth-verify-token (invocado por el frontend al hidratar cualquier JWT) exige
  // status === 'active', así que un token de impersonación para una cuenta inactiva
  // quedaría inutilizable apenas se intente usar. Se rechaza acá con un mensaje claro
  // en vez de dejar que falle más abajo en la cadena con un error confuso.
  if (targetUser.status !== 'active') {
    return errorResponse(
      'TARGET_NOT_ACTIVE',
      `No se puede acceder como este usuario porque su cuenta está en estado "${targetUser.status}"`,
      409,
    );
  }

  let roleName = 'user';
  let rolePermissions: Record<string, string[]> = {};
  let rolePermissionsHierarchy: Record<string, any> = {};

  if (targetUser.role_id) {
    const resolvedRoleAccess = await resolveRoleAccess(supabase, targetUser.role_id);
    roleName = resolvedRoleAccess.roleName;
    rolePermissions = resolvedRoleAccess.rolePermissions;
    rolePermissionsHierarchy = resolvedRoleAccess.rolePermissionsHierarchy;
  }

  const tenantId: string | null = targetUser.tenant_id || null;
  let tenantName: string | null = null;

  if (tenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .maybeSingle();
    tenantName = tenant?.name || null;
  }

  let validationData: any = null;
  try {
    validationData = await resolveApplicationBillingAccess({
      supabase,
      application,
      appUser: targetUser,
      tenantId,
      environmentName: null,
    });
  } catch (error) {
    console.warn('⚠️ Impersonation billing resolution failed:', error);
  }

  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const accessTokenPayload: Record<string, any> = {
    sub: targetUser.id,
    email: targetUser.email,
    name: targetUser.name,
    app_id: application_id,
    app_name: application.name,
    app_domain: application.domain,
    role: roleName,
    roles: roleName ? [roleName] : [],
    permissions: rolePermissions,
    permissions_hierarchy: rolePermissionsHierarchy,
    iss: 'AuthSystem',
    aud: application.domain,
    user_metadata: targetUser.metadata || {},
    user_created_at: targetUser.created_at,
    impersonation: true,
    impersonated_by: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    },
    impersonation_reason: reason.trim(),
    impersonation_session_id: sessionId,
    impersonation_started_at: startedAt,
  };

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

  const { accessToken, refreshToken } = await issueAuthTokens(jwtSecret, accessTokenPayload, {
    accessTtlSeconds: IMPERSONATION_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: IMPERSONATION_REFRESH_TTL_SECONDS,
  });

  const expiresAt = new Date(Date.now() + IMPERSONATION_ACCESS_TTL_SECONDS * 1000).toISOString();

  await supabase.from('auth_logs').insert({
    application_id: application.id,
    app_user_id: targetUser.id,
    event_type: 'impersonation_start',
    ip_address: ipAddress,
    user_agent: userAgent,
    success: true,
    metadata: {
      admin_id: adminUser.id,
      admin_email: adminUser.email,
      admin_name: adminUser.name,
      target_id: targetUser.id,
      target_email: targetUser.email,
      target_name: targetUser.name,
      reason: reason.trim(),
      session_id: sessionId,
      expires_at: expiresAt,
    },
  }).then(({ error }) => {
    if (error) console.error('Error logging impersonation_start:', error);
  });

  return jsonResponse({
    success: true,
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: IMPERSONATION_ACCESS_TTL_SECONDS,
      impersonation: {
        session_id: sessionId,
        reason: reason.trim(),
        started_at: startedAt,
        expires_at: expiresAt,
        admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
        target: { id: targetUser.id, email: targetUser.email, name: targetUser.name, tenant_id: targetUser.tenant_id || null },
      },
    },
  });
});
