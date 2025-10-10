import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { accessToken, repoFullName, files, commitMessage, branch = "main" }: CommitRequest = await req.json();

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
      throw new Error(`Failed to create tree: ${await treeResponse.text()}`);
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

    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitData.sha,
        }),
      }
    );

    if (!updateRefResponse.ok) {
      throw new Error(`Failed to update reference: ${await updateRefResponse.text()}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        commit: newCommitData,
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