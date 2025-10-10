import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeployRequest {
  siteId: string;
  accessToken: string;
  projectFiles: Record<string, string>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { siteId, accessToken, projectFiles }: DeployRequest = await req.json();

    if (!siteId || !accessToken) {
      throw new Error("Missing siteId or accessToken");
    }

    const files: Record<string, string> = {};
    const fileContents: Record<string, string> = {};

    for (const [path, content] of Object.entries(projectFiles)) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      files[path] = hashHex;
      fileContents[path] = content;
    }

    const createDeployResponse = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          files,
          draft: false,
        }),
      }
    );

    if (!createDeployResponse.ok) {
      const error = await createDeployResponse.text();
      throw new Error(`Failed to create deploy: ${error}`);
    }

    const deploy = await createDeployResponse.json();

    const uploadPromises = [];
    for (const [path, sha] of Object.entries(files)) {
      if (deploy.required && deploy.required.includes(sha)) {
        const uploadUrl = `${deploy.deploy_url}/files/${path}`;
        const content = fileContents[path];

        uploadPromises.push(
          fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream",
            },
            body: content,
          })
        );
      }
    }

    await Promise.all(uploadPromises);

    let deployStatus = deploy;
    let attempts = 0;
    const maxAttempts = 60;

    while (deployStatus.state !== 'ready' && deployStatus.state !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deploy.id}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      deployStatus = await statusResponse.json();
      attempts++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deploy: deployStatus,
        url: deployStatus.ssl_url || deployStatus.url,
        deployUrl: deployStatus.deploy_ssl_url || deployStatus.deploy_url,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Deploy error:", error);
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