// Utility functions for handling authentication tokens and callbacks

export interface AuthTokenData {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
    metadata: Record<string, any>;
    last_login: string;
  };
  application: {
    id: string;
    name: string;
    domain: string;
  };
  expires_in: number;
}

/**
 * Parse callback URL parameters to extract authentication data
 */
export function parseCallbackParams(url: string): AuthTokenData | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    const accessToken = params.get('token');
    const refreshToken = params.get('refresh_token');
    const userId = params.get('user_id');
    const userEmail = params.get('user_email');
    const userName = params.get('user_name');
    const expiresIn = params.get('expires_in');
    
    if (!accessToken || !refreshToken || !userId) {
      return null;
    }
    
    // Decode JWT to get additional user data (simplified for demo)
    const tokenPayload = parseJWT(accessToken);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: userId,
        email: userEmail || tokenPayload?.email || '',
        name: decodeURIComponent(userName || tokenPayload?.name || ''),
        roles: tokenPayload?.roles || ['user'],
        permissions: tokenPayload?.permissions || ['read'],
        metadata: tokenPayload?.metadata || {},
        last_login: new Date().toISOString()
      },
      application: {
        id: tokenPayload?.app_id || '',
        name: tokenPayload?.app_name || '',
        domain: tokenPayload?.aud || ''
      },
      expires_in: parseInt(expiresIn || '86400')
    };
  } catch (error) {
    console.error('Error parsing callback params:', error);
    return null;
  }
}

/**
 * Simple JWT parser (for demo purposes - use proper JWT library in production)
 */
export function parseJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

/**
 * Store authentication data in localStorage
 */
export function storeAuthData(authData: AuthTokenData): void {
  localStorage.setItem('auth_token', authData.access_token);
  localStorage.setItem('refresh_token', authData.refresh_token);
  localStorage.setItem('user_data', JSON.stringify(authData.user));
  localStorage.setItem('application_data', JSON.stringify(authData.application));
  localStorage.setItem('token_expires_at', new Date(Date.now() + authData.expires_in * 1000).toISOString());
}

/**
 * Get stored authentication data
 */
export function getStoredAuthData(): AuthTokenData | null {
  try {
    const accessToken = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userData = localStorage.getItem('user_data');
    const applicationData = localStorage.getItem('application_data');
    const expiresAt = localStorage.getItem('token_expires_at');
    
    if (!accessToken || !refreshToken || !userData) {
      return null;
    }
    
    const expiresIn = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: JSON.parse(userData),
      application: JSON.parse(applicationData || '{}'),
      expires_in: expiresIn
    };
  } catch (error) {
    console.error('Error getting stored auth data:', error);
    return null;
  }
}

/**
 * Clear stored authentication data
 */
export function clearAuthData(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');
  localStorage.removeItem('application_data');
  localStorage.removeItem('token_expires_at');
}

/**
 * Check if user is authenticated and token is valid
 */
export function isAuthenticated(): boolean {
  const authData = getStoredAuthData();
  return authData !== null && authData.expires_in > 0;
}

/**
 * Verify token with the API
 */
export async function verifyToken(token: string, applicationId: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        token,
        application_id: applicationId
      })
    });
    
    const result = await response.json();
    return result.success && result.data?.valid;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}