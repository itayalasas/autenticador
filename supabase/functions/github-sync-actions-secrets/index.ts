import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import sodium from "npm:libsodium-wrappers@0.7.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncSecretsRequest {
  accessToken: string;
  repoFullName: string;
  secrets: Record<string, string>;
}

async function encryptSecret(value: string, publicKeyBase64: string): Promise<string> {
  await sodium.ready;
  const messageBytes = sodium.from_string(value);
  const keyBytes = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { accessToken, repoFullName, secrets }: SyncSecretsRequest = await req.json();

    if (!accessToken || !repoFullName || !secrets || Object.keys(secrets).length === 0) {
      throw new Error("Missing required parameters");
    }

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const publicKeyResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/actions/secrets/public-key`,
      { headers }
    );

    if (!publicKeyResponse.ok) {
      throw new Error(`Failed to get repository secrets public key: ${await publicKeyResponse.text()}`);
    }

    const publicKey = await publicKeyResponse.json();
    const updates: Array<{ name: string; success: boolean }> = [];

    for (const [name, rawValue] of Object.entries(secrets)) {
      const encryptedValue = await encryptSecret(rawValue, publicKey.key);
      const secretResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/actions/secrets/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            encrypted_value: encryptedValue,
            key_id: publicKey.key_id,
          }),
        }
      );

      if (!secretResponse.ok) {
        throw new Error(`Failed to sync secret ${name}: ${await secretResponse.text()}`);
      }

      updates.push({ name, success: true });
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("GitHub secrets sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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
