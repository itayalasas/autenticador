import { supabase } from '../lib/supabase';

interface ConnectorConfig {
  id: string;
  user_id: string;
  connector_type: 'github' | 'netlify' | 'gitlab' | 'bitbucket' | 'stripe' | 'dlocal';
  config_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface GitHubConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

interface NetlifyConfig {
  access_token: string;
  site_id?: string;
}

class ConnectorsService {
  // Save or update connector configuration
  async saveConfig(
    connectorType: ConnectorConfig['connector_type'],
    configData: Record<string, any>
  ): Promise<ConnectorConfig> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('connectors_config')
      .upsert({
        user_id: user.id,
        connector_type: connectorType,
        config_data: configData,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,connector_type'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get connector configuration
  async getConfig(connectorType: ConnectorConfig['connector_type']): Promise<ConnectorConfig | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('connectors_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('connector_type', connectorType)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`Error getting ${connectorType} config:`, error);
      return null;
    }

    return data;
  }

  // Get all active connectors
  async getAllConfigs(): Promise<ConnectorConfig[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('connectors_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('connector_type');

    if (error) {
      console.error('Error getting all configs:', error);
      return [];
    }

    return data || [];
  }

  // Delete connector configuration
  async deleteConfig(connectorType: ConnectorConfig['connector_type']): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('connectors_config')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('connector_type', connectorType);

    if (error) throw error;
  }

  // GitHub specific methods
  async saveGitHubConfig(config: GitHubConfig): Promise<ConnectorConfig> {
    return this.saveConfig('github', config);
  }

  async getGitHubConfig(): Promise<GitHubConfig | null> {
    const config = await this.getConfig('github');
    return config ? config.config_data as GitHubConfig : null;
  }

  async isGitHubConfigured(): Promise<boolean> {
    const config = await this.getGitHubConfig();
    return !!(config?.client_id && config?.client_secret && config?.redirect_uri);
  }

  // Netlify specific methods
  async saveNetlifyConfig(config: NetlifyConfig): Promise<ConnectorConfig> {
    return this.saveConfig('netlify', config);
  }

  async getNetlifyConfig(): Promise<NetlifyConfig | null> {
    const config = await this.getConfig('netlify');
    return config ? config.config_data as NetlifyConfig : null;
  }

  async isNetlifyConfigured(): Promise<boolean> {
    const config = await this.getNetlifyConfig();
    return !!(config?.access_token);
  }

  // Validate all required connectors for deployment
  async validateDeploymentConnectors(): Promise<{
    valid: boolean;
    missing: string[];
    configured: string[];
  }> {
    const configs = await this.getAllConfigs();
    const configured = configs.map(c => c.connector_type);
    const missing: string[] = [];

    // Check GitHub
    const githubConfigured = await this.isGitHubConfigured();
    if (!githubConfigured) {
      missing.push('GitHub');
    }

    // Check Netlify
    const netlifyConfigured = await this.isNetlifyConfigured();
    if (!netlifyConfigured) {
      missing.push('Netlify');
    }

    return {
      valid: missing.length === 0,
      missing,
      configured: configured.filter(c => ['github', 'netlify'].includes(c)),
    };
  }

  // Test connector connection
  async testConnection(connectorType: ConnectorConfig['connector_type']): Promise<{
    success: boolean;
    message: string;
  }> {
    const config = await this.getConfig(connectorType);
    if (!config) {
      return {
        success: false,
        message: `${connectorType} no está configurado`,
      };
    }

    try {
      switch (connectorType) {
        case 'github': {
          const githubConfig = config.config_data as GitHubConfig;
          if (!githubConfig.client_id || !githubConfig.client_secret) {
            return {
              success: false,
              message: 'Faltan credenciales de GitHub',
            };
          }
          return {
            success: true,
            message: 'GitHub configurado correctamente',
          };
        }

        case 'netlify': {
          const netlifyConfig = config.config_data as NetlifyConfig;
          if (!netlifyConfig.access_token) {
            return {
              success: false,
              message: 'Falta Access Token de Netlify',
            };
          }

          // Test Netlify connection
          const response = await fetch('https://api.netlify.com/api/v1/user', {
            headers: {
              'Authorization': `Bearer ${netlifyConfig.access_token}`,
            },
          });

          if (response.ok) {
            return {
              success: true,
              message: 'Netlify conectado correctamente',
            };
          } else {
            return {
              success: false,
              message: 'Token de Netlify inválido',
            };
          }
        }

        default:
          return {
            success: false,
            message: 'Conector no soportado',
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  // Get connector status summary
  async getConnectorsSummary(): Promise<{
    total: number;
    configured: number;
    missing: number;
    connectors: {
      type: string;
      configured: boolean;
      lastUpdated?: string;
    }[];
  }> {
    const allConfigs = await this.getAllConfigs();
    const requiredConnectors = ['github', 'netlify'];

    const connectorStatus = requiredConnectors.map(type => {
      const config = allConfigs.find(c => c.connector_type === type);
      return {
        type,
        configured: !!config,
        lastUpdated: config?.updated_at,
      };
    });

    return {
      total: requiredConnectors.length,
      configured: connectorStatus.filter(c => c.configured).length,
      missing: connectorStatus.filter(c => !c.configured).length,
      connectors: connectorStatus,
    };
  }
}

export const connectorsService = new ConnectorsService();
export type { ConnectorConfig, GitHubConfig, NetlifyConfig };
