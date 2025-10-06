import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, accept, accept-language, content-language",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
  "Access-Control-Max-Age": "86400",
};

interface ResetPasswordConfirmRequest {
  token: string;
  email: string;
  new_password: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only POST method is allowed",
          },
        }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { token, email, new_password }: ResetPasswordConfirmRequest = requestBody;

    if (!token || !email || !new_password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "Token, email and new_password are required",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("🔍 Validating reset token for:", email);

    const { data: tokenData, error: tokenError } = await supabase
      .from("email_verification_tokens")
      .select(`
        *,
        app_users (
          id,
          email,
          application_id
        )
      `)
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log("❌ Token not found");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Token inválido o expirado",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("❌ Token expired");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "El token ha expirado. Por favor solicita uno nuevo.",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (tokenData.used_at) {
      console.log("❌ Token already used");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "TOKEN_USED",
            message: "Este token ya ha sido utilizado",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appUser = tokenData.app_users;
    if (!appUser || appUser.email !== email) {
      console.log("❌ Email mismatch");
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "EMAIL_MISMATCH",
            message: "El email no coincide con el token",
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get application password policies
    const { data: application } = await supabase
      .from("applications")
      .select("email_config")
      .eq("id", appUser.application_id)
      .maybeSingle();

    const emailConfig = application?.email_config || {};
    const passwordMinLength = emailConfig.password_min_length || 8;
    const requireUppercase = emailConfig.password_require_uppercase !== false;
    const requireLowercase = emailConfig.password_require_lowercase !== false;
    const requireNumbers = emailConfig.password_require_numbers !== false;
    const requireSymbols = emailConfig.password_require_symbols || false;

    console.log("🔒 Validating password against policies:", {
      minLength: passwordMinLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSymbols,
    });

    // Validate password against policies
    const validationErrors: string[] = [];

    if (new_password.length < passwordMinLength) {
      validationErrors.push(`La contraseña debe tener al menos ${passwordMinLength} caracteres`);
    }

    if (requireUppercase && !/[A-Z]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos una letra mayúscula");
    }

    if (requireLowercase && !/[a-z]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos una letra minúscula");
    }

    if (requireNumbers && !/[0-9]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos un número");
    }

    if (requireSymbols && !/[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password)) {
      validationErrors.push("La contraseña debe contener al menos un carácter especial");
    }

    if (validationErrors.length > 0) {
      console.log("❌ Password validation failed:", validationErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "PASSWORD_POLICY_VIOLATION",
            message: validationErrors.join(". "),
            validation_errors: validationErrors,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Password validation passed, updating password...");

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        password_hash: hashedPassword,
      })
      .eq("id", appUser.id);

    if (updateError) {
      console.error("❌ Error updating password:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "Error al actualizar la contraseña",
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: markUsedError } = await supabase
      .from("email_verification_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    if (markUsedError) {
      console.error("⚠️ Error marking token as used:", markUsedError);
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    await supabase.from("auth_logs").insert({
      application_id: appUser.application_id,
      app_user_id: appUser.id,
      event_type: "password_reset",
      ip_address: ipAddress,
      user_agent: req.headers.get("user-agent") || "unknown",
      success: true,
      metadata: {
        email: email,
        action: "password_changed",
      },
    });

    console.log("✅ Password reset successful for:", email);

    // Get application details for token generation
    const { data: application } = await supabase
      .from("applications")
      .select("application_id, name, domain")
      .eq("id", appUser.application_id)
      .maybeSingle();

    // Get user roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role_name, permissions")
      .eq("app_user_id", appUser.id);

    const roles = userRoles?.map((r) => r.role_name) || ["user"];
    const permissions = userRoles?.flatMap((r) => r.permissions) || ["read"];

    // Generate access and refresh tokens
    const now = Math.floor(Date.now() / 1000);
    const accessTokenPayload = {
      sub: appUser.id,
      email: appUser.email,
      name: appUser.name,
      app_id: application?.application_id,
      roles: roles,
      permissions: permissions,
      iat: now,
      exp: now + 24 * 60 * 60, // 24 hours
      iss: "AuthSystem",
      aud: application?.domain,
    };

    const accessToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(accessTokenPayload))}.signature`;
    const refreshToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ ...accessTokenPayload, type: "refresh", exp: now + 30 * 24 * 60 * 60 }))}.signature`;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: "Contraseña actualizada exitosamente",
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "Bearer",
          expires_in: 86400,
          user: {
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            roles: roles,
            permissions: permissions,
            metadata: appUser.metadata || {},
          },
          application: {
            id: application?.application_id,
            name: application?.name,
            domain: application?.domain,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reset password confirm error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Error interno del servidor",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
