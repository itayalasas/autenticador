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
}

class NetlifyService {
  private accessToken: string;
  private baseUrl = 'https://api.netlify.com/api/v1';

  constructor() {
    this.accessToken = import.meta.env.VITE_NETLIFY_ACCESS_TOKEN || '';
  }

  setAccessToken(token: string) {
    this.accessToken = token;
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

  async triggerDeploy(options: NetlifyDeployOptions = {}): Promise<NetlifyDeployResponse> {
    const siteId = options.siteId || import.meta.env.VITE_NETLIFY_SITE_ID;

    if (!siteId) {
      throw new Error('Site ID no configurado. Proporciona un siteId o configura VITE_NETLIFY_SITE_ID');
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

  isConfigured(): boolean {
    return !!this.accessToken && !!import.meta.env.VITE_NETLIFY_SITE_ID;
  }

  getConfigurationInstructions(): string {
    return `
Para habilitar el deploy automático a Netlify:

1. Ve a https://app.netlify.com/user/applications/personal
2. Crea un nuevo Personal Access Token
3. Copia el token y agrégalo a tu archivo .env como VITE_NETLIFY_ACCESS_TOKEN
4. Obtén tu Site ID desde la configuración del sitio en Netlify
5. Agrégalo a tu archivo .env como VITE_NETLIFY_SITE_ID
6. Reinicia la aplicación

Ejemplo de .env:
VITE_NETLIFY_ACCESS_TOKEN=tu_token_aqui
VITE_NETLIFY_SITE_ID=tu_site_id_aqui
    `.trim();
  }
}

export const netlifyService = new NetlifyService();
export type { NetlifyDeployOptions, NetlifyDeployResponse, NetlifySite };
