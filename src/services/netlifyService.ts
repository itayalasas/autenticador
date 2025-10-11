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

  async createSiteFromRepo(
    repoFullName: string,
    options: {
      name?: string;
      buildCommand?: string;
      publishDir?: string;
      branch?: string;
    } = {}
  ): Promise<NetlifySite> {
    // Strategy: Create empty site first, then connect repo
    // This is more reliable than trying to create with repo in one step

    try {
      // Step 1: Create an empty site
      const emptySite = await this.createSite({ name: options.name });

      // Step 2: Try to connect the repository
      try {
        await this.setupRepositoryConnection(emptySite.id, repoFullName, options.branch);

        // Refetch site to get updated info with repo connection
        const connectedSite = await this.getSite(emptySite.id);
        return connectedSite;
      } catch (repoError: any) {
        console.warn('Could not connect repo automatically:', repoError);

        // Site was created but repo connection failed
        // Return the site anyway, it can be connected manually
        if (repoError.message?.includes('repository') ||
            repoError.message?.includes('permission') ||
            repoError.message?.includes('access')) {
          throw new Error('REPO_ACCESS_REQUIRED');
        }

        // Return the empty site, connection can be done manually
        return emptySite;
      }
    } catch (error: any) {
      console.error('Error creating site from repo:', error);

      // If connection fails, it might be because Netlify doesn't have access to the repo
      if (error.message?.includes('repository') ||
          error.message?.includes('permission') ||
          error.message?.includes('422')) {
        throw new Error('REPO_ACCESS_REQUIRED');
      }

      throw error;
    }
  }

  async setupRepositoryConnection(siteId: string, repoFullName: string, branch: string = 'main'): Promise<any> {
    // Alternative approach: Update existing site with repo connection
    // This requires that Netlify already has GitHub App installed
    return this.makeRequest(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        repo: {
          provider: 'github',
          repo: repoFullName,
          branch: branch,
          cmd: '',
          dir: '.',
          private: false,
        },
        build_settings: {
          cmd: '',
          dir: '.',
          provider: 'github',
        },
      }),
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

  async deployWithFiles(
    siteId: string,
    files: Record<string, string>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<any> {
    // Deploy using manual file upload to Netlify API
    // This works WITHOUT a connected repository

    if (!this.accessToken) {
      throw new Error('Access token no configurado');
    }

    const id = siteId || this.siteId;
    if (!id) {
      throw new Error('Site ID no configurado');
    }

    const totalFiles = Object.keys(files).length;

    // STEP 0: Calculate hashes (0% - 5% progress)
    onProgress?.(0, 'Preparando archivos...');

    const fileHashes: Record<string, string> = {};
    const fileContents: Record<string, string> = {};

    let processedCount = 0;
    // Calculate SHA-1 for each file
    for (const [path, content] of Object.entries(files)) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      fileHashes[path] = hashHex;
      fileContents[path] = content;

      processedCount++;
      const hashProgress = (processedCount / totalFiles) * 5;
      onProgress?.(
        Math.round(hashProgress),
        `Procesando archivos (${processedCount}/${totalFiles})...`
      );
    }

    // STEP 1: Create deploy (5% progress)
    onProgress?.(5, 'Creando deploy en Netlify...');

    let createDeployResponse;
    try {
      createDeployResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${id}/deploys`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({
            files: fileHashes,
            draft: false,
          }),
        }
      );
    } catch (error: any) {
      console.error('Network error creating deploy:', error);
      throw new Error(`Error de red al crear deploy: ${error.message || 'Sin conexión'}`);
    }

    if (!createDeployResponse.ok) {
      const error = await createDeployResponse.text();
      console.error('Deploy creation failed:', error);
      throw new Error(`Failed to create deploy: ${error}`);
    }

    const deploy = await createDeployResponse.json();

    // Validate deploy response
    if (!deploy.id || !deploy.deploy_url) {
      console.error('Invalid deploy response:', deploy);
      throw new Error('Deploy response inválido de Netlify. Faltan campos requeridos.');
    }

    console.log('Deploy created:', {
      id: deploy.id,
      deploy_url: deploy.deploy_url,
      required_files: deploy.required?.length || 0
    });

    onProgress?.(10, 'Deploy creado, subiendo archivos...');

    // STEP 2: Upload files (10% - 80% progress)
    const requiredFiles = deploy.required || [];
    const filesToUpload = Object.entries(fileHashes).filter(([_, hash]) =>
      requiredFiles.includes(hash)
    );

    console.log(`Files to upload: ${filesToUpload.length} of ${Object.keys(files).length} total`);

    let uploadedCount = 0;
    const progressPerFile = 70 / Math.max(filesToUpload.length, 1);

    for (const [path, hash] of filesToUpload) {
      const content = fileContents[path];

      // Normalize path - remove leading slash if present
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
      const uploadUrl = `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${normalizedPath}`;

      // Determine correct MIME type based on file extension
      const getContentType = (filePath: string): string => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'html': 'text/html',
          'css': 'text/css',
          'js': 'application/javascript',
          'mjs': 'application/javascript',
          'json': 'application/json',
          'ts': 'text/plain',
          'tsx': 'text/plain',
          'jsx': 'text/plain',
          'svg': 'image/svg+xml',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'ttf': 'font/ttf',
          'eot': 'application/vnd.ms-fontobject',
          'ico': 'image/x-icon',
          'md': 'text/markdown',
          'txt': 'text/plain',
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
      };

      const contentType = getContentType(normalizedPath);

      console.log(`Uploading file: ${normalizedPath} (${content.length} bytes) [${contentType}]`);

      try {
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: content,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error(`Failed to upload ${normalizedPath}:`, {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            error: errorText
          });
          throw new Error(`Error subiendo ${normalizedPath}: ${uploadResponse.status} - ${errorText}`);
        }

        console.log(`✓ Uploaded: ${normalizedPath}`);
      } catch (error: any) {
        console.error(`Network error uploading ${normalizedPath}:`, error);
        throw new Error(`Error de red subiendo ${normalizedPath}: ${error.message}`);
      }

      uploadedCount++;
      const progress = 10 + (uploadedCount * progressPerFile);
      const fileName = path.split('/').pop() || path;
      onProgress?.(
        Math.round(progress),
        `Subiendo ${uploadedCount}/${filesToUpload.length}: ${fileName}`
      );
    }

    onProgress?.(80, 'Archivos subidos, procesando deploy...');

    // STEP 3: Wait for deploy to be ready (80% - 100% progress)
    let deployStatus = deploy;
    let attempts = 0;
    const maxAttempts = 60;

    while (deployStatus.state !== 'ready' && deployStatus.state !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://api.netlify.com/api/v1/sites/${id}/deploys/${deploy.id}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      deployStatus = await statusResponse.json();
      attempts++;

      const waitProgress = 80 + (attempts / maxAttempts) * 20;
      onProgress?.(Math.round(waitProgress), `Esperando build (${attempts}/${maxAttempts})...`);
    }

    onProgress?.(100, 'Deploy completado!');

    return {
      success: true,
      deploy: deployStatus,
      url: deployStatus.ssl_url || deployStatus.url,
      deployUrl: deployStatus.deploy_ssl_url || deployStatus.deploy_url,
    };
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

  async getLatestDeploy(siteId: string): Promise<NetlifyDeployResponse | null> {
    try {
      const deploys = await this.listDeploys(siteId);
      return deploys.length > 0 ? deploys[0] : null;
    } catch (error) {
      console.error('Error getting latest deploy:', error);
      return null;
    }
  }

  async getDeployWithLogs(siteId: string, deployId: string): Promise<{
    deploy: NetlifyDeployResponse;
    logs: string;
  } | null> {
    try {
      const [deploy, logs] = await Promise.all([
        this.getDeploy(siteId, deployId),
        this.getDeployLogs(siteId, deployId)
      ]);

      return { deploy, logs };
    } catch (error) {
      console.error('Error getting deploy with logs:', error);
      return null;
    }
  }

  isDeployCompleted(state: string): boolean {
    return state === 'ready' || state === 'error';
  }

  isDeploySuccessful(state: string): boolean {
    return state === 'ready';
  }

  isDeployFailed(state: string): boolean {
    return state === 'error';
  }

  getDeployStateLabel(state: string): string {
    const stateLabels: Record<string, string> = {
      'new': 'Nuevo',
      'building': 'Construyendo',
      'processing': 'Procesando',
      'ready': 'Completado',
      'error': 'Error',
      'enqueued': 'En cola'
    };
    return stateLabels[state] || state;
  }
}

export const netlifyService = new NetlifyService();
export type { NetlifyDeployOptions, NetlifyDeployResponse, NetlifySite, CreateSiteOptions };
