import { supabase } from '../lib/supabase';
import type { DeployProvider } from '../types';

export interface EnvironmentDeployBinding {
  id: string;
  user_id: string;
  application_id: string;
  environment_id: string;
  deploy_provider: DeployProvider;
  git_repository_id: string | null;
  repo_full_name: string | null;
  branch: string | null;
  netlify_site_id: string | null;
  netlify_site_name: string | null;
  netlify_site_url: string | null;
  azure_container_app_name: string | null;
  azure_resource_group: string | null;
  azure_location: string | null;
  azure_containerapps_environment: string | null;
  azure_create_if_missing: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpsertBindingInput {
  application_id: string;
  environment_id: string;
  deploy_provider?: DeployProvider;
  git_repository_id?: string | null;
  repo_full_name?: string | null;
  branch?: string | null;
  netlify_site_id?: string | null;
  netlify_site_name?: string | null;
  netlify_site_url?: string | null;
  azure_container_app_name?: string | null;
  azure_resource_group?: string | null;
  azure_location?: string | null;
  azure_containerapps_environment?: string | null;
  azure_create_if_missing?: boolean;
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
      deploy_provider: input.deploy_provider ?? 'netlify',
      git_repository_id: input.git_repository_id ?? null,
      repo_full_name: input.repo_full_name ?? null,
      branch: input.branch ?? 'main',
      netlify_site_id: input.netlify_site_id ?? null,
      netlify_site_name: input.netlify_site_name ?? null,
      netlify_site_url: input.netlify_site_url ?? null,
      azure_container_app_name: input.azure_container_app_name ?? null,
      azure_resource_group: input.azure_resource_group ?? null,
      azure_location: input.azure_location ?? null,
      azure_containerapps_environment: input.azure_containerapps_environment ?? null,
      azure_create_if_missing: input.azure_create_if_missing ?? true,
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
