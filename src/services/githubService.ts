import { supabase } from '../lib/supabase';
import { connectorsService } from './connectorsService';
import { getEnvVariable } from './envConfigService';

interface GitHubUser {
  login: string;
  email: string;
  avatar_url: string;
  name: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
}

interface GitConnection {
  id: string;
  user_id: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  access_token: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface GitRepository {
  id: string;
  user_id: string;
  git_connection_id: string;
  repo_name: string;
  repo_full_name: string;
  repo_url: string;
  clone_url: string;
  default_branch: string;
  is_private: boolean;
  netlify_site_id: string | null;
  auto_deploy: boolean;
}

class GitHubService {
  private readonly scopes = ['repo', 'user:email'];

  private async getConfig() {
    const config = await connectorsService.getGitHubConfig();
    if (!config) {
      throw new Error('GitHub no está configurado. Ve a Conectores para configurarlo.');
    }
    return config;
  }

  // Step 1: Redirect to GitHub OAuth
  async initiateOAuth(): Promise<void> {
    const config = await this.getConfig();

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', config.client_id);
    authUrl.searchParams.append('redirect_uri', config.redirect_uri);
    authUrl.searchParams.append('scope', this.scopes.join(' '));
    authUrl.searchParams.append('state', this.generateState());

    window.location.href = authUrl.toString();
  }

  private generateState(): string {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('github_oauth_state', state);
    return state;
  }

  // Step 2: Handle OAuth callback (this would be called by an Edge Function)
  async handleCallback(code: string, state: string): Promise<GitConnection> {
    const savedState = sessionStorage.getItem('github_oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }

    // Get current user ID
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Exchange code for access token via Edge Function
    const response = await fetch(`${getEnvVariable('VITE_SUPABASE_URL')}/functions/v1/github-oauth-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEnvVariable('VITE_SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({ code, userId: currentUser.id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to exchange code for token');
    }

    const { access_token } = await response.json();

    // Get GitHub user info
    const githubUser = await this.getGitHubUser(access_token);

    // Save connection to database
    return this.saveConnection({
      provider: 'github',
      access_token,
      username: githubUser.login,
      email: githubUser.email,
      avatar_url: githubUser.avatar_url,
    });
  }

  private async getGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get GitHub user');
    }

    return response.json();
  }

  // Save Git connection to database
  private async saveConnection(data: {
    provider: 'github' | 'gitlab' | 'bitbucket';
    access_token: string;
    username: string;
    email: string;
    avatar_url: string;
  }): Promise<GitConnection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Deactivate any existing connections for this provider
    await supabase
      .from('git_connections')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('provider', data.provider);

    // Insert or update connection
    const { data: connection, error } = await supabase
      .from('git_connections')
      .upsert({
        user_id: user.id,
        provider: data.provider,
        access_token: data.access_token,
        username: data.username,
        email: data.email,
        avatar_url: data.avatar_url,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      })
      .select()
      .single();

    if (error) throw error;
    return connection;
  }

  // Get active GitHub connection
  async getActiveConnection(): Promise<GitConnection | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('git_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error getting GitHub connection:', error);
      return null;
    }

    return data;
  }

  // List user's GitHub repositories
  async listRepositories(page: number = 1, perPage: number = 30): Promise<GitHubRepo[]> {
    const connection = await this.getActiveConnection();
    if (!connection) throw new Error('No active GitHub connection');

    const response = await fetch(`https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated`, {
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to list repositories');
    }

    return response.json();
  }

  // Create a new GitHub repository
  async createRepository(name: string, isPrivate: boolean = true, description?: string): Promise<GitHubRepo> {
    const connection = await this.getActiveConnection();
    if (!connection) throw new Error('No active GitHub connection');

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        private: isPrivate,
        description,
        auto_init: true, // Initialize with README
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create repository');
    }

    return response.json();
  }

  // Save repository to database
  async saveRepository(repo: GitHubRepo, netlify_site_id?: string): Promise<GitRepository> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const connection = await this.getActiveConnection();
    if (!connection) throw new Error('No active GitHub connection');

    const { data, error } = await supabase
      .from('git_repositories')
      .upsert({
        user_id: user.id,
        git_connection_id: connection.id,
        repo_name: repo.name,
        repo_full_name: repo.full_name,
        repo_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        is_private: repo.private,
        netlify_site_id,
        auto_deploy: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,repo_full_name'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get saved repositories from database
  async getSavedRepositories(): Promise<GitRepository[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('git_repositories')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error getting saved repositories:', error);
      return [];
    }

    return data || [];
  }

  // Commit and push files to repository (via Edge Function)
  async commitAndPush(
    repoFullName: string,
    files: Record<string, string>,
    commitMessage: string
  ): Promise<{ success: boolean; sha?: string; error?: string }> {
    try {
      const connection = await this.getActiveConnection();
      if (!connection) throw new Error('No active GitHub connection');

      const response = await fetch(`${getEnvVariable('VITE_SUPABASE_URL')}/functions/v1/github-commit-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEnvVariable('VITE_SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          accessToken: connection.access_token,
          repoFullName,
          files,
          commitMessage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to commit and push'
        };
      }

      return {
        success: true,
        sha: result.commit?.sha
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  // Disconnect GitHub
  async disconnect(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('git_connections')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('provider', 'github');

    if (error) throw error;
  }

  // Check if GitHub is configured
  async isConfigured(): Promise<boolean> {
    return await connectorsService.isGitHubConfigured();
  }

  async getSetupInstructions(): Promise<string> {
    const configured = await this.isConfigured();
    if (configured) {
      return 'GitHub OAuth está configurado';
    }

    return 'GitHub no está configurado. Ve a la sección "Conectores" en el menú para configurarlo.';
  }
}

export const githubService = new GitHubService();
export type { GitConnection, GitRepository, GitHubRepo };
