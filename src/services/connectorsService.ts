import { supabase } from '../lib/supabase';

interface ConnectorConfig {
  id: string;
  user_id: string;
  connector_type: 'github' | 'netlify' | 'azure_container_apps' | 'gitlab' | 'bitbucket' | 'stripe' | 'dlocal';
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

interface AzureContainerAppsConfig {
  tenant_id: string;
  subscription_id: string;
  client_id: string;
  client_secret: string;
  resource_group: string;
  location: string;
  containerapps_environment?: string;
  oidc_audience?: string;
  auth_mode?: 'service_principal' | 'oidc';
}

class ConnectorsService {
  private extractGuid(value: string): string {
    const normalizedValue = String(value || '').trim();
    const match = normalizedValue.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return match ? match[0] : normalizedValue;
  }

  private normalizeAzureContainerAppsConfig(config: AzureContainerAppsConfig): AzureContainerAppsConfig {
    const authMode = config.auth_mode === 'oidc' ? 'oidc' : 'service_principal';

    return {
      tenant_id: this.extractGuid(config.tenant_id),
      subscription_id: this.extractGuid(config.subscription_id),
      client_id: this.extractGuid(config.client_id),
      client_secret: config.client_secret.trim(),
      resource_group: config.resource_group.trim(),
      location: config.location.trim(),
      containerapps_environment: config.containerapps_environment?.trim() || undefined,
      oidc_audience: config.oidc_audience?.trim() || 'api://AzureADTokenExchange',
      auth_mode: authMode,
    };
  }

  private async extractEdgeFunctionErrorMessage(error: any): Promise<string> {
    const fallbackMessage = error?.message || 'No se pudo validar Azure Container Apps';
    const response = error?.context;

    if (!(response instanceof Response)) {
      return fallbackMessage;
    }

    const payload = await response.clone().json().catch(async () => ({
      message: await response.text().catch(() => ''),
    }));

    const detail = payload?.error?.detail;
    const message = payload?.error?.message || payload?.message || fallbackMessage;

    if (!detail) {
      return message;
    }

    if (typeof detail === 'string') {
      try {
        const parsedDetail = JSON.parse(detail);
        const azureMessage =
          parsedDetail?.error_description ||
          parsedDetail?.error?.message ||
          parsedDetail?.message;

        if (azureMessage) {
          return `${message}: ${azureMessage}`;
        }
      } catch {
        return `${message}: ${detail}`;
      }
    }

    if (typeof detail === 'object') {
      const azureMessage =
        detail?.error_description ||
        detail?.error?.message ||
        detail?.message;

      if (azureMessage) {
        return `${message}: ${azureMessage}`;
      }
    }

    return message;
  }

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

  // Azure Container Apps specific methods
  async saveAzureContainerAppsConfig(config: AzureContainerAppsConfig): Promise<ConnectorConfig> {
    return this.saveConfig('azure_container_apps', this.normalizeAzureContainerAppsConfig(config));
  }

  async getAzureContainerAppsConfig(): Promise<AzureContainerAppsConfig | null> {
    const config = await this.getConfig('azure_container_apps');
    return config ? config.config_data as AzureContainerAppsConfig : null;
  }

  async isAzureContainerAppsConfigured(): Promise<boolean> {
    const config = await this.getAzureContainerAppsConfig();
    const requiresClientSecret = config?.auth_mode !== 'oidc';
    return !!(
      config?.tenant_id &&
      config?.subscription_id &&
      config?.client_id &&
      config?.resource_group &&
      config?.location &&
      (!requiresClientSecret || config?.client_secret)
    );
  }

  async testAzureContainerAppsConfig(config: AzureContainerAppsConfig): Promise<{
    success: boolean;
    message: string;
  }> {
    const azureConfig = this.normalizeAzureContainerAppsConfig(config);
    const requiresClientSecret = azureConfig.auth_mode !== 'oidc';

    if (
      !azureConfig.tenant_id ||
      !azureConfig.subscription_id ||
      !azureConfig.client_id ||
      !azureConfig.resource_group ||
      !azureConfig.location ||
      (requiresClientSecret && !azureConfig.client_secret)
    ) {
      return {
        success: false,
        message: 'Faltan credenciales de Azure',
      };
    }

    if (!requiresClientSecret) {
      return {
        success: true,
        message: 'Azure Container Apps configurado para OIDC correctamente',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('azure-test-connector', {
        body: azureConfig,
      });

      if (error) {
        return {
          success: false,
          message: await this.extractEdgeFunctionErrorMessage(error),
        };
      }

      if (!data?.success) {
        return {
          success: false,
          message: data?.error?.message || data?.message || 'No se pudo validar Azure Container Apps',
        };
      }

      return {
        success: true,
        message: data?.message || 'Azure Container Apps conectado correctamente',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  // Validate all required connectors for deployment
  async validateDeploymentConnectors(provider: 'netlify' | 'azure_container_apps' = 'netlify'): Promise<{
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

    if (provider === 'netlify') {
      const netlifyConfigured = await this.isNetlifyConfigured();
      if (!netlifyConfigured) {
        missing.push('Netlify');
      }
    }

    if (provider === 'azure_container_apps') {
      const azureConfigured = await this.isAzureContainerAppsConfigured();
      if (!azureConfigured) {
        missing.push('Azure Container Apps');
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      configured: configured.filter(c => ['github', 'netlify', 'azure_container_apps'].includes(c)),
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

        case 'azure_container_apps': {
          const azureConfig = config.config_data as AzureContainerAppsConfig;
          const requiresClientSecret = azureConfig.auth_mode !== 'oidc';
          if (
            !azureConfig.tenant_id ||
            !azureConfig.subscription_id ||
            !azureConfig.client_id ||
            !azureConfig.resource_group ||
            !azureConfig.location ||
            (requiresClientSecret && !azureConfig.client_secret)
          ) {
            return {
              success: false,
              message: 'Faltan credenciales de Azure',
            };
          }

          if (!requiresClientSecret) {
            return {
              success: true,
              message: 'Azure Container Apps configurado para OIDC correctamente',
            };
          }

          const tokenResponse = await fetch(`https://login.microsoftonline.com/${azureConfig.tenant_id}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: azureConfig.client_id,
              client_secret: azureConfig.client_secret,
              scope: 'https://management.azure.com/.default',
              grant_type: 'client_credentials',
            }),
          });

          if (!tokenResponse.ok) {
            return {
              success: false,
              message: 'Credenciales de Azure inválidas',
            };
          }

          const tokenPayload = await tokenResponse.json();
          const accessToken = tokenPayload?.access_token;
          if (!accessToken) {
            return {
              success: false,
              message: 'Azure no devolvió un access token válido',
            };
          }

          const subscriptionResponse = await fetch(
            `https://management.azure.com/subscriptions/${azureConfig.subscription_id}?api-version=2020-01-01`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (!subscriptionResponse.ok) {
            return {
              success: false,
              message: 'No se pudo validar la suscripción de Azure',
            };
          }

          return {
            success: true,
            message: 'Azure Container Apps conectado correctamente',
          };
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
    const requiredConnectors = ['github', 'netlify', 'azure_container_apps'];

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
export type { ConnectorConfig, GitHubConfig, NetlifyConfig, AzureContainerAppsConfig };
