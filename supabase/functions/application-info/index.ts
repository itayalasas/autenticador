import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  api_key: string;
  application_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { api_key, application_id }: RequestBody = await req.json();

    if (!api_key || !application_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "api_key and application_id are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("id, application_id, is_active")
      .eq("key", api_key)
      .eq("application_id", application_id)
      .eq("is_active", true)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid API key or application",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: application, error: appError } = await supabase
      .from("applications")
      .select(`
        id,
        name,
        application_id,
        domain,
        status,
        metadata
      `)
      .eq("application_id", application_id)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Application not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const metadata = application.metadata as any;
    const environmentUrls = metadata?.environment_urls || {};

    const responseData = {
      id: application.id,
      name: application.name,
      application_id: application.application_id,
      status: application.status,
      url: application.domain,
      environment_urls: {
        development: environmentUrls.development?.base_url || null,
        testing: environmentUrls.testing?.base_url || null,
        production: environmentUrls.production?.base_url || null,
      },
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in application-info function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});