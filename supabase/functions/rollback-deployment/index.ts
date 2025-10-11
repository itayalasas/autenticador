import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RollbackRequest {
  snapshotId: string;
  applicationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { snapshotId, applicationId }: RollbackRequest = await req.json();

    if (!snapshotId || !applicationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: snapshotId, applicationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Rollback] User ${user.id} requesting rollback to snapshot ${snapshotId}`);

    // 1. Verify user owns the application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*, connectors_config(*)')
      .eq('id', applicationId)
      .eq('owner_id', user.id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get the snapshot to rollback to
    const { data: snapshot, error: snapshotError } = await supabase
      .from('deployment_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('application_id', applicationId)
      .single();

    if (snapshotError || !snapshot) {
      return new Response(
        JSON.stringify({ error: 'Snapshot not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Rollback] Found snapshot: ${snapshot.commit_hash} - ${snapshot.commit_message}`);

    // 3. Get GitHub configuration
    const githubConfig = application.connectors_config?.find(
      (c: any) => c.connector_type === 'github'
    );

    if (!githubConfig?.config?.access_token) {
      return new Response(
        JSON.stringify({ error: 'GitHub not configured for this application' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubToken = githubConfig.config.access_token;
    const repoFullName = githubConfig.config.repository;

    if (!repoFullName) {
      return new Response(
        JSON.stringify({ error: 'GitHub repository not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get current commit on the branch
    const branch = snapshot.branch || 'main';
    const currentRefUrl = `https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`;
    
    const currentRefResponse = await fetch(currentRefUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Supabase-Edge-Function'
      }
    });

    if (!currentRefResponse.ok) {
      const errorText = await currentRefResponse.text();
      console.error('[Rollback] Failed to get current ref:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get current branch reference' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentRef = await currentRefResponse.json();
    const currentCommitSha = currentRef.object.sha;

    console.log(`[Rollback] Current commit: ${currentCommitSha}`);
    console.log(`[Rollback] Rolling back to: ${snapshot.commit_hash}`);

    // 5. Create a snapshot of current state before rollback
    const { error: currentSnapshotError } = await supabase
      .from('deployment_snapshots')
      .insert({
        application_id: applicationId,
        commit_hash: currentCommitSha,
        commit_message: 'Snapshot before rollback',
        branch: branch,
        status: 'rolled_back',
        deployed_at: new Date().toISOString(),
        marked_stable_by: user.id,
        metadata: { reason: 'Auto-snapshot before rollback', rollback_to: snapshotId }
      });

    if (currentSnapshotError) {
      console.error('[Rollback] Failed to create current snapshot:', currentSnapshotError);
    }

    // 6. Force update the branch to the snapshot commit
    const updateRefUrl = `https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`;
    
    const updateResponse = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-Edge-Function'
      },
      body: JSON.stringify({
        sha: snapshot.commit_hash,
        force: true
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Rollback] Failed to update ref:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to rollback branch', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Rollback] Branch updated successfully');

    // 7. Trigger Netlify deployment
    const netlifyConfig = application.connectors_config?.find(
      (c: any) => c.connector_type === 'netlify'
    );

    let netlifyDeployment = null;
    if (netlifyConfig?.config?.site_id) {
      const netlifySiteId = netlifyConfig.config.site_id;
      const netlifyToken = Deno.env.get('NETLIFY_ACCESS_TOKEN');

      if (netlifyToken) {
        console.log('[Rollback] Triggering Netlify deployment...');
        
        const buildHookUrl = `https://api.netlify.com/api/v1/sites/${netlifySiteId}/builds`;
        const buildResponse = await fetch(buildHookUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${netlifyToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ clear_cache: true })
        });

        if (buildResponse.ok) {
          netlifyDeployment = await buildResponse.json();
          console.log('[Rollback] Netlify deployment triggered:', netlifyDeployment.id);
        } else {
          console.error('[Rollback] Failed to trigger Netlify deployment');
        }
      }
    }

    // 8. Create deployment log
    const { error: logError } = await supabase
      .from('deployment_logs')
      .insert({
        application_id: applicationId,
        status: 'success',
        message: `Rolled back to commit ${snapshot.commit_hash.substring(0, 7)}`,
        metadata: {
          type: 'rollback',
          snapshot_id: snapshotId,
          commit_hash: snapshot.commit_hash,
          commit_message: snapshot.commit_message,
          previous_commit: currentCommitSha,
          netlify_deployment_id: netlifyDeployment?.id
        }
      });

    if (logError) {
      console.error('[Rollback] Failed to create deployment log:', logError);
    }

    // 9. Update snapshot status
    await supabase
      .from('deployment_snapshots')
      .update({ 
        marked_stable_at: new Date().toISOString(),
        marked_stable_by: user.id 
      })
      .eq('id', snapshotId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rollback completed successfully',
        snapshot: {
          id: snapshot.id,
          commit_hash: snapshot.commit_hash,
          commit_message: snapshot.commit_message,
          deployed_at: snapshot.deployed_at
        },
        previous_commit: currentCommitSha,
        netlify_deployment_id: netlifyDeployment?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[Rollback] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});