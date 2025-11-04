import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
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

    // Validate API Key from header
    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key is required. Please provide X-API-Key header",
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

    // Validate the API key
    const { data: keyData, error: keyError } = await supabase
      .from("external_api_keys")
      .select("id, name, is_active, allowed_endpoints, rate_limit, expires_at")
      .eq("key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or inactive API Key",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if key is expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key has expired",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if endpoint is allowed
    const allowedEndpoints = keyData.allowed_endpoints as string[];
    if (!allowedEndpoints.includes("*") && !allowedEndpoints.includes("application-info")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key does not have permission for this endpoint",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Update last_used_at timestamp (async, don't wait for response)
    supabase
      .from("external_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyData.id)
      .then();

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
        users_count,
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

    // Get users for all applications
    const { data: appUsers, error: usersError } = await supabase
      .from("app_users")
      .select(`
        id,
        application_id,
        email,
        name,
        status,
        last_login,
        created_at
      `)
      .in("application_id", applications?.map((app: any) => app.id) || []);

    if (usersError) {
      console.error("Error fetching app users:", usersError);
    }

    // Group users by application_id
    const usersByApp = (appUsers || []).reduce((acc: any, user: any) => {
      if (!acc[user.application_id]) {
        acc[user.application_id] = [];
      }
      acc[user.application_id].push({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        last_login: user.last_login,
        created_at: user.created_at,
      });
      return acc;
    }, {});

    const responseData = applications.map((app: any) => {
      const metadata = app.metadata as any;
      const environmentUrls = metadata?.environment_urls || {};
      const appUsersList = usersByApp[app.id] || [];

      return {
        id: app.id,
        name: app.name,
        application_id: app.application_id,
        status: app.status,
        url: app.domain,
        users_count: app.users_count || 0,
        environment_urls: {
          development: environmentUrls.development?.base_url || null,
          testing: environmentUrls.testing?.base_url || null,
          production: environmentUrls.production?.base_url || null,
        },
        users: appUsersList,
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