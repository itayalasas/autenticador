const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.CONTEXT || 'unknown',
    node_version: process.version,
    checks: {}
  };

  // Check environment variables
  checks.checks.env_variables = {
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY
  };

  checks.checks.env_variables.status =
    checks.checks.env_variables.VITE_SUPABASE_URL &&
    checks.checks.env_variables.SUPABASE_SERVICE_ROLE_KEY
      ? 'ok'
      : 'error';

  // Check Supabase connection
  if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { data, error } = await supabase
        .from('applications')
        .select('id')
        .limit(1);

      checks.checks.database = {
        status: error ? 'error' : 'ok',
        error: error?.message || null,
        can_query: !error
      };
    } catch (dbError) {
      checks.checks.database = {
        status: 'error',
        error: dbError.message,
        can_query: false
      };
    }
  } else {
    checks.checks.database = {
      status: 'skipped',
      error: 'Missing environment variables',
      can_query: false
    };
  }

  // Overall status
  const allOk =
    checks.checks.env_variables.status === 'ok' &&
    checks.checks.database.status === 'ok';

  checks.status = allOk ? 'healthy' : 'unhealthy';
  checks.ready = allOk;

  return {
    statusCode: allOk ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(checks, null, 2)
  };
};
