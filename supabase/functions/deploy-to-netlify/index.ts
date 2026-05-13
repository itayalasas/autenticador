import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeployRequest {
  siteId: string;
  accessToken: string;
  environmentId: string;
  environmentName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { siteId, accessToken, environmentId, environmentName }: DeployRequest = await req.json();

    if (!siteId || !accessToken || !environmentId) {
      throw new Error("Missing required parameters");
    }

    console.log('=� Starting deploy for environment:', environmentId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get environment data from database
    const { data: environment, error: envError } = await supabase
      .from('deployment_environments')
      .select('*, applications(*)')
      .eq('id', environmentId)
      .maybeSingle();

    if (envError || !environment) {
      throw new Error('Environment not found');
    }

    console.log(' Environment loaded:', environment.name);

    // Get API key for the application
    const { data: apiKeys } = await supabase
      .from('api_keys')
      .select('*')
      .eq('application_id', environment.application_id)
      .eq('environment', environmentName || 'production')
      .eq('is_active', true)
      .limit(1);

    const apiKey = apiKeys && apiKeys.length > 0 ? apiKeys[0].key : null;

    if (!apiKey) {
      throw new Error('No active API key found for this environment');
    }

    console.log(' API key found');

    // Get branding draft and prefer published environment snapshot when available
    const { data: branding } = await supabase
      .from('branding_configs')
      .select('*')
      .eq('application_id', environment.application_id)
      .maybeSingle();

    const publishedBranding = environment.metadata?.branding_snapshot || branding || {};

    console.log('=� Generating project files...');

    // Call collect-source-files-complete to generate project files
    const collectResponse = await fetch(`${supabaseUrl}/functions/v1/collect-source-files-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        applicationId: environment.applications.application_id,
        apiKey: apiKey,
        supabaseUrl: supabaseUrl,
        supabaseAnonKey: supabaseAnonKey,
        branding: publishedBranding,
        internalApplicationId: environment.application_id
      })
    });

    if (!collectResponse.ok) {
      throw new Error('Failed to generate project files');
    }

    const collectResult = await collectResponse.json();

    if (!collectResult.success || !collectResult.files) {
      throw new Error('Failed to collect source files');
    }

    const projectFiles = collectResult.files;
    console.log(` Generated ${Object.keys(projectFiles).length} files`);

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
