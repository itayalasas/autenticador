import { supabase } from '../lib/supabase';

export interface EnvironmentDeployBinding {
  id: string;
  user_id: string;
  application_id: string;
  environment_id: string;
  git_repository_id: string | null;
  repo_full_name: string | null;
  branch: string | null;
  netlify_site_id: string | null;
  netlify_site_name: string | null;
  netlify_site_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpsertBindingInput {
  application_id: string;
  environment_id: string;
  git_repository_id?: string | null;
  repo_full_name?: string | null;
  branch?: string | null;
  netlify_site_id?: string | null;
  netlify_site_name?: string | null;
  netlify_site_url?: string | null;
}

export const environmentDeployBindingService = {
  async getBindingsForApplication(applicationId: string): Promise<EnvironmentDeployBinding[]> {
    const { data, error } = await supabase
      .from('environment_deploy_bindings')
      .select('*')
      .eq('application_id', applicationId)
      .eq('is_active', true);

    if (error) {
      console.warn('Error getting environment deploy bindings:', error.message);
      return [];
    }

    return data || [];
  },

  async getBinding(environmentId: string): Promise<EnvironmentDeployBinding | null> {
    const { data, error } = await supabase
      .from('environment_deploy_bindings')
      .select('*')
      .eq('environment_id', environmentId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('Error getting environment deploy binding:', error.message);
      return null;
    }

    return data;
  },

  async upsertBinding(input: UpsertBindingInput): Promise<EnvironmentDeployBinding | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const payload = {
      user_id: user.id,
      application_id: input.application_id,
      environment_id: input.environment_id,
      git_repository_id: input.git_repository_id ?? null,
      repo_full_name: input.repo_full_name ?? null,
      branch: input.branch ?? 'main',
      netlify_site_id: input.netlify_site_id ?? null,
      netlify_site_name: input.netlify_site_name ?? null,
      netlify_site_url: input.netlify_site_url ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('environment_deploy_bindings')
      .upsert(payload, { onConflict: 'environment_id' })
      .select('*')
      .single();

    if (error) {
      console.warn('Error upserting environment deploy binding:', error.message);
      return null;
    }

    return data;
  },

  async deleteBinding(environmentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('environment_deploy_bindings')
      .delete()
      .eq('environment_id', environmentId);

    if (error) {
      console.warn('Error deleting environment deploy binding:', error.message);
      return false;
    }

    return true;
  },
};
