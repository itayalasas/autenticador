import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXTERNAL_EMAIL_API_URL = "https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email";
const EXTERNAL_EMAIL_API_KEY = "sk_4b762d5e0cbf7382c81daf86487cef7baf6581168b2c224592f9b125679b654e";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateAppAndKey(supabase: any, application_id: string, api_key: string) {
  const { data: app } = await supabase
    .from("applications")
    .select("id, application_id, name")
    .eq("application_id", application_id)
    .maybeSingle();
  if (!app) return { error: { code: "APPLICATION_NOT_FOUND", message: "Aplicación no encontrada" }, status: 404 };

  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, is_active")
    .or(`key.eq.${api_key},key_hash.eq.${api_key}`)
    .eq("application_id", app.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!keyRow) return { error: { code: "INVALID_API_KEY", message: "API Key inválida" }, status: 401 };

  return { app };
}

async function resolveInviter(supabase: any, appId: string, invited_by_email: string) {
  const { data: user } = await supabase
    .from("app_users")
    .select("id, email, name, tenant_id, role_id, status")
    .eq("application_id", appId)
    .eq("email", invited_by_email.toLowerCase())
    .eq("status", "active")
    .maybeSingle();
  return user;
}

async function resolveAuthBaseUrl(supabase: any, appId: string, override?: string) {
  if (override) return override.replace(/\/$/, "");
  const { data } = await supabase
    .from("environments")
    .select("auth_url")
    .eq("application_id", appId)
    .eq("is_active", true)
    .not("auth_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data?.auth_url) return data.auth_url.replace(/\/$/, "");
  return null;
}

async function sendInvitationEmail(params: {
  recipientEmail: string;
  inviteeName?: string;
  roleName: string;
  tenantId: string;
  invitationId: string;
  confirmUrl: string;
  expiresAt: string;
}) {
  const payload = {
    template_name: "invitacion_usuario",
    recipient_email: params.recipientEmail,
    data: {
      invitation_id: params.invitationId,
      user_name: params.inviteeName || params.recipientEmail,
      role_name: params.roleName,
      tenant_id: params.tenantId,
      expires_at: params.expiresAt,
      confirm_url: params.confirmUrl,
    },
  };

  const res = await fetch(EXTERNAL_EMAIL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": EXTERNAL_EMAIL_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Email API error ${res.status}`);
  }
  return json;
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
    const {
      application_id,
      api_key,
      invited_by_email,
      email,
      role_id,
      name,
      redirect_url,
      metadata,
    } = body ?? {};

    if (!application_id || !api_key || !invited_by_email || !email || !role_id) {
      return jsonResponse({
        success: false,
        error: { code: "MISSING_PARAMS", message: "application_id, api_key, invited_by_email, email y role_id son requeridos" },
      }, 400);
    }

    const check = await validateAppAndKey(supabase, application_id, api_key);
    if (check.error) return jsonResponse({ success: false, error: check.error }, check.status);
    const app = check.app!;

    const inviter = await resolveInviter(supabase, app.id, invited_by_email);
    if (!inviter || !inviter.tenant_id) {
      return jsonResponse({
        success: false,
        error: { code: "INVITER_NOT_FOUND", message: "El usuario que invita no existe o no tiene tenant asignado" },
      }, 403);
    }

    const { data: role } = await supabase
      .from("application_roles")
      .select("id, name, display_name, is_active")
      .eq("id", role_id)
      .eq("application_id", app.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!role) {
      return jsonResponse({
        success: false,
        error: { code: "ROLE_NOT_FOUND", message: "Rol no encontrado para esta aplicación" },
      }, 404);
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: existingUser } = await supabase
      .from("app_users")
      .select("id, tenant_id")
      .eq("application_id", app.id)
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existingUser && existingUser.tenant_id === inviter.tenant_id) {
      return jsonResponse({
        success: false,
        error: { code: "USER_ALREADY_EXISTS", message: "El usuario ya pertenece a este tenant" },
      }, 409);
    }

    const { data: existingPending } = await supabase
      .from("tenant_invitations")
      .select("id, token, expires_at")
      .eq("application_id", app.id)
      .eq("tenant_id", inviter.tenant_id)
      .ilike("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    const baseUrl = await resolveAuthBaseUrl(supabase, app.id, redirect_url);
    if (!baseUrl) {
      return jsonResponse({
        success: false,
        error: { code: "NO_AUTH_URL", message: "No se pudo determinar auth_url para la aplicación. Configure environments.auth_url o envíe redirect_url" },
      }, 400);
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let invitationId: string;
    let resent = false;

    if (existingPending) {
      resent = true;
      const { data: updated, error: updErr } = await supabase
        .from("tenant_invitations")
        .update({
          token,
          role_id: role.id,
          expires_at: expiresAt,
          invited_by_user_id: inviter.id,
          redirect_url: redirect_url ?? null,
          metadata: metadata ?? {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPending.id)
        .select("id")
        .single();
      if (updErr) throw updErr;
      invitationId = updated.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("tenant_invitations")
        .insert({
          application_id: app.id,
          tenant_id: inviter.tenant_id,
          email: normalizedEmail,
          role_id: role.id,
          invited_by_user_id: inviter.id,
          token,
          status: "pending",
          expires_at: expiresAt,
          redirect_url: redirect_url ?? null,
          metadata: metadata ?? {},
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      invitationId = inserted.id;
    }

    const acceptUrl = `${baseUrl}/accept-invitation?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    const emailSubject = `Invitación a ${app.name}`;
    const emailHtml = `<p>Has sido invitado a ${app.name} con el rol ${role.display_name || role.name}.</p><p><a href="${acceptUrl}">Aceptar invitación</a></p>`;

    let emailStatus: "sent" | "failed" = "sent";
    let emailError: string | null = null;
    try {
      await sendInvitationEmail({
        recipientEmail: normalizedEmail,
        inviteeName: name,
        roleName: role.display_name || role.name,
        tenantId: inviter.tenant_id,
        invitationId,
        confirmUrl: acceptUrl,
        expiresAt,
      });
    } catch (emailErr: any) {
      emailStatus = "failed";
      emailError = emailErr?.message ?? "unknown";
    }

    const { error: logErr } = await supabase.from("email_logs").insert({
      application_id: app.id,
      to_email: normalizedEmail,
      from_email: "noreply@invite.app",
      from_name: app.name,
      subject: emailSubject,
      html_content: emailHtml,
      status: emailStatus,
      error_message: emailError,
      sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
    });
    if (logErr) console.error("email_logs insert error:", logErr.message);

    return jsonResponse({
      success: true,
      data: {
        invitation_id: invitationId,
        email: normalizedEmail,
        role: { id: role.id, name: role.display_name || role.name },
        tenant_id: inviter.tenant_id,
        expires_at: expiresAt,
        accept_url: acceptUrl,
        resent,
      },
    });
  } catch (err: any) {
    return jsonResponse({
      success: false,
      error: { code: "UNEXPECTED_ERROR", message: err?.message ?? "Unexpected error" },
    }, 500);
  }
});
