import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { resolveRoleAccess } from '../_shared/role-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const application_id = pathParts[pathParts.length - 1];

    if (!application_id || application_id === 'get-users-with-permissions') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'application_id is required in the URL path'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: applicationData, error: appError } = await supabase
      .from('applications')
      .select('id, name, application_id')
      .eq('application_id', application_id)
      .maybeSingle();

    if (appError || !applicationData) {
      console.error('Application validation error:', appError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid application_id'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: users, error: usersError } = await supabase
      .from('app_users')
      .select(`
        id,
        email,
        name,
        metadata,
        created_at,
        role_id,
        application_roles (
          id,
          application_id,
          name,
          display_name,
          permissions
        )
      `)
      .eq('application_id', applicationData.id)
      .order('name', { ascending: true });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching users',
          details: usersError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const formattedUsers = await Promise.all((users || []).map(async (user) => {
      const role = Array.isArray(user.application_roles)
        ? user.application_roles[0]
        : user.application_roles;

      let resolvedPermissions: Record<string, string[]> | string[] = [];
      let resolvedPermissionsHierarchy: Record<string, any> = {};
      let resolvedRoleName = role?.display_name || role?.name || null;
      let roleApplicationId = role?.application_id || null;

      if (user.role_id) {
        const resolvedRoleAccess = await resolveRoleAccess(supabase, user.role_id);
        resolvedPermissions = Object.keys(resolvedRoleAccess.rolePermissions || {}).length > 0
          ? resolvedRoleAccess.rolePermissions
          : (role?.permissions || []);
        resolvedPermissionsHierarchy = resolvedRoleAccess.rolePermissionsHierarchy || {};
        resolvedRoleName = role?.display_name || resolvedRoleAccess.roleName || role?.name || null;
      } else {
        resolvedPermissions = role?.permissions || [];
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role_id: user.role_id || null,
        role_application_id: roleApplicationId,
        role: resolvedRoleName,
        permissions: resolvedPermissions,
        permissions_hierarchy: resolvedPermissionsHierarchy,
        metadata: user.metadata || {},
        created_at: user.created_at
      };
    }));

    return new Response(
      JSON.stringify({
        success: true,
        users: formattedUsers
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in get-users-with-permissions function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
