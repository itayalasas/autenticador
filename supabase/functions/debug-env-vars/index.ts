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
    const envVars = {
      DLOCAL_API_KEY: Deno.env.get('DLOCAL_API_KEY') ? 'SET (length: ' + Deno.env.get('DLOCAL_API_KEY')!.length + ')' : 'NOT SET',
      DLOCAL_SECRET_KEY: Deno.env.get('DLOCAL_SECRET_KEY') ? 'SET (length: ' + Deno.env.get('DLOCAL_SECRET_KEY')!.length + ')' : 'NOT SET',
      DLOCAL_API_URL: Deno.env.get('DLOCAL_API_URL') ? 'SET (' + Deno.env.get('DLOCAL_API_URL') + ')' : 'NOT SET',
      VITE_DLOCAL_API_KEY: Deno.env.get('VITE_DLOCAL_API_KEY') ? 'SET (length: ' + Deno.env.get('VITE_DLOCAL_API_KEY')!.length + ')' : 'NOT SET',
      VITE_DLOCAL_SECRET_KEY: Deno.env.get('VITE_DLOCAL_SECRET_KEY') ? 'SET (length: ' + Deno.env.get('VITE_DLOCAL_SECRET_KEY')!.length + ')' : 'NOT SET',
      VITE_DLOCAL_API_URL: Deno.env.get('VITE_DLOCAL_API_URL') ? 'SET (' + Deno.env.get('VITE_DLOCAL_API_URL') + ')' : 'NOT SET',
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'SET' : 'NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SET' : 'NOT SET',
    };

    console.log('Environment Variables Check:', envVars);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Environment variables check',
        env_vars: envVars,
        note: 'VITE_ prefixed variables are NOT available in Edge Functions. You must configure secrets in Supabase Dashboard.'
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
