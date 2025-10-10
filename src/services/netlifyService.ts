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
    const { connectorsService } = await import('./connectorsService');

    const config = await connectorsService.getNetlifyConfig();

    if (config) {
      this.accessToken = config.access_token;
      if (config.site_id) {
        this.siteId = config.site_id;
      }
      return config;
    }

    return null;
  }

  async saveConfigToDatabase(accessToken: string, siteId: string, siteName?: string, siteUrl?: string) {
    const { connectorsService } = await import('./connectorsService');

    const config = await connectorsService.saveNetlifyConfig({
      access_token: accessToken,
      site_id: siteId,
    });

    // Update in-memory values
    this.accessToken = accessToken;
    this.siteId = siteId;

    return config;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Netlify access token no configurado. Por favor ve a Conectores para configurarlo.');
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

  async connectRepositoryToSite(siteId: string, repoUrl: string, buildCommand: string = 'npm run build', publishDir: string = 'dist'): Promise<any> {
    // Connect a GitHub repository to a Netlify site
    return this.makeRequest(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        repo: {
          provider: 'github',
          repo: repoUrl, // Format: "owner/repo"
          branch: 'main',
          cmd: buildCommand,
          dir: publishDir,
        },
      }),
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

  async deployZipDirectly(siteId: string, zipBlob: Blob, title?: string): Promise<any> {
    // Deploy directly by uploading a ZIP file
    // This works WITHOUT a connected repository

    if (!this.accessToken) {
      throw new Error('Access token no configurado');
    }

    const id = siteId || this.siteId;
    if (!id) {
      throw new Error('Site ID no configurado');
    }

    // Upload the ZIP file directly to Netlify
    const formData = new FormData();
    formData.append('file', zipBlob, 'deploy.zip');

    const response = await fetch(`${this.baseUrl}/sites/${id}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/zip',
      },
      body: zipBlob,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(error.message || `Deploy failed: ${response.status}`);
    }

    return response.json();
  }

  async getDeployStatus(siteId: string, deployId: string): Promise<any> {
    return this.makeRequest(`/sites/${siteId}/deploys/${deployId}`);
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
      return 'Netlify no está configurado. Por favor ve a la sección "Conectores" en el menú para configurarlo.';
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

  async updateSiteEnvironmentVariables(
    siteId: string,
    environmentVariables: Record<string, string>
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sites/${siteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          build_settings: {
            env: environmentVariables,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update environment variables: ${error}`);
      }
    } catch (error) {
      console.error('Error updating Netlify environment variables:', error);
      throw error;
    }
  }

  async getSiteEnvironmentVariables(siteId: string): Promise<Record<string, string>> {
    try {
      const site = await this.getSite(siteId);
      return site.build_settings?.env || {};
    } catch (error) {
      console.error('Error getting Netlify environment variables:', error);
      return {};
    }
  }
}

export const netlifyService = new NetlifyService();
export type { NetlifyDeployOptions, NetlifyDeployResponse, NetlifySite, CreateSiteOptions };
