import { supabase } from '../lib/supabase';

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
  private readonly clientId: string;
  private readonly redirectUri: string;
  private readonly scopes = ['repo', 'user:email'];

  constructor() {
    // GitHub OAuth App credentials
    // Users will need to create a GitHub OAuth App at: https://github.com/settings/developers
    this.clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    this.redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/github/callback`;
  }

  // Step 1: Redirect to GitHub OAuth
  initiateOAuth(): void {
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
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

    // Exchange code for access token via Edge Function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-oauth-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const { access_token } = await response.json();

    // Get user info
    const user = await this.getGitHubUser(access_token);

    // Save connection to database
    return this.saveConnection({
      provider: 'github',
      access_token,
      username: user.login,
      email: user.email,
      avatar_url: user.avatar_url,
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
  async commitAndPush(repoFullName: string, files: Record<string, string>, commitMessage: string): Promise<void> {
    const connection = await this.getActiveConnection();
    if (!connection) throw new Error('No active GitHub connection');

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-commit-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        accessToken: connection.access_token,
        repoFullName,
        files,
        commitMessage,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to commit and push');
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
  isConfigured(): boolean {
    return !!this.clientId;
  }

  getSetupInstructions(): string {
    if (this.isConfigured()) {
      return 'GitHub OAuth está configurado';
    }

    return `
Para habilitar la integración con GitHub:

1. Ve a https://github.com/settings/developers
2. Crea una nueva OAuth App con estos valores:
   - Application name: AuthSystem
   - Homepage URL: ${window.location.origin}
   - Authorization callback URL: ${window.location.origin}/github/callback
3. Copia el Client ID y Client Secret
4. Agrégalos a tu archivo .env:
   VITE_GITHUB_CLIENT_ID=tu_client_id
   VITE_GITHUB_CLIENT_SECRET=tu_client_secret (servidor)
5. Reinicia la aplicación
    `.trim();
  }
}

export const githubService = new GitHubService();
export type { GitConnection, GitRepository, GitHubRepo };
