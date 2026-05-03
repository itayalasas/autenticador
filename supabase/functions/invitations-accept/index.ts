import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";
import bcrypt from "npm:bcryptjs@2.4.3";

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
    const { application_id, api_key, token, name, password } = body ?? {};

    if (!application_id || !api_key || !token || !name || !password) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id, api_key, token, name y password son requeridos" },
      }, 400);
    }

    if (String(password).length < 8) {
      return jsonResponse({
        success: false,
        error: { code: "WEAK_PASSWORD", message: "La contraseña debe tener al menos 8 caracteres" },
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
      .select("id, email, status, expires_at, tenant_id, role_id")
      .eq("application_id", app.id)
      .eq("token", token)
      .maybeSingle();

    if (!invitation) {
      return jsonResponse({ success: false, error: { code: "INVITATION_NOT_FOUND", message: "Invitación no encontrada" } }, 404);
    }

    if (invitation.status !== "pending") {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_STATE", message: `La invitación está en estado ${invitation.status}` },
      }, 409);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from("tenant_invitations").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", invitation.id);
      return jsonResponse({ success: false, error: { code: "EXPIRED", message: "La invitación ha expirado" } }, 410);
    }

    const { data: existingUser } = await supabase
      .from("app_users")
      .select("id, tenant_id")
      .eq("application_id", app.id)
      .eq("email", invitation.email)
      .maybeSingle();

    if (existingUser && existingUser.tenant_id === invitation.tenant_id) {
      return jsonResponse({
        success: false,
        error: { code: "USER_ALREADY_EXISTS", message: "El usuario ya pertenece a este tenant" },
      }, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error: insErr } = await supabase
      .from("app_users")
      .insert({
        application_id: app.id,
        tenant_id: invitation.tenant_id,
        role_id: invitation.role_id,
        email: invitation.email,
        name,
        password_hash: passwordHash,
        status: "active",
        metadata: { invited: true, invitation_id: invitation.id },
      })
      .select("id")
      .single();

    if (insErr) {
      return jsonResponse({
        success: false,
        error: { code: "USER_CREATE_ERROR", message: insErr.message },
      }, 500);
    }

    await supabase
      .from("tenant_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: newUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    const { data: publicKey } = await supabase
      .from("api_keys")
      .select("key")
      .eq("application_id", app.id)
      .eq("is_public", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return jsonResponse({
      success: true,
      data: {
        user_id: newUser.id,
        email: invitation.email,
        name,
        application_id: app.application_id,
        api_key: publicKey?.key ?? null,
      },
    });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
