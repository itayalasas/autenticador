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
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      application_id = url.searchParams.get("application_id");
      api_key = url.searchParams.get("api_key");
      token = url.searchParams.get("token");
    } else {
      const body = await req.json().catch(() => ({}));
      application_id = body.application_id ?? null;
      api_key = body.api_key ?? null;
      token = body.token ?? null;
    }

    if (!application_id || !api_key || !token) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id, api_key y token son requeridos" },
      }, 400);
    }

    const { data: app } = await supabase
      .from("applications")
      .select("id, application_id, name")
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

    const { data: invitation } = await supabase
      .from("tenant_invitations")
      .select(`
        id, email, status, expires_at, accepted_at, created_at,
        tenant:tenant_id(id, name, slug),
        role:role_id(id, name, display_name, description),
        inviter:invited_by_user_id(id, name, email)
      `)
      .eq("application_id", app.id)
      .eq("token", token)
      .maybeSingle();

    if (!invitation) {
      return jsonResponse({ success: false, error: { code: "INVITATION_NOT_FOUND", message: "Invitación no encontrada" } }, 404);
    }

    const now = new Date();
    let effectiveStatus = invitation.status;
    if (effectiveStatus === "pending" && new Date(invitation.expires_at) < now) {
      effectiveStatus = "expired";
    }

    if (effectiveStatus !== "pending") {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_STATE", message: `La invitación está en estado ${effectiveStatus}` },
        data: { status: effectiveStatus },
      }, 409);
    }

    return jsonResponse({
      success: true,
      data: {
        email: invitation.email,
        status: effectiveStatus,
        expires_at: invitation.expires_at,
        application: { id: app.application_id, name: app.name },
        tenant: invitation.tenant,
        role: invitation.role,
        inviter: invitation.inviter,
      },
    });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
