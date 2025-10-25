import { supabase } from '../lib/supabase';
import { getEnvVariable } from './envConfigService';

export interface DeploymentSnapshot {
  id: string;
  application_id: string;
  commit_hash: string;
  commit_message: string;
  branch: string;
  deployment_url?: string;
  status: 'stable' | 'unstable' | 'rolled_back';
  deployed_at: string;
  marked_stable_at?: string;
  marked_stable_by?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const deploymentSnapshotService = {
  /**
   * Get all snapshots for an application
   */
  async getSnapshots(applicationId: string): Promise<DeploymentSnapshot[]> {
    const { data, error } = await supabase
      .from('deployment_snapshots')
      .select('*')
      .eq('application_id', applicationId)
      .order('deployed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get stable snapshots only
   */
  async getStableSnapshots(applicationId: string): Promise<DeploymentSnapshot[]> {
    const { data, error } = await supabase
      .from('deployment_snapshots')
      .select('*')
      .eq('application_id', applicationId)
      .eq('status', 'stable')
      .order('deployed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<DeploymentSnapshot | null> {
    const { data, error } = await supabase
      .from('deployment_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new deployment snapshot
   */
  async createSnapshot(snapshot: {
    application_id: string;
    commit_hash: string;
    commit_message: string;
    branch?: string;
    deployment_url?: string;
    status?: 'stable' | 'unstable';
    metadata?: Record<string, any>;
  }): Promise<DeploymentSnapshot> {
    const { data, error } = await supabase
      .from('deployment_snapshots')
      .insert({
        ...snapshot,
        branch: snapshot.branch || 'main',
        status: snapshot.status || 'stable',
        deployed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Mark a snapshot as stable
   */
  async markAsStable(snapshotId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('deployment_snapshots')
      .update({
        status: 'stable',
        marked_stable_at: new Date().toISOString(),
        marked_stable_by: user.id,
      })
      .eq('id', snapshotId);

    if (error) throw error;
  },

  /**
   * Mark a snapshot as unstable
   */
  async markAsUnstable(snapshotId: string): Promise<void> {
    const { error } = await supabase
      .from('deployment_snapshots')
      .update({
        status: 'unstable',
      })
      .eq('id', snapshotId);

    if (error) throw error;
  },

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const { error } = await supabase
      .from('deployment_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (error) throw error;
  },

  /**
   * Rollback to a specific snapshot
   */
  async rollbackToSnapshot(snapshotId: string, applicationId: string): Promise<{
    success: boolean;
    message: string;
    snapshot: any;
    previous_commit: string;
    netlify_deployment_id?: string;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = getEnvVariable('VITE_SUPABASE_URL');
    const response = await fetch(
      `${supabaseUrl}/functions/v1/rollback-deployment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snapshotId,
          applicationId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rollback deployment');
    }

    return await response.json();
  },
};
