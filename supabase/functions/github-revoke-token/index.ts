import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Authorization header requerido" }, 401);
    }

    const jwt = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return jsonResponse({ success: false, error: "Token inválido o expirado" }, 401);
    }

    const { accessToken } = await req.json();
    if (!accessToken) {
      return jsonResponse({ success: false, error: "accessToken es requerido" }, 400);
    }

    const { data: configData, error: configError } = await supabase
      .from("connectors_config")
      .select("config_data")
      .eq("connector_type", "github")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !configData?.config_data?.client_id || !configData?.config_data?.client_secret) {
      return jsonResponse({ success: false, error: "GitHub OAuth no está configurado correctamente" }, 400);
    }

    const clientId = configData.config_data.client_id;
    const clientSecret = configData.config_data.client_secret;
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const revokeResponse = await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Basic ${basicAuth}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
      }),
    });

    if (!(revokeResponse.status === 204 || revokeResponse.status === 404)) {
      return jsonResponse({
        success: false,
        error: `No se pudo revocar el token en GitHub: ${await revokeResponse.text()}`,
      }, 400);
    }

    return jsonResponse({
      success: true,
      message: revokeResponse.status === 204
        ? "Token revocado correctamente en GitHub"
        : "El token ya no existía en GitHub",
    });
  } catch (error: any) {
    console.error("github-revoke-token error:", error);
    return jsonResponse({
      success: false,
      error: error?.message || "Error interno del servidor",
    }, 500);
  }
});
