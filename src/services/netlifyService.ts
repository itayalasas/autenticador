interface NetlifyDeployOptions {
  siteId?: string;
  branch?: string;
  title?: string;
}

interface NetlifyDeployResponse {
  id: string;
  state: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_ssl_url: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  created_at: string;
  custom_domain?: string;
}

interface CreateSiteOptions {
  name?: string;
  customDomain?: string;
  repo?: {
    provider: string;
    repo: string;
    branch?: string;
  };
}

class NetlifyService {
  private accessToken: string;
  private siteId: string;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor() {
    this.accessToken = import.meta.env.VITE_NETLIFY_ACCESS_TOKEN || '';
    this.siteId = import.meta.env.VITE_NETLIFY_SITE_ID || '';
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  setSiteId(siteId: string) {
    this.siteId = siteId;
  }

  async loadConfigFromDatabase() {
    const { supabase } = await import('../lib/supabase');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('netlify_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) {
      console.error('Error loading Netlify config from database:', error);
      return null;
    }

    if (data) {
      this.accessToken = data.access_token;
      this.siteId = data.site_id;
      return data;
    }

    return null;
  }

  async saveConfigToDatabase(accessToken: string, siteId: string, siteName?: string, siteUrl?: string) {
    const { supabase } = await import('../lib/supabase');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Deactivate any existing configs
    await supabase
      .from('netlify_config')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Insert or update the config
    const { data, error } = await supabase
      .from('netlify_config')
      .upsert({
        user_id: user.id,
        access_token: accessToken,
        site_id: siteId,
        site_name: siteName,
        site_url: siteUrl,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,site_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving Netlify config to database:', error);
      throw error;
    }

    // Update in-memory values
    this.accessToken = accessToken;
    this.siteId = siteId;

    return data;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Netlify access token no configurado. Por favor configura VITE_NETLIFY_ACCESS_TOKEN en tu archivo .env');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(error.message || `Netlify API error: ${response.status}`);
    }

    return response.json();
  }

  async listSites(): Promise<NetlifySite[]> {
    return this.makeRequest('/sites');
  }

  async getSite(siteId: string): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${siteId}`);
  }

  async createSite(options: CreateSiteOptions = {}): Promise<NetlifySite> {
    const body: any = {
      name: options.name || `auth-system-${Date.now()}`,
    };

    if (options.customDomain) {
      body.custom_domain = options.customDomain;
    }

    if (options.repo) {
      body.repo = options.repo;
    }

    return this.makeRequest('/sites', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateSite(siteId: string, updates: Partial<NetlifySite>): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteSite(siteId: string): Promise<void> {
    return this.makeRequest(`/sites/${siteId}`, {
      method: 'DELETE',
    });
  }

  async checkSiteHasRepo(siteId?: string): Promise<boolean> {
    const id = siteId || this.siteId;
    if (!id) return false;

    try {
      const site = await this.getSite(id);
      return !!(site as any).build_settings?.repo_url;
    } catch (error) {
      console.error('Error checking site repo:', error);
      return false;
    }
  }

  async triggerDeploy(options: NetlifyDeployOptions = {}): Promise<NetlifyDeployResponse> {
    // Try to load config from database if not in memory
    if (!this.siteId && !options.siteId) {
      await this.loadConfigFromDatabase();
    }

    const siteId = options.siteId || this.siteId;

    if (!siteId) {
      throw new Error('Site ID no configurado. Por favor selecciona un sitio de Netlify');
    }

    // Check if site has a repository connected
    const hasRepo = await this.checkSiteHasRepo(siteId);
    if (!hasRepo) {
      throw new Error('REPO_NOT_CONNECTED');
    }

    const body: any = {
      clear_cache: true,
    };

    if (options.branch) {
      body.branch = options.branch;
    }

    if (options.title) {
      body.title = options.title;
    }

    return this.makeRequest(`/sites/${siteId}/builds`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deployFilesDirectly(siteId: string, files: Record<string, string>): Promise<any> {
    // Create a manual deploy by uploading files
    // This works without a connected repository

    // First, create a new deploy
    const deploy = await this.makeRequest(`/sites/${siteId}/deploys`, {
      method: 'POST',
      body: JSON.stringify({
        files: Object.fromEntries(
          Object.keys(files).map(path => [path, crypto.createHash ? null : Date.now()])
        )
      })
    });

    // Upload each file
    for (const [path, content] of Object.entries(files)) {
      await fetch(deploy.required[path], {
        method: 'PUT',
        body: content,
        headers: {
          'Content-Type': 'application/octet-stream',
        }
      });
    }

    return deploy;
  }

  async getDeploy(siteId: string, deployId: string): Promise<NetlifyDeployResponse> {
    return this.makeRequest(`/sites/${siteId}/deploys/${deployId}`);
  }

  async listDeploys(siteId: string): Promise<NetlifyDeployResponse[]> {
    return this.makeRequest(`/sites/${siteId}/deploys`);
  }

  async waitForDeploy(
    siteId: string,
    deployId: string,
    onProgress?: (deploy: NetlifyDeployResponse) => void,
    timeout = 600000
  ): Promise<NetlifyDeployResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const deploy = await this.getDeploy(siteId, deployId);

      if (onProgress) {
        onProgress(deploy);
      }

      if (deploy.state === 'ready') {
        return deploy;
      }

      if (deploy.state === 'error') {
        throw new Error(deploy.error_message || 'Deploy falló');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Deploy timeout - el deploy tomó demasiado tiempo');
  }

  async getDeployLogs(siteId: string, deployId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}/deploys/${deployId}/log`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error obteniendo logs: ${response.status}`);
      }

      return response.text();
    } catch (error) {
      console.error('Error fetching deploy logs:', error);
      return 'No se pudieron obtener los logs del deploy';
    }
  }

  async isConfigured(): Promise<boolean> {
    if (!this.accessToken || !this.siteId) {
      await this.loadConfigFromDatabase();
    }
    return !!this.accessToken && !!this.siteId;
  }

  async hasAccessToken(): Promise<boolean> {
    if (!this.accessToken) {
      await this.loadConfigFromDatabase();
    }
    return !!this.accessToken;
  }

  async hasSiteId(): Promise<boolean> {
    if (!this.siteId) {
      await this.loadConfigFromDatabase();
    }
    return !!this.siteId;
  }

  getSiteId(): string | undefined {
    return this.siteId;
  }

  async getConfigurationInstructions(): Promise<string> {
    const hasToken = await this.hasAccessToken();
    const hasSite = await this.hasSiteId();

    if (!hasToken) {
      return `
Para habilitar el deploy automático a Netlify:

1. Ve a https://app.netlify.com/user/applications/personal
2. Crea un nuevo Personal Access Token
3. Guárdalo usando el formulario de configuración de Netlify en el sistema

El token se guardará de forma segura en la base de datos.
      `.trim();
    }

    if (!hasSite) {
      return `
Tienes el token configurado, pero falta el Site ID.

Opciones:
1. Si es tu primer deploy: Usa el botón "Crear Nuevo Sitio"
2. Si ya tienes un sitio: Selecciónalo de la lista

El Site ID se guardará automáticamente en la base de datos, sin necesidad de reiniciar.
      `.trim();
    }

    return 'Netlify está completamente configurado';
  }
}

export const netlifyService = new NetlifyService();
export type { NetlifyDeployOptions, NetlifyDeployResponse, NetlifySite, CreateSiteOptions };
