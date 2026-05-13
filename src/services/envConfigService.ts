interface EnvConfig {
  project_name: string;
  description: string;
  variables: Record<string, string>;
  updated_at: string;
}

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

const DEFAULT_ENV_CONFIG_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const DEFAULT_ENV_CONFIG_ACCESS_KEY =
  '4a63305a316f04fe2acf33b2b63135925bd3a0523c1fd453a42fbf1fc49e6240';
const ENV_PREFIX = 'VITE_';

class EnvConfigService {
  private static instance: EnvConfigService;
  private config: EnvConfig | null = null;
  private loaded = false;
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): EnvConfigService {
    if (!EnvConfigService.instance) {
      EnvConfigService.instance = new EnvConfigService();
    }
    return EnvConfigService.instance;
  }

  async loadConfig(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    this.loading = true;
    this.loadPromise = this.fetchConfig();

    try {
      await this.loadPromise;
    } finally {
      this.loading = false;
      this.loadPromise = null;
    }
  }

  private getBootstrapUrl(): string {
    const override = import.meta.env.VITE_ENV_CONFIG_URL as string | undefined;
    return (override || DEFAULT_ENV_CONFIG_URL).trim();
  }

  private getBootstrapAccessKey(): string {
    const override = import.meta.env.VITE_ENV_CONFIG_ACCESS_KEY as string | undefined;
    return (override || DEFAULT_ENV_CONFIG_ACCESS_KEY).trim();
  }

  private getBuildEnvVariables(): Record<string, string> {
    return Object.entries(import.meta.env)
      .filter(([key, value]) => key.startsWith(ENV_PREFIX) && typeof value === 'string' && value.trim().length > 0)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value.trim();
        return acc;
      }, {});
  }

  private applyConfigVariables(variables: Record<string, string>): void {
    const mergedVariables = { ...this.getBuildEnvVariables(), ...variables };
    window.__ENV__ = mergedVariables;
    this.config = {
      project_name: 'runtime-config',
      description: 'Environment variables loaded from /get-env',
      variables: mergedVariables,
      updated_at: new Date().toISOString(),
    };
    this.loaded = true;
  }

  private async fetchConfig(): Promise<void> {
    try {
      console.log('🔄 Fetching environment configuration from API...');

      const response = await fetch(this.getBootstrapUrl(), {
        method: 'GET',
        headers: {
          'X-Access-Key': this.getBootstrapAccessKey(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as Partial<EnvConfig>;
      const variables = payload?.variables && typeof payload.variables === 'object'
        ? Object.entries(payload.variables).reduce<Record<string, string>>((acc, [key, value]) => {
            if (typeof value === 'string') {
              acc[key] = value;
            }
            return acc;
          }, {})
        : {};

      if (!Object.keys(variables).length) {
        throw new Error('Environment config response did not include any variables');
      }

      this.applyConfigVariables(variables);
      this.config = {
        project_name: payload.project_name || 'runtime-config',
        description: payload.description || 'Environment variables loaded from /get-env',
        variables: window.__ENV__ || {},
        updated_at: payload.updated_at || new Date().toISOString(),
      };

      console.log('✅ Environment configuration loaded successfully');
      console.log(`📦 Loaded ${Object.keys(window.__ENV__ || {}).length} variables`);
      console.log('🔑 Variables:', Object.keys(window.__ENV__ || {}).join(', '));
    } catch (error) {
      console.error('❌ Failed to load environment configuration:', error);
      const fallbackVariables = this.getBuildEnvVariables();

      if (Object.keys(fallbackVariables).length > 0) {
        console.warn('⚠️ Falling back to build-time environment variables');
        this.applyConfigVariables(fallbackVariables);
        this.config = {
          project_name: 'build-fallback',
          description: 'Build-time environment fallback because /get-env was unavailable',
          variables: fallbackVariables,
          updated_at: new Date().toISOString(),
        };
        return;
      }

      throw error;
    }
  }

  getVariable(key: string): string | undefined {
    if (!this.loaded) {
      console.warn(`⚠️ Attempted to access env variable "${key}" before config was loaded`);
    }

    return window.__ENV__?.[key] || (import.meta.env[key] as string | undefined);
  }

  getAllVariables(): Record<string, string> {
    if (!this.loaded) {
      console.warn('⚠️ Attempted to access all env variables before config was loaded');
    }

    return window.__ENV__ || this.getBuildEnvVariables();
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getConfig(): EnvConfig | null {
    return this.config;
  }
}

export const envConfigService = EnvConfigService.getInstance();

export function getEnvVariable(key: string): string {
  const value = envConfigService.getVariable(key);
  if (!value) {
    console.warn(`⚠️ Environment variable "${key}" not found`);
    return '';
  }
  return value;
}
