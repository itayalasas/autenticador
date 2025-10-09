import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const results: any[] = [];

    const test1ApiKey = Deno.env.get('DLOCAL_API_KEY');
    const test1SecretKey = Deno.env.get('DLOCAL_SECRET_KEY');

    if (test1ApiKey && test1SecretKey) {
      console.log('\ud83e\uddea Test 1: Using DLOCAL_* variables');
      console.log('API Key:', test1ApiKey.substring(0, 8) + '...' + test1ApiKey.substring(test1ApiKey.length - 4));
      console.log('Secret Key:', test1SecretKey.substring(0, 8) + '...' + test1SecretKey.substring(test1SecretKey.length - 4));

      try {
        const response = await fetch('https://api-sbx.dlocalgo.com/v1/subscription/plan/all', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${test1ApiKey}`,
            'X-API-Secret': test1SecretKey,
            'Content-Type': 'application/json'
          }
        });

        results.push({
          test: 'DLOCAL_* variables',
          status: response.status,
          success: response.ok,
          response: response.ok ? 'SUCCESS' : await response.text()
        });
      } catch (error: any) {
        results.push({
          test: 'DLOCAL_* variables',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        test: 'DLOCAL_* variables',
        success: false,
        error: 'Variables not set'
      });
    }

    const test2ApiKey = Deno.env.get('VITE_DLOCAL_API_KEY');
    const test2SecretKey = Deno.env.get('VITE_DLOCAL_SECRET_KEY');

    if (test2ApiKey && test2SecretKey) {
      console.log('\ud83e\uddea Test 2: Using VITE_DLOCAL_* variables');
      console.log('API Key:', test2ApiKey.substring(0, 8) + '...' + test2ApiKey.substring(test2ApiKey.length - 4));
      console.log('Secret Key:', test2SecretKey.substring(0, 8) + '...' + test2SecretKey.substring(test2SecretKey.length - 4));

      try {
        const response = await fetch('https://api-sbx.dlocalgo.com/v1/subscription/plan/all', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${test2ApiKey}`,
            'X-API-Secret': test2SecretKey,
            'Content-Type': 'application/json'
          }
        });

        results.push({
          test: 'VITE_DLOCAL_* variables',
          status: response.status,
          success: response.ok,
          response: response.ok ? 'SUCCESS' : await response.text()
        });
      } catch (error: any) {
        results.push({
          test: 'VITE_DLOCAL_* variables',
          success: false,
          error: error.message
        });
      }
    } else {
      results.push({
        test: 'VITE_DLOCAL_* variables',
        success: false,
        error: 'Variables not set'
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication tests completed',
        results,
        env_check: {
          'DLOCAL_API_KEY': test1ApiKey ? `SET (${test1ApiKey.length} chars)` : 'NOT SET',
          'DLOCAL_SECRET_KEY': test1SecretKey ? `SET (${test1SecretKey.length} chars)` : 'NOT SET',
          'VITE_DLOCAL_API_KEY': test2ApiKey ? `SET (${test2ApiKey.length} chars)` : 'NOT SET',
          'VITE_DLOCAL_SECRET_KEY': test2SecretKey ? `SET (${test2SecretKey.length} chars)` : 'NOT SET',
        }
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('\u274c Test error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});