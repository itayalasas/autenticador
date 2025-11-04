import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only GET method is allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active applications
    const { data: applications, error: appError } = await supabase
      .from("applications")
      .select(`
        id,
        name,
        application_id,
        domain,
        status,
        metadata,
        created_at,
        updated_at
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (appError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error fetching applications",
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

    const responseData = applications.map((app: any) => {
      const metadata = app.metadata as any;
      const environmentUrls = metadata?.environment_urls || {};

      return {
        id: app.id,
        name: app.name,
        application_id: app.application_id,
        status: app.status,
        url: app.domain,
        environment_urls: {
          development: environmentUrls.development?.base_url || null,
          testing: environmentUrls.testing?.base_url || null,
          production: environmentUrls.production?.base_url || null,
        },
        created_at: app.created_at,
        updated_at: app.updated_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          applications: responseData,
          total: responseData.length,
        },
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