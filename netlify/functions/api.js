const { createClient } = require('@supabase/supabase-js');

// CORS headers - Must allow all necessary headers from clients
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

// Initialize Supabase client
let supabase;
let supabaseUrl;
let supabaseAnonKey;

try {
  supabaseUrl = process.env.VITE_SUPABASE_URL;
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔧 Netlify Function - Environment check:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    nodeEnv: process.env.NODE_ENV,
    netlifyContext: process.env.CONTEXT
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
  } else {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized for Netlify');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase:', error.message);
}

// Helper function to call Supabase Edge Functions
const callEdgeFunction = async (functionName, body, headers = {}) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key not configured');
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  console.log(`🔄 Proxying to Edge Function: ${functionName}`, {
    url,
    hasBody: !!body
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        ...headers
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    console.log(`📥 Edge Function response:`, {
      status: response.status,
      success: result.success
    });

    return {
      statusCode: response.status,
      body: result
    };
  } catch (error) {
    console.error(`❌ Error calling Edge Function ${functionName}:`, error);
    throw error;
  }
};

// Main Netlify function handler
exports.handler = async (event, context) => {
  console.log('📥 Netlify Function Called:', {
    httpMethod: event.httpMethod,
    path: event.path,
    hasBody: !!event.body,
    queryParams: event.queryStringParameters,
    headers: Object.keys(event.headers || {})
  });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Check Supabase connection
    if (!supabase) {
      console.error('❌ Supabase not initialized - check environment variables');
      console.log('📥 Edge Function response:', {
        statusCode: result.statusCode,
        success: result.body?.success,
        error: result.body?.error
      });
      
      console.log('📥 Edge Function response:', {
        statusCode: result.statusCode,
        success: result.body?.success,
        error: result.body?.error
      });
      
      console.log('📥 Edge Function response:', {
        statusCode: result.statusCode,
        success: result.body?.success,
        error: result.body?.error
      });
      
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database connection not available. Check environment variables.'
          }
        })
      };
    }

    const path = event.path;
    const method = event.httpMethod;

    console.log(`🔍 Processing: ${method} ${path}`);

    // Health check endpoint
    if (path.endsWith('/health') && method === 'GET') {
      console.log('🏥 Health check endpoint');

      // Test Supabase connection
      try {
        const { data, error } = await supabase
          .from('applications')
          .select('id')
          .limit(1);

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: 'AuthSystem API is running on Netlify (Proxy Mode)',
            timestamp: new Date().toISOString(),
            environment: 'netlify',
            mode: 'proxy',
            database_status: error ? 'error' : 'connected',
            database_error: error?.message || null,
            edge_functions_url: supabaseUrl ? `${supabaseUrl}/functions/v1` : 'not configured'
          })
        };
      } catch (healthError) {
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'HEALTH_CHECK_FAILED',
              message: 'Database health check failed: ' + healthError.message
            }
          })
        };
      }
    }

    // Login endpoint - Proxy to Edge Function
    if (path.endsWith('/auth/login') && method === 'POST') {
      console.log('🔐 Login endpoint called - proxying to Edge Function');

      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        console.error('❌ Invalid JSON in request body:', parseError);
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      try {
        const result = await callEdgeFunction('auth-login', requestBody);
        
        console.log('📥 Edge Function response:', {
          statusCode: result.statusCode,
          success: result.body?.success,
          error: result.body?.error
        });

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying login request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to authentication service: ' + error.message
            }
          })
        };
      }
    }

    // Register endpoint - Proxy to Edge Function
    if (path.endsWith('/auth/register') && method === 'POST') {
      console.log('📝 Register endpoint called - proxying to Edge Function');

      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      try {
        const result = await callEdgeFunction('auth-register', requestBody);
        
        console.log('📥 Edge Function response:', {
          statusCode: result.statusCode,
          success: result.body?.success,
          error: result.body?.error
        });

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying register request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to authentication service: ' + error.message
            }
          })
        };
      }
    }

    // Reset password endpoint - Proxy to Edge Function
    if (path.endsWith('/auth/reset-password') && method === 'POST') {
      console.log('🔄 Reset password endpoint called - proxying to Edge Function');

      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON'
            }
          })
        };
      }

      try {
        const result = await callEdgeFunction('auth-reset-password', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying reset password request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to authentication service: ' + error.message
            }
          })
        };
      }
    }

    // User search endpoint - Proxy to Edge Function
    if (path.endsWith('/user/search') && method === 'POST') {
      console.log('🔍 User search endpoint called - proxying to Edge Function');

      let requestBody;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Invalid JSON in request body'
          })
        };
      }

      try {
        const result = await callEdgeFunction('user-search', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying user search request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Error connecting to search service: ' + error.message
          })
        };
      }
    }

    // 404 for unknown routes
    console.log('❌ Route not found:', method, path);
    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint no encontrado: ${method} ${path}`
        }
      })
    };

  } catch (error) {
    console.error('❌ Netlify function error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor: ' + error.message
        }
      })
    };
  }
};
