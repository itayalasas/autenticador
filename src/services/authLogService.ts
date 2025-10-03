import { supabase } from '../lib/supabase';

const DASHBOARD_APP_ID = '3acde27f-74d3-465e-aaec-94ad46faa881';

interface LogAuthEventParams {
  event_type: 'login' | 'register' | 'logout' | 'password_reset' | 'failed_login';
  userId?: string;
  email?: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

export const authLogService = {
  async logDashboardAuthEvent(params: LogAuthEventParams) {
    try {
      const ip_address = await this.getClientIP();
      const user_agent = navigator.userAgent;

      await supabase.from('auth_logs').insert({
        application_id: DASHBOARD_APP_ID,
        app_user_id: params.userId || null,
        event_type: params.event_type,
        ip_address,
        user_agent,
        success: params.success,
        error_message: params.error_message || null,
        metadata: {
          ...params.metadata,
          email: params.email,
          source: 'dashboard',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging auth event:', error);
    }
  },

  async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  },

  async logLogin(userId: string, email: string, success: boolean, error_message?: string) {
    await this.logDashboardAuthEvent({
      event_type: success ? 'login' : 'failed_login',
      userId: success ? userId : undefined,
      email,
      success,
      error_message,
      metadata: { login_method: 'email_password' }
    });
  },

  async logRegister(userId: string, email: string, success: boolean, error_message?: string) {
    await this.logDashboardAuthEvent({
      event_type: 'register',
      userId: success ? userId : undefined,
      email,
      success,
      error_message,
      metadata: { registration_method: 'email_password' }
    });
  },

  async logLogout(userId: string, email: string) {
    await this.logDashboardAuthEvent({
      event_type: 'logout',
      userId,
      email,
      success: true,
      metadata: { logout_method: 'manual' }
    });
  }
};
