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

    const body = await req.json().catch(() => ({}));
    const { application_id, api_key, invited_by_email, status } = body ?? {};

    if (!application_id || !api_key || !invited_by_email) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id, api_key e invited_by_email son requeridos" },
      }, 400);
    }

    const { data: app } = await supabase
      .from("applications")
      .select("id, application_id, name")
      .eq("application_id", application_id)
      .maybeSingle();
    if (!app) {
      return jsonResponse({ success: false, error: { code: "APPLICATION_NOT_FOUND", message: "Aplicación no encontrada" } }, 404);
    }

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id")
      .or(`key.eq.${api_key},key_hash.eq.${api_key}`)
      .eq("application_id", app.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!keyRow) {
      return jsonResponse({ success: false, error: { code: "INVALID_API_KEY", message: "API Key inválida" } }, 401);
    }

    const { data: inviter } = await supabase
      .from("app_users")
      .select("id, tenant_id")
      .eq("application_id", app.id)
      .eq("email", String(invited_by_email).toLowerCase())
      .eq("status", "active")
      .maybeSingle();
    if (!inviter?.tenant_id) {
      return jsonResponse({ success: false, error: { code: "INVITER_NOT_FOUND", message: "Usuario invitador no encontrado" } }, 403);
    }

    let query = supabase
      .from("tenant_invitations")
      .select("id, email, status, expires_at, accepted_at, created_at, updated_at, role:role_id(id, name, display_name)")
      .eq("application_id", app.id)
      .eq("tenant_id", inviter.tenant_id)
      .order("created_at", { ascending: false });

    if (status && ["pending", "accepted", "revoked", "expired"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: invitations, error } = await query;
    if (error) {
      return jsonResponse({ success: false, error: { code: "DB_ERROR", message: error.message } }, 500);
    }

    const now = new Date();
    const result = (invitations ?? []).map((inv: any) => ({
      ...inv,
      status: inv.status === "pending" && new Date(inv.expires_at) < now ? "expired" : inv.status,
    }));

    return jsonResponse({ success: true, data: { invitations: result, tenant_id: inviter.tenant_id } });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
