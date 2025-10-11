import { supabase } from '../lib/supabase';

export interface DeploymentLog {
  id: string;
  environment_id: string;
  application_id: string;
  user_id: string;
  deployment_type: 'deploy' | 'test' | 'validate';
  status: 'running' | 'success' | 'failed' | 'partial';
  logs: LogEntry[];
  test_results: Record<string, any>;
  metadata: Record<string, any>;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export const deploymentLogService = {
  // Create a new deployment log
  async createDeploymentLog(data: {
    environment_id: string;
    application_id: string;
    deployment_type?: 'deploy' | 'test' | 'validate';
    metadata?: Record<string, any>;
  }): Promise<DeploymentLog> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: log, error } = await supabase
      .from('deployment_logs')
      .insert({
        environment_id: data.environment_id,
        application_id: data.application_id,
        user_id: user.id,
        deployment_type: data.deployment_type || 'deploy',
        status: 'running',
        logs: [],
        test_results: {},
        metadata: data.metadata || {},
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return log;
  },

  // Add a log entry to an existing deployment log
  async addLogEntry(deploymentLogId: string, entry: Omit<LogEntry, 'id'>): Promise<void> {
    // Get current logs
    const { data: currentLog, error: fetchError } = await supabase
      .from('deployment_logs')
      .select('logs')
      .eq('id', deploymentLogId)
      .single();

    if (fetchError) throw fetchError;

    const logs = currentLog?.logs || [];
    const newEntry = {
      ...entry,
      id: Date.now().toString()
    };

    // Update with new log entry
    const { error: updateError } = await supabase
      .from('deployment_logs')
      .update({
        logs: [...logs, newEntry]
      })
      .eq('id', deploymentLogId);

    if (updateError) throw updateError;
  },

  // Update deployment log status and results
  async updateDeploymentLog(
    deploymentLogId: string,
    updates: {
      status?: 'running' | 'success' | 'failed' | 'partial';
      test_results?: Record<string, any>;
      metadata?: Record<string, any>;
      completed_at?: string;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('deployment_logs')
      .update(updates)
      .eq('id', deploymentLogId);

    if (error) throw error;
  },

  // Get deployment logs for an environment
  async getDeploymentLogs(environmentId: string, limit: number = 10): Promise<DeploymentLog[]> {
    const { data, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('environment_id', environmentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Get a single deployment log by ID
  async getDeploymentLog(deploymentLogId: string): Promise<DeploymentLog | null> {
    const { data, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .eq('id', deploymentLogId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  // Get all deployment logs for a user
  async getUserDeploymentLogs(limit: number = 20): Promise<DeploymentLog[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('deployment_logs')
      .select(`
        *,
        environments(name, domain),
        applications(name, domain)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Delete old deployment logs (cleanup)
  async deleteOldLogs(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from('deployment_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
  },

  // Monitor Netlify deploy status and update deployment log
  async monitorNetlifyDeploy(
    deploymentLogId: string,
    siteId: string,
    onUpdate?: (status: string, message: string) => void
  ): Promise<{
    success: boolean;
    finalState: string;
    logs: string;
  }> {
    const { netlifyService } = await import('./netlifyService');

    try {
      onUpdate?.('running', 'Obteniendo último deploy de Netlify...');

      const latestDeploy = await netlifyService.getLatestDeploy(siteId);

      if (!latestDeploy) {
        throw new Error('No se encontró ningún deploy en Netlify');
      }

      onUpdate?.('running', `Deploy ID: ${latestDeploy.id.substring(0, 8)}... - Estado: ${netlifyService.getDeployStateLabel(latestDeploy.state)}`);

      let currentDeploy = latestDeploy;
      let attempts = 0;
      const maxAttempts = 60;

      while (!netlifyService.isDeployCompleted(currentDeploy.state) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000));

        const updated = await netlifyService.getDeploy(siteId, latestDeploy.id);
        currentDeploy = updated;
        attempts++;

        const stateLabel = netlifyService.getDeployStateLabel(currentDeploy.state);
        onUpdate?.('running', `${stateLabel} (${attempts}/${maxAttempts})...`);

        await this.addLogEntry(deploymentLogId, {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Netlify build status: ${stateLabel}`
        });
      }

      const deployLogs = await netlifyService.getDeployLogs(siteId, latestDeploy.id);

      const success = netlifyService.isDeploySuccessful(currentDeploy.state);
      const finalStatus = success ? 'success' : 'failed';

      await this.updateDeploymentLog(deploymentLogId, {
        status: finalStatus as any,
        completed_at: new Date().toISOString(),
        metadata: {
          netlify_deploy_id: currentDeploy.id,
          netlify_state: currentDeploy.state,
          netlify_url: currentDeploy.ssl_url || currentDeploy.url,
          netlify_logs: deployLogs.substring(0, 5000),
          error_message: currentDeploy.error_message
        }
      });

      if (success) {
        await this.addLogEntry(deploymentLogId, {
          timestamp: new Date().toISOString(),
          level: 'success',
          message: `✅ Deploy completado exitosamente: ${currentDeploy.ssl_url || currentDeploy.url}`
        });
      } else {
        await this.addLogEntry(deploymentLogId, {
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `❌ Deploy falló: ${currentDeploy.error_message || 'Error desconocido'}`
        });
      }

      onUpdate?.(finalStatus, success ? 'Deploy completado exitosamente' : 'Deploy falló');

      return {
        success,
        finalState: currentDeploy.state,
        logs: deployLogs
      };
    } catch (error: any) {
      await this.addLogEntry(deploymentLogId, {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `❌ Error monitoreando deploy: ${error.message}`
      });

      await this.updateDeploymentLog(deploymentLogId, {
        status: 'failed',
        completed_at: new Date().toISOString()
      });

      onUpdate?.('failed', `Error: ${error.message}`);

      return {
        success: false,
        finalState: 'error',
        logs: error.message
      };
    }
  }
};
