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

    let token: string | null = null;

    if (req.method === "GET") {
      token = new URL(req.url).searchParams.get("token");
    } else {
      const body = await req.json().catch(() => ({}));
      token = body.token ?? null;
    }

    if (!token) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "token es requerido" },
      }, 400);
    }

    const { data: invitation } = await supabase
      .from("tenant_invitations")
      .select(`
        id, email, status, expires_at, accepted_at, created_at, application_id,
        tenant:tenant_id(id, name, slug),
        role:role_id(id, name, display_name, description),
        inviter:invited_by_user_id(id, name, email)
      `)
      .eq("token", token)
      .maybeSingle();

    const { data: app } = invitation
      ? await supabase
          .from("applications")
          .select("id, application_id, name")
          .eq("id", invitation.application_id)
          .maybeSingle()
      : { data: null };

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
        application: app ? { id: app.application_id, name: app.name } : null,
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
