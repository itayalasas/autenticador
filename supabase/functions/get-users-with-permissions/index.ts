import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

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
    const application_id = url.searchParams.get('application_id');

    if (!application_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'application_id is required as query parameter'
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
        application_roles!inner (
          id,
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

    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        role_id,
        menu_id,
        action_id,
        granted,
        menus!role_permissions_menu_id_fkey (
          id,
          name,
          label
        ),
        actions!role_permissions_action_id_fkey (
          id,
          name,
          label
        )
      `)
      .in('role_id', users?.map(u => u.role_id).filter(Boolean) || []);

    const permissionsMap = new Map();
    if (rolePermissions && !permError) {
      rolePermissions.forEach((perm: any) => {
        if (!permissionsMap.has(perm.role_id)) {
          permissionsMap.set(perm.role_id, {});
        }
        const rolePerms = permissionsMap.get(perm.role_id);
        const menuName = perm.menus?.name || perm.menu_id;
        const actionName = perm.actions?.name || perm.action_id;

        if (!rolePerms[menuName]) {
          rolePerms[menuName] = {};
        }
        rolePerms[menuName][actionName] = perm.granted;
      });
    }

    const formattedUsers = (users || []).map(user => {
      const role = Array.isArray(user.application_roles)
        ? user.application_roles[0]
        : user.application_roles;

      const rolePermissions = user.role_id ? permissionsMap.get(user.role_id) || {} : {};

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: role?.display_name || role?.name || null,
        permissions: role?.permissions || rolePermissions,
        metadata: user.metadata || {},
        created_at: user.created_at
      };
    });

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