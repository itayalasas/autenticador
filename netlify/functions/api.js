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

    // Application plans endpoint - Proxy to Edge Function
    if (path.endsWith('/application/plans') && (method === 'GET' || method === 'POST')) {
      console.log(`📦 Application plans endpoint called (${method}) - proxying to Edge Function`);

      let requestBody = {};
      try {
        requestBody = method === 'GET'
          ? (event.queryStringParameters || {})
          : (event.body ? JSON.parse(event.body) : {});
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
        const result = await callEdgeFunction('application-plans', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying application plans request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to plans service: ' + error.message
            }
          })
        };
      }
    }

    // Managed subscription checkout start - Proxy to Edge Function
    if (path.endsWith('/application/subscription/start-checkout') && method === 'POST') {
      console.log('💳 Subscription checkout start endpoint called - proxying to Edge Function');

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
        const result = await callEdgeFunction('subscription-start-checkout', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying subscription checkout start request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to subscription checkout service: ' + error.message
            }
          })
        };
      }
    }

    // Managed subscription checkout session - Proxy to Edge Function
    if (path.endsWith('/application/subscription/session') && (method === 'GET' || method === 'POST')) {
      console.log(`🧾 Subscription checkout session endpoint called (${method}) - proxying to Edge Function`);

      let requestBody = {};
      try {
        requestBody = method === 'GET'
          ? (event.queryStringParameters || {})
          : (event.body ? JSON.parse(event.body) : {});
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
        const result = await callEdgeFunction('subscription-checkout-status', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying subscription checkout session request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to subscription checkout status service: ' + error.message
            }
          })
        };
      }
    }

    // Managed subscription cancel - Proxy to Edge Function
    if (path.endsWith('/application/subscription/cancel') && method === 'POST') {
      console.log('🛑 Subscription cancel endpoint called - proxying to Edge Function');

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
        const result = await callEdgeFunction('subscription-cancel', requestBody);

        return {
          statusCode: result.statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.body)
        };
      } catch (error) {
        console.error('❌ Error proxying subscription cancel request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to subscription cancellation service: ' + error.message
            }
          })
        };
      }
    }

    // Mercado Pago return endpoint - Proxy to Edge Function
    if (path.endsWith('/application/subscription/return') && (method === 'GET' || method === 'POST')) {
      console.log(`↩️ Mercado Pago return endpoint called (${method}) - proxying to Edge Function`);

      let requestBody = {};
      try {
        requestBody = method === 'GET'
          ? {}
          : (event.body ? JSON.parse(event.body) : {});
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
        const targetUrl = new URL(`${supabaseUrl}/functions/v1/mercadopago-return`);
        Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          targetUrl.searchParams.set(key, String(value));
        });

        const response = await fetch(targetUrl.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          body: method === 'GET' ? undefined : JSON.stringify(requestBody),
          redirect: 'manual'
        });

        const location = response.headers.get('location');
        if (location) {
          return {
            statusCode: response.status,
            headers: {
              ...corsHeaders,
              Location: location
            },
            body: ''
          };
        }

        const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
        const payload = await response.text();
        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': contentType },
          body: payload
        };
      } catch (error) {
        console.error('❌ Error proxying Mercado Pago return request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
          body: 'No se pudo procesar el retorno de Mercado Pago'
        };
      }
    }

    // Mercado Pago webhook endpoint - Proxy to Edge Function
    if (path.endsWith('/webhooks/mercadopago') && method === 'POST') {
      console.log('📬 Mercado Pago webhook endpoint called - proxying to Edge Function');

      let requestBody = {};
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
        const targetUrl = new URL(`${supabaseUrl}/functions/v1/mercadopago-webhook`);
        Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          targetUrl.searchParams.set(key, String(value));
        });

        const response = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'x-signature': event.headers?.['x-signature'] || event.headers?.['X-Signature'] || '',
            'x-request-id': event.headers?.['x-request-id'] || event.headers?.['X-Request-Id'] || '',
          },
          body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('❌ Error proxying Mercado Pago webhook request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to Mercado Pago webhook service: ' + error.message
            }
          })
        };
      }
    }

    // Application info endpoint - Proxy to Edge Function
    if (path.endsWith('/application/info') && method === 'GET') {
      console.log('📱 Application info endpoint called (GET) - proxying to Edge Function');

      try {
        const url = `${supabaseUrl}/functions/v1/application-info`;

        console.log(`🔄 Proxying GET to Edge Function: application-info`, { url });

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`
          }
        });

        const result = await response.json();

        console.log('📥 Edge Function response:', {
          status: response.status,
          success: result.success
        });

        return {
          statusCode: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('❌ Error proxying application info request:', error);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'PROXY_ERROR',
              message: 'Error connecting to application service: ' + error.message
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
