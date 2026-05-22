import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CommitRequest {
  accessToken: string;
  repoFullName: string;
  files: Record<string, string>;
  commitMessage: string;
  branch?: string;
  applicationId?: string;
  deploymentUrl?: string;
}

function buildHelpfulGitHubError(rawMessage: string, files: Record<string, string>) {
  const includesWorkflowFiles = Object.keys(files).some((path) => path.startsWith('.github/workflows/'));
  const mentionsNotFound = rawMessage.includes('"message":"Not Found"') || rawMessage.includes('Not Found');

  if (includesWorkflowFiles && mentionsNotFound) {
    return `${rawMessage}. GitHub probablemente rechazó la actualización porque el token OAuth no tiene permiso para modificar workflows. Reconecta GitHub desde Conectores para obtener el scope "workflow" y vuelve a intentar.`;
  }

  return rawMessage;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { 
      accessToken, 
      repoFullName, 
      files, 
      commitMessage, 
      branch = "main",
      applicationId,
      deploymentUrl
    }: CommitRequest = await req.json();

    if (!accessToken || !repoFullName || !files || !commitMessage) {
      throw new Error("Missing required parameters");
    }

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    const refResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`,
      { headers }
    );

    if (!refResponse.ok) {
      throw new Error(`Failed to get branch reference: ${await refResponse.text()}`);
    }

    const refData = await refResponse.json();
    const latestCommitSha = refData.object.sha;

    const commitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits/${latestCommitSha}`,
      { headers }
    );

    if (!commitResponse.ok) {
      throw new Error(`Failed to get commit: ${await commitResponse.text()}`);
    }

    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    const tree = [];
    for (const [path, content] of Object.entries(files)) {
      const blobResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/blobs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            content,
            encoding: "utf-8",
          }),
        }
      );

      if (!blobResponse.ok) {
        throw new Error(`Failed to create blob for ${path}: ${await blobResponse.text()}`);
      }

      const blobData = await blobResponse.json();
      tree.push({
        path,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      });
    }

    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree,
        }),
      }
    );

    if (!treeResponse.ok) {
      const rawMessage = `Failed to create tree: ${await treeResponse.text()}`;
      throw new Error(buildHelpfulGitHubError(rawMessage, files));
    }

    const treeData = await treeResponse.json();

    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: commitMessage,
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );

    if (!newCommitResponse.ok) {
      throw new Error(`Failed to create commit: ${await newCommitResponse.text()}`);
    }

    const newCommitData = await newCommitResponse.json();

    // Try to update reference without force first
    let updateRefResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      }
    );

    // If non-fast-forward, try with force (for automated deployments)
    if (!updateRefResponse.ok) {
      const errorData = await updateRefResponse.json();

      if (errorData.message?.includes("not a fast forward") || errorData.message?.includes("Update is not a fast forward")) {
        console.log("⚠️ Non-fast-forward detected, attempting force push for deployment...");

        updateRefResponse = await fetch(
          `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              sha: newCommitData.sha,
              force: true,
            }),
          }
        );

        if (!updateRefResponse.ok) {
          throw new Error(`Failed to force update reference: ${await updateRefResponse.text()}`);
        }

        console.log("✅ Force push successful");
      } else {
        throw new Error(`Failed to update reference: ${JSON.stringify(errorData)}`);
      }
    }

    // Create deployment snapshot if applicationId is provided
    let snapshotId = null;
    if (applicationId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: snapshot, error: snapshotError } = await supabase
          .from('deployment_snapshots')
          .insert({
            application_id: applicationId,
            commit_hash: newCommitData.sha,
            commit_message: commitMessage,
            branch: branch,
            deployment_url: deploymentUrl,
            status: 'stable',
            deployed_at: new Date().toISOString(),
            metadata: {
              repository: repoFullName,
              files_count: Object.keys(files).length
            }
          })
          .select()
          .single();

        if (snapshotError) {
          console.error('Failed to create deployment snapshot:', snapshotError);
        } else {
          snapshotId = snapshot?.id;
          console.log('Deployment snapshot created:', snapshotId);
        }
      } catch (error) {
        console.error('Error creating snapshot:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        commit: newCommitData,
        snapshotId,
        message: "Files committed and pushed successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("GitHub commit error:", error);
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
