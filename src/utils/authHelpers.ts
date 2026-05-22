import { requireSupabaseAnonKey, requireSupabaseUrl } from '../lib/supabaseRuntime';

// Utility functions for handling authentication sessions and callback exchanges

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

export interface CallbackExchangeParams {
  code: string;
  application_id?: string;
}

export interface CallbackUrlParams extends CallbackExchangeParams {
  state: string | null;
}

export function extractCallbackExchangeParams(url: string): CallbackUrlParams | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const code = params.get('code');
    const applicationId = params.get('application_id') || params.get('app_id') || undefined;

    if (!code) {
      return null;
    }

    return {
      code,
      application_id: applicationId,
      state: params.get('state')
    };
  } catch (error) {
    console.error('Error parsing callback exchange params:', error);
    return null;
  }
}

/**
 * Legacy helper kept for backward compatibility.
 * The secure callback flow now relies on code exchange rather than direct token parsing.
 */
export function parseCallbackParams(_url: string): AuthTokenData | null {
  console.warn('parseCallbackParams is deprecated. Use extractCallbackExchangeParams + exchangeCallbackCode instead.');
  return null;
}

function normalizePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([menuSlug, actions]) => {
      if (!Array.isArray(actions)) {
        return [];
      }

      return actions
        .map((action) => `${menuSlug}:${typeof action === 'string' ? action : String(action)}`)
        .filter(Boolean);
    });
  }

  return ['read'];
}

/**
 * Exchange an authorization code for a full auth session using the backend.
 */
export async function exchangeCallbackCode(params: CallbackExchangeParams): Promise<AuthTokenData> {
  const supabaseUrl = requireSupabaseUrl();
  const anonKey = requireSupabaseAnonKey();

  const response = await fetch(`${supabaseUrl}/functions/v1/auth-exchange-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey
    },
    body: JSON.stringify(params)
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error?.message || 'No se pudo completar el intercambio de código');
  }

  const data = result.data || {};
  const user = data.user || {};
  const application = data.application || {};

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: {
      id: user.id || '',
      email: user.email || '',
      name: user.name || '',
      roles: Array.isArray(user.roles)
        ? user.roles
        : user.role
          ? [user.role]
          : ['user'],
      permissions: normalizePermissions(user.permissions),
      metadata: user.metadata || {},
      last_login: new Date().toISOString()
    },
    application: {
      id: application.id || params.application_id || '',
      name: application.name || '',
      domain: application.domain || ''
    },
    expires_in: Number(data.expires_in || 86400)
  };
}

function getAuthStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage || window.localStorage || null;
}

function getFallbackStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
}

/**
 * Store authentication data in sessionStorage to reduce persistence risk.
 */
export function storeAuthData(authData: AuthTokenData): void {
  const storage = getAuthStorage();
  if (!storage) return;

  storage.setItem('auth_token', authData.access_token);
  storage.setItem('refresh_token', authData.refresh_token);
  storage.setItem('user_data', JSON.stringify(authData.user));
  storage.setItem('application_data', JSON.stringify(authData.application));
  storage.setItem('token_expires_at', new Date(Date.now() + authData.expires_in * 1000).toISOString());
}

/**
 * Get stored authentication data
 */
export function getStoredAuthData(): AuthTokenData | null {
  try {
    const sessionStorageRef = getAuthStorage();
    const fallbackStorage = getFallbackStorage();

    const readValue = (key: string) =>
      sessionStorageRef?.getItem(key) || fallbackStorage?.getItem(key) || null;

    const accessToken = readValue('auth_token');
    const refreshToken = readValue('refresh_token');
    const userData = readValue('user_data');
    const applicationData = readValue('application_data');
    const expiresAt = readValue('token_expires_at');

    if (!accessToken || !refreshToken || !userData) {
      return null;
    }

    const expiresIn = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;

    const parsedUser = JSON.parse(userData);
    const parsedApplication = JSON.parse(applicationData || '{}');

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: parsedUser?.id || '',
        email: parsedUser?.email || '',
        name: parsedUser?.name || '',
        roles: Array.isArray(parsedUser?.roles) ? parsedUser.roles : ['user'],
        permissions: Array.isArray(parsedUser?.permissions) ? parsedUser.permissions : [],
        metadata: parsedUser?.metadata || {},
        last_login: parsedUser?.last_login || new Date().toISOString()
      },
      application: {
        id: parsedApplication?.id || '',
        name: parsedApplication?.name || '',
        domain: parsedApplication?.domain || ''
      },
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
  const sessionStorageRef = typeof window !== 'undefined' ? window.sessionStorage : null;
  const fallbackStorage = typeof window !== 'undefined' ? window.localStorage : null;

  const keys = ['auth_token', 'refresh_token', 'user_data', 'application_data', 'token_expires_at'];
  keys.forEach((key) => {
    sessionStorageRef?.removeItem(key);
    fallbackStorage?.removeItem(key);
  });
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
