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
    const { application_id, api_key, invited_by_email, invitation_id } = body ?? {};

    if (!application_id || !api_key || !invited_by_email || !invitation_id) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id, api_key, invited_by_email e invitation_id son requeridos" },
      }, 400);
    }

    const { data: app } = await supabase
      .from("applications")
      .select("id")
      .eq("application_id", application_id)
      .maybeSingle();
    if (!app) return jsonResponse({ success: false, error: { code: "APPLICATION_NOT_FOUND", message: "Aplicación no encontrada" } }, 404);

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id")
      .or(`key.eq.${api_key},key_hash.eq.${api_key}`)
      .eq("application_id", app.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!keyRow) return jsonResponse({ success: false, error: { code: "INVALID_API_KEY", message: "API Key inválida" } }, 401);

    const { data: inviter } = await supabase
      .from("app_users")
      .select("id, tenant_id")
      .eq("application_id", app.id)
      .eq("email", String(invited_by_email).toLowerCase())
      .eq("status", "active")
      .maybeSingle();
    if (!inviter?.tenant_id) {
      return jsonResponse({ success: false, error: { code: "INVITER_NOT_FOUND", message: "Usuario no encontrado" } }, 403);
    }

    const { data: invitation } = await supabase
      .from("tenant_invitations")
      .select("id, status, tenant_id")
      .eq("id", invitation_id)
      .eq("application_id", app.id)
      .maybeSingle();

    if (!invitation || invitation.tenant_id !== inviter.tenant_id) {
      return jsonResponse({ success: false, error: { code: "INVITATION_NOT_FOUND", message: "Invitación no encontrada" } }, 404);
    }

    if (invitation.status !== "pending") {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_STATE", message: `No se puede revocar una invitación en estado ${invitation.status}` },
      }, 409);
    }

    const { error: updErr } = await supabase
      .from("tenant_invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", invitation_id);
    if (updErr) throw updErr;

    return jsonResponse({ success: true, data: { invitation_id, status: "revoked" } });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
