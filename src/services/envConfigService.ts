interface EnvConfig {
  project_name: string;
  description: string;
  variables: Record<string, string>;
  updated_at: string;
}

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

  private async fetchConfig(): Promise<void> {
    try {
      console.log('🔄 Fetching environment configuration from API...');

      const response = await fetch(
        'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env',
        {
          method: 'GET',
          headers: {
            'X-Access-Key': '4a63305a316f04fe2acf33b2b63135925bd3a0523c1fd453a42fbf1fc49e6240',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
      }

      this.config = await response.json();
      this.loaded = true;

      if (this.config && this.config.variables) {
        (window as any).__ENV__ = {};
        Object.entries(this.config.variables).forEach(([key, value]) => {
          (window as any).__ENV__[key] = value;
        });

        console.log('✅ Environment configuration loaded successfully');
        console.log(`📦 Loaded ${Object.keys(this.config.variables).length} variables`);
        console.log('🔑 Variables:', Object.keys(this.config.variables).join(', '));
      }
    } catch (error) {
      console.error('❌ Failed to load environment configuration:', error);
      throw error;
    }
  }

  getVariable(key: string): string | undefined {
    if (!this.loaded) {
      console.warn(`⚠️ Attempted to access env variable "${key}" before config was loaded`);
      return undefined;
    }

    return (window as any).__ENV__?.[key] || import.meta.env[key];
  }

  getAllVariables(): Record<string, string> {
    if (!this.loaded) {
      console.warn('⚠️ Attempted to access all env variables before config was loaded');
      return {};
    }

    return (window as any).__ENV__ || {};
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
