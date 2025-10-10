import { supabase } from '../lib/supabase';

export interface EnvironmentVariable {
  id: string;
  application_id: string;
  environment_id?: string;
  key: string;
  value: string;
  is_secret: boolean;
  is_global: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

class EnvironmentVariablesService {
  async getVariablesForApplication(applicationId: string): Promise<EnvironmentVariable[]> {
    const { data, error } = await supabase
      .from('environment_variables')
      .select('*')
      .eq('application_id', applicationId)
      .order('key');

    if (error) throw error;
    return data || [];
  }

  async getVariablesForEnvironment(
    applicationId: string,
    environmentId: string
  ): Promise<EnvironmentVariable[]> {
    const { data, error } = await supabase
      .from('environment_variables')
      .select('*')
      .eq('application_id', applicationId)
      .or(`environment_id.eq.${environmentId},is_global.eq.true`)
      .order('key');

    if (error) throw error;
    return data || [];
  }

  async getGlobalVariables(applicationId: string): Promise<EnvironmentVariable[]> {
    const { data, error } = await supabase
      .from('environment_variables')
      .select('*')
      .eq('application_id', applicationId)
      .eq('is_global', true)
      .order('key');

    if (error) throw error;
    return data || [];
  }

  async upsertVariable(variable: Partial<EnvironmentVariable>): Promise<EnvironmentVariable> {
    const { data, error } = await supabase
      .from('environment_variables')
      .upsert(variable)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteVariable(id: string): Promise<void> {
    const { error } = await supabase
      .from('environment_variables')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async initializeDefaultVariables(applicationId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const dlocalApiUrl = import.meta.env.VITE_DLOCAL_API_URL;
    const dlocalCheckoutUrl = import.meta.env.VITE_DLOCAL_CHECKOUT_URL;
    const dlocalApiKey = import.meta.env.VITE_DLOCAL_API_KEY;
    const dlocalSecretKey = import.meta.env.VITE_DLOCAL_SECRET_KEY;
    const dlocalPlansEndpoint = import.meta.env.VITE_DLOCAL_PLANS_ENDPOINT;

    const defaultVariables = [
      {
        application_id: applicationId,
        key: 'VITE_SUPABASE_URL',
        value: supabaseUrl || '',
        is_secret: false,
        is_global: true,
        description: 'URL de Supabase para autenticación y base de datos',
      },
      {
        application_id: applicationId,
        key: 'VITE_SUPABASE_ANON_KEY',
        value: supabaseAnonKey || '',
        is_secret: true,
        is_global: true,
        description: 'Clave anónima de Supabase para autenticación',
      },
      {
        application_id: applicationId,
        key: 'VITE_DLOCAL_API_URL',
        value: dlocalApiUrl || 'https://api-sbx.dlocalgo.com',
        is_secret: false,
        is_global: true,
        description: 'URL de la API de dLocal',
      },
      {
        application_id: applicationId,
        key: 'VITE_DLOCAL_CHECKOUT_URL',
        value: dlocalCheckoutUrl || 'https://checkout-sbx.dlocalgo.com',
        is_secret: false,
        is_global: true,
        description: 'URL del checkout de dLocal',
      },
      {
        application_id: applicationId,
        key: 'VITE_DLOCAL_API_KEY',
        value: dlocalApiKey || '',
        is_secret: true,
        is_global: true,
        description: 'API Key de dLocal para pagos',
      },
      {
        application_id: applicationId,
        key: 'VITE_DLOCAL_SECRET_KEY',
        value: dlocalSecretKey || '',
        is_secret: true,
        is_global: true,
        description: 'Secret Key de dLocal para pagos',
      },
      {
        application_id: applicationId,
        key: 'VITE_DLOCAL_PLANS_ENDPOINT',
        value: dlocalPlansEndpoint || 'v1/subscription/plan/all',
        is_secret: false,
        is_global: true,
        description: 'Endpoint para obtener planes de suscripción de dLocal',
      },
    ];

    for (const variable of defaultVariables) {
      if (variable.value) {
        try {
          await this.upsertVariable(variable);
        } catch (error) {
          console.error(`Error upserting variable ${variable.key}:`, error);
        }
      }
    }
  }

  buildEnvFileContent(variables: EnvironmentVariable[]): string {
    const lines = variables.map(v => `${v.key}=${v.value}`);
    return lines.join('\n');
  }

  buildNetlifyEnvObject(variables: EnvironmentVariable[]): Record<string, string> {
    const envObject: Record<string, string> = {};
    variables.forEach(v => {
      envObject[v.key] = v.value;
    });
    return envObject;
  }
}

export const environmentVariablesService = new EnvironmentVariablesService();
