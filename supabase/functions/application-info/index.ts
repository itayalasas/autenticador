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