import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SearchRequest {
  application_id: string;
  api_key: string;
  query?: string;
  role_id?: string;
  limit?: number;
  offset?: number;
}

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

    // Parse request body
    const body: SearchRequest = await req.json();
    const { application_id, api_key, query, role_id, limit = 20, offset = 0 } = body;

    // Validate required fields
    if (!application_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'application_id is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'api_key is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 1: Verify that the application exists and get its name
    const { data: applicationData, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('id', application_id)
      .maybeSingle();

    if (appError || !applicationData) {
      console.error('Application validation error:', appError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid application_id'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 2: Validate API key for this application using key_hash
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, application_id, is_active, environment, name')
      .eq('application_id', applicationData.id)
      .eq('key_hash', api_key)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      console.error('API key validation error:', apiKeyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key or application'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 3: Check if API key is active
    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API key is inactive'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build query - NOTE: Roles are not included because app_users doesn't have role_id FK yet
    let queryBuilder = supabase
      .from('app_users')
      .select(`
        id,
        user_id,
        email,
        full_name,
        is_active,
        created_at
      `, { count: 'exact' })
      .eq('application_id', application_id);

    // Apply search filter if query is provided (case-insensitive with ilike)
    if (query && query.trim() !== '') {
      const searchTerm = query.trim().toLowerCase();
      queryBuilder = queryBuilder.or(
        `full_name.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*`
      );
    }

    // Role filter is disabled until role_id FK is added to app_users
    // if (role_id) {
    //   queryBuilder = queryBuilder.eq('role_id', role_id);
    // }

    // Apply pagination and sorting
    queryBuilder = queryBuilder
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: users, error: usersError, count: totalCount } = await queryBuilder;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      console.error('Error details:', JSON.stringify(usersError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error searching users',
          details: usersError.message || 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Format response
    const formattedUsers = (users || []).map(user => ({
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: null, // Roles will be included once role_id FK is added
      is_active: user.is_active,
      created_at: user.created_at
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          users: formattedUsers,
          pagination: {
            total: totalCount || 0,
            limit: limit,
            offset: offset,
            has_more: (offset + limit) < (totalCount || 0)
          }
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in user-search function:', error);
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
