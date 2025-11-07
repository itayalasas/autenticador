import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface ExchangeRequest {
  code: string;
  application_id: string;
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
            message: 'Only POST method is allowed'
          }
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let requestBody;
    try {
      requestBody = await req.json();
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
      );
    }

    const { code, application_id }: ExchangeRequest = requestBody;

    if (!code || !application_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Code and application_id are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔍 Looking up auth code:', code);

    // Get the auth code
    const { data: authCode, error: codeError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (codeError || !authCode) {
      console.log('❌ Auth code not found:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid or expired authorization code'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if code has already been used
    if (authCode.used_at) {
      console.log('❌ Auth code already used:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CODE_ALREADY_USED',
            message: 'Authorization code has already been used'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if code has expired
    if (new Date(authCode.expires_at) < new Date()) {
      console.log('❌ Auth code expired:', code);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CODE_EXPIRED',
            message: 'Authorization code has expired'
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify application_id matches
    const { data: application } = await supabase
      .from('applications')
      .select('application_id')
      .eq('id', authCode.application_id)
      .single();

    if (!application || application.application_id !== application_id) {
      console.log('❌ Application ID mismatch');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'APPLICATION_MISMATCH',
            message: 'Application ID does not match'
          }
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Auth code valid, marking as used');

    // Mark code as used
    await supabase
      .from('auth_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code', code);

    // Decode the access token to get user info and other data
    let tokenData = null;
    try {
      const tokenParts = authCode.access_token.split('.');
      if (tokenParts.length === 3) {
        tokenData = JSON.parse(atob(tokenParts[1]));
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }

    // Get user info
    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, name, role_id, metadata, created_at')
      .eq('id', authCode.user_id)
      .single();

    // Get role name and permissions
    let roleName = 'user';
    let rolePermissions: { [menuSlug: string]: string[] } = {};

    if (user?.role_id) {
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

    const response = {
      success: true,
      data: {
        access_token: authCode.access_token,
        refresh_token: authCode.refresh_token,
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
          name: application.name
        }
      }
    };

    // Add validation data from token if available
    if (tokenData) {
      if (tokenData.tenant) response.data.tenant = tokenData.tenant;
      if (tokenData.subscription) response.data.subscription = tokenData.subscription;
      if (tokenData.license) response.data.license = tokenData.license;
      if (tokenData.has_access !== undefined) response.data.has_access = tokenData.has_access;
      if (tokenData.available_plans) response.data.available_plans = tokenData.available_plans;
    }

    console.log('✅ Code exchanged successfully');

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Exchange code error:', error);

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
    );
  }
});
