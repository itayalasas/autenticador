import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveRoleAccess } from '../_shared/role-access.ts';
import { resolveApplicationJwtSecret, verifyAuthToken } from '../_shared/auth-jwt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface VerifyTokenRequest {
  token: string;
  application_id: string;
  api_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST method is allowed',
          },
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let requestBody: VerifyTokenRequest;
    try {
      requestBody = await req.json();
    } catch (_error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const bearerApiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const headerApiKey = req.headers.get('apikey')?.trim();
    const apiKey = requestBody.api_key?.trim() || bearerApiKey || headerApiKey || '';
    const { token, application_id } = requestBody;

    if (!token || !application_id || !apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'token, application_id y api_key son requeridos',
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API key inválida o inactiva',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, domain, jwt_secret')
      .eq('application_id', application_id)
      .maybeSingle();

    if (applicationError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_NOT_FOUND',
            message: 'Aplicación no encontrada',
          },
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (apiKeyData.application_id !== application.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_MISMATCH',
            message: 'La API key no pertenece a la aplicación solicitada',
          },
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const jwtSecret = await resolveApplicationJwtSecret(supabase, application.id, application.jwt_secret);
    let claims: Record<string, any>;

    try {
      claims = await verifyAuthToken(token, jwtSecret) as Record<string, any>;
    } catch (error) {
      console.error('Token verification failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token inválido o con firma no válida',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (claims.app_id !== application_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOKEN_APPLICATION_MISMATCH',
            message: 'El token no pertenece a la aplicación solicitada',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (claims.type && claims.type !== 'access') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Se esperaba un access token',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('id, email, name, role_id, metadata, created_at, status')
      .eq('id', claims.sub)
      .eq('application_id', application.id)
      .maybeSingle();

    if (userError || !user || user.status !== 'active') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado o inactivo',
          },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let roleName = typeof claims.role === 'string' ? claims.role : 'user';
    let rolePermissions: Record<string, string[]> =
      claims.permissions && typeof claims.permissions === 'object' && !Array.isArray(claims.permissions)
        ? claims.permissions
        : {};
    let rolePermissionsHierarchy: Record<string, any> =
      claims.permissions_hierarchy && typeof claims.permissions_hierarchy === 'object' && !Array.isArray(claims.permissions_hierarchy)
        ? claims.permissions_hierarchy
        : {};

    if (user.role_id && (!roleName || Object.keys(rolePermissions).length === 0 || Object.keys(rolePermissionsHierarchy).length === 0)) {
      const resolvedRoleAccess = await resolveRoleAccess(supabase, user.role_id);
      roleName = resolvedRoleAccess.roleName;
      rolePermissions = resolvedRoleAccess.rolePermissions;
      rolePermissionsHierarchy = resolvedRoleAccess.rolePermissionsHierarchy;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          valid: true,
          token_type: claims.type || 'access',
          expires_at: typeof claims.exp === 'number' ? new Date(claims.exp * 1000).toISOString() : null,
          claims,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: roleName,
            permissions: rolePermissions,
            permissions_hierarchy: rolePermissionsHierarchy,
            metadata: user.metadata || {},
            created_at: user.created_at,
          },
          application: {
            id: application.application_id,
            name: application.name,
            domain: application.domain || '',
          },
          environment: claims.environment || null,
          tenant: claims.tenant || null,
          subscription: claims.subscription || null,
          license: claims.license || null,
          has_access: claims.has_access ?? null,
          available_plans: claims.available_plans || [],
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Verify token error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
