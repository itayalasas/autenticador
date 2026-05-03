import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let application_id: string | null = null;
    let api_key: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      application_id = url.searchParams.get("application_id");
      api_key = url.searchParams.get("api_key");
    } else {
      const body = await req.json().catch(() => ({}));
      application_id = body.application_id ?? null;
      api_key = body.api_key ?? null;
    }

    if (!application_id || !api_key) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id y api_key son requeridos" },
      }, 400);
    }

    const { data: app } = await supabase
      .from("applications")
      .select("id, application_id, name")
      .eq("application_id", application_id)
      .maybeSingle();

    if (!app) {
      return jsonResponse({
        success: false,
        error: { code: "APPLICATION_NOT_FOUND", message: "Aplicación no encontrada" },
      }, 404);
    }

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id, application_id, is_active")
      .or(`key.eq.${api_key},key_hash.eq.${api_key}`)
      .eq("application_id", app.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!keyRow) {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_API_KEY", message: "API Key inválida para esta aplicación" },
      }, 401);
    }

    const { data: roles, error: rolesErr } = await supabase
      .from("application_roles")
      .select("id, name, display_name, description, is_default, is_active, available_for_registration")
      .eq("application_id", app.id)
      .eq("is_active", true)
      .order("display_name", { ascending: true });

    if (rolesErr) {
      return jsonResponse({
        success: false,
        error: { code: "DB_ERROR", message: rolesErr.message },
      }, 500);
    }

    return jsonResponse({
      success: true,
      data: {
        application_id: app.application_id,
        application_name: app.name,
        roles: roles ?? [],
      },
    });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
