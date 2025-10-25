import { getEnvVariable } from './envConfigService';

export const ipService = {
  async getClientIP(): Promise<string> {
    try {
      // Try to get IP from a public IP service
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Detected client IP:', data.ip);
        return data.ip;
      }
    } catch (error) {
      console.error('Error detecting client IP:', error);
    }

    return '0.0.0.0';
  },

  async checkIPStatus(clientIp?: string): Promise<{
    is_blocked: boolean;
    blocked_info: any;
    ip_address: string;
  }> {
    try {
      // Get IP if not provided
      const ipToCheck = clientIp || await this.getClientIP();

      const supabaseUrl = getEnvVariable('VITE_SUPABASE_URL');
      const supabaseAnonKey = getEnvVariable('VITE_SUPABASE_ANON_KEY');
      const apiUrl = `${supabaseUrl}/functions/v1/check-ip-status`;

      console.log('🔍 Checking IP status for:', ipToCheck);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ client_ip: ipToCheck })
      });

      console.log('📡 Response status:', response.status);

      const result = await response.json();
      console.log('📦 Response data:', result);

      if (result.success) {
        return {
          is_blocked: result.data.is_blocked,
          blocked_info: result.data.blocked_info,
          ip_address: result.data.ip_address
        };
      }

      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: ipToCheck
      };
    } catch (error) {
      console.error('❌ Error checking IP status:', error);
      return {
        is_blocked: false,
        blocked_info: null,
        ip_address: '0.0.0.0'
      };
    }
  }
};
