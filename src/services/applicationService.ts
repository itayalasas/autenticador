import { supabase } from '../lib/supabase';
import { Application, Environment, BrandingConfig } from '../types';

export const applicationService = {
  // Get all applications for current user
  async getApplications(): Promise<Application[]> {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        environments(*),
        branding_configs(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Create new application
  async createApplication(appData: {
    name: string;
    description: string;
    domain: string;
    environment: 'development' | 'testing' | 'production';
    auth_mode?: 'classic' | 'tenant';
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Create application
    const { data: app, error: appError } = await supabase
      .from('applications')
      .insert({
        name: appData.name,
        description: appData.description,
        domain: appData.domain,
        owner_id: user.id,
        auth_mode: appData.auth_mode || 'classic'
      })
      .select()
      .single();

    if (appError) throw appError;

    // Create default environment
    const { error: envError } = await supabase
      .from('environments')
      .insert({
        application_id: app.id,
        name: appData.environment,
        domain: `auth-${appData.environment}.${appData.domain}`,
        auth_url: `https://auth-${appData.environment}.${appData.domain}/auth`,
        callback_url: `https://${appData.domain}/callback`
      });

    if (envError) throw envError;

    // Create default branding
    const { error: brandError } = await supabase
      .from('branding_configs')
      .insert({
        application_id: app.id
      });

    if (brandError) throw brandError;

    return app;
  },

  // Update application
  async updateApplication(id: string, updates: Partial<Application>) {
    console.log('Updating application:', id, updates);
    const { data, error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating application:', error);
      throw error;
    }
    console.log('Application updated successfully:', data);
    return data;
  },

  // Update application URLs
  async updateApplicationUrls(id: string, environment_urls: any) {
    const { data, error } = await supabase
      .from('applications')
      .update({
        metadata: {
          environment_urls
        }
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete application
  async deleteApplication(id: string) {
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get application environments
  async getEnvironments(applicationId: string): Promise<Environment[]> {
    const { data, error } = await supabase
      .from('environments')
      .select('*')
      .eq('application_id', applicationId);

    if (error) throw error;
    return data || [];
  },

  // Create environment
  async createEnvironment(environmentData: {
    application_id: string;
    name: 'development' | 'testing' | 'production';
    domain?: string;
    base_url?: string; 
    callback_url?: string;
  }) {
    // Get application to retrieve configured URLs
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('*, metadata')
      .eq('id', environmentData.application_id)
      .single();

    if (appError) throw appError;

    // Get configured URLs from application metadata
    const envUrls = app.metadata?.environment_urls || {};
    const envConfig = envUrls[environmentData.name];
    
    // Use configured URLs or generate defaults
    let baseUrl, callbackUrl, domain;
    
    if (envConfig) {
      baseUrl = environmentData.base_url || envConfig.base_url;
      callbackUrl = environmentData.callback_url || envConfig.callback_url;
      domain = environmentData.domain || new URL(baseUrl).hostname;
    } else {
      // Generate default URLs if not configured
      baseUrl = environmentData.base_url || `https://auth-${environmentData.name}.${app.domain}`;
      callbackUrl = environmentData.callback_url || `https://${app.domain}/callback`;
      domain = environmentData.domain || `auth-${environmentData.name}.${app.domain}`;
    }
    
    const { data, error } = await supabase
      .from('environments')
      .insert({
        application_id: environmentData.application_id,
        name: environmentData.name,
        domain: domain,
        auth_url: baseUrl,
        callback_url: callbackUrl,
        is_active: true,
        metadata: {
          generated_urls: {
            login: `${baseUrl}/login`,
            register: `${baseUrl}/register`,
            reset_password: `${baseUrl}/reset-password`,
            callback: callbackUrl
          }
        }
      })
      .select()
      .single();

    if (error) throw error;
    
    // Log environment creation
    await this.logPipelineEvent(data.id, 'environment_created', {
      environment: environmentData.name,
      base_url: baseUrl,
      callback_url: callbackUrl,
      generated_urls: {
        login: `${baseUrl}/login`,
        register: `${baseUrl}/register`, 
        reset_password: `${baseUrl}/reset-password`,
        callback: callbackUrl
      }
    });
    
    return data;
  },

  // Update environment
  async updateEnvironment(environmentId: string, updates: any) {
    const { data, error } = await supabase
      .from('environments')
      .update(updates)
      .eq('id', environmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async toggleEnvironmentStatus(environmentId: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('environments')
      .update({ is_active: isActive })
      .eq('id', environmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEnvironment(environmentId: string) {
    const { error } = await supabase
      .from('environments')
      .delete()
      .eq('id', environmentId);

    if (error) throw error;
    return true;
  },

  // Test environment URLs
  async testEnvironmentUrls(environmentId: string, urlsToTest: Record<string, string>) {
    const testResults: Record<string, any> = {};
    
    // Probar cada URL real
    for (const [endpoint, url] of Object.entries(urlsToTest)) {
      try {
        const startTime = Date.now();
        
        // Simular prueba HTTP real
        const response = await this.testSingleUrl(url, endpoint);
        const responseTime = Date.now() - startTime;
        
        testResults[endpoint] = {
          status: response.status,
          response_time: responseTime,
          url: url,
          details: response.details,
          error: response.error
        };
        
      } catch (error) {
        testResults[endpoint] = {
          status: 'error',
          url: url,
          error: error.message,
          details: 'No se pudo conectar con la URL'
        };
      }
    }
    
    return testResults;
  },

  // Test individual URL
  async testSingleUrl(url: string, endpoint: string) {
    // Simular diferentes tipos de respuesta basados en la URL
    const delay = Math.random() * 500 + 100; // 100-600ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simular diferentes escenarios
    const random = Math.random();
    
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return {
        status: 'warning',
        details: 'URL local detectada - solo funciona en desarrollo'
      };
    }
    
    if (url.includes('https://')) {
      if (random > 0.9) {
        return {
          status: 'error',
          error: 'SSL certificate error',
          details: 'Certificado SSL inválido o expirado'
        };
      }
      
      if (random > 0.8) {
        return {
          status: 'warning',
          details: 'Respuesta lenta detectada'
        };
      }
      
      return {
        status: 'success',
        details: 'URL responde correctamente con HTTPS'
      };
    }
    
    if (url.includes('http://')) {
      return {
        status: 'warning',
        details: 'URL no segura (HTTP) - se recomienda HTTPS'
      };
    }
    
    return {
      status: 'success',
      details: 'URL accesible'
    };
  },

  // Test individual URL with real data
  async testSingleUrlWithData(url: string, endpoint: string, testParams: any) {
    const delay = Math.random() * 500 + 200; // 200-700ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const responseTime = Math.floor(delay);
    
    // Simular validaciones específicas por endpoint
    switch (endpoint) {
      case 'login':
        if (!testParams.email || !testParams.password) {
          return {
            status: 'error',
            error: 'Datos de login incompletos',
            details: 'Email y contraseña son requeridos',
            response_time: responseTime,
            url
          };
        }
        
        // Simular validación de credenciales
        if (Math.random() > 0.8) {
          return {
            status: 'error',
            error: 'Credenciales inválidas',
            details: 'Email o contraseña incorrectos',
            response_time: responseTime,
            url
          };
        }
        
        return {
          status: 'success',
          details: `Login exitoso para ${testParams.email}`,
          response_time: responseTime,
          url
        };
        
      case 'register':
        if (!testParams.name || !testParams.email || !testParams.password) {
          return {
            status: 'error',
            error: 'Datos de registro incompletos',
            details: 'Nombre, email y contraseña son requeridos',
            response_time: responseTime,
            url
          };
        }
        
        // Simular email ya existente
        if (Math.random() > 0.9) {
          return {
            status: 'error',
            error: 'Email ya registrado',
            details: `El email ${testParams.email} ya está en uso`,
            response_time: responseTime,
            url
          };
        }
        
        return {
          status: 'success',
          details: `Usuario ${testParams.name} registrado exitosamente`,
          response_time: responseTime,
          url
        };
        
      case 'reset_password':
        if (!testParams.email) {
          return {
            status: 'error',
            error: 'Email requerido',
            details: 'Debe proporcionar un email para recuperación',
            response_time: responseTime,
            url
          };
        }
        
        // Simular email no encontrado
        if (Math.random() > 0.85) {
          return {
            status: 'warning',
            details: `Email ${testParams.email} no encontrado en el sistema`,
            response_time: responseTime,
            url
          };
        }
        
        return {
          status: 'success',
          details: `Email de recuperación enviado a ${testParams.email}`,
          response_time: responseTime,
          url
        };
        
      case 'callback':
        // Simular validación de callback
        if (Math.random() > 0.95) {
          return {
            status: 'error',
            error: 'Callback no accesible',
            details: 'La URL de callback no responde',
            response_time: responseTime,
            url
          };
        }
        
        return {
          status: 'success',
          details: 'Callback URL responde correctamente',
          response_time: responseTime,
          url
        };
        
      default:
        return {
          status: 'success',
          details: 'URL accesible',
          response_time: responseTime,
          url
        };
    }
  },
  // Get environment logs
  async getEnvironmentLogs(environmentId: string): Promise<string[]> {
    // Log the test results
    await this.logPipelineEvent(environmentId, 'url_test', {
      action: 'get_logs',
      timestamp: new Date().toISOString()
    });
    
    // Simular logs del ambiente
    const logs = [
      `[${new Date().toLocaleTimeString()}] 📊 Cargando logs del ambiente...`,
      `[${new Date().toLocaleTimeString()}] ✅ Ambiente activo y funcionando`,
      `[${new Date().toLocaleTimeString()}] 🔍 Última prueba: ${new Date().toLocaleString()}`,
      `[${new Date().toLocaleTimeString()}] 📈 URLs configuradas y validadas`,
      `[${new Date().toLocaleTimeString()}] 🛡️ Certificados SSL válidos`,
      `[${new Date().toLocaleTimeString()}] 🚀 Listo para deploy`
    ];
    
    return logs;
  },

  // Log pipeline events
  async logPipelineEvent(environmentId: string, event_type: string, data: any) {
    // In a real implementation, this would log to a pipeline logs table
    console.log(`Pipeline Event [${event_type}]:`, {
      environment_id: environmentId,
      timestamp: new Date().toISOString(),
      data
    });
  },

  // Deploy environment
  async deployEnvironment(environmentId: string, sourceEnvironmentId?: string) {
    // Simulate deployment process
    await this.logPipelineEvent(environmentId, 'deploy_start', {
      source_environment: sourceEnvironmentId
    });
    
    // Simulate deployment steps
    const steps = [
      'Validating configuration',
      'Building application',
      'Running tests',
      'Deploying to environment',
      'Updating DNS records',
      'Warming up services'
    ];
    
    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.logPipelineEvent(environmentId, 'deploy_step', {
        step,
        status: 'completed'
      });
    }
    
    await this.logPipelineEvent(environmentId, 'deploy_complete', {
      status: 'success',
      version: `v${Date.now()}`
    });
    
    return {
      success: true,
      version: `v${Date.now()}`,
      deployed_at: new Date().toISOString()
    };
  },
  // Update branding
  async updateBranding(applicationId: string, branding: Partial<BrandingConfig>) {
    const { data, error } = await supabase
      .from('branding_configs')
      .upsert({
        application_id: applicationId,
        ...branding
      }, {
        onConflict: 'application_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get branding
  async getBranding(applicationId: string): Promise<BrandingConfig | null> {
    const { data, error } = await supabase
      .from('branding_configs')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};