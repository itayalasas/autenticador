import { requireSupabaseAnonKey, requireSupabaseUrl } from '../lib/supabaseRuntime';

// Utility functions for handling authentication sessions and callback exchanges

export interface AuthTokenData {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    roles: string[];
    permissions: unknown;
    permissions_hierarchy?: Record<string, any>;
    metadata: Record<string, any>;
    created_at?: string;
    last_login: string;
    tenant_id?: string;
    tenant_name?: string;
    tenant?: unknown;
    subscription?: unknown;
    license?: unknown;
    has_access?: boolean;
    available_plans?: unknown;
    environment?: string;
  };
  application: {
    id: string;
    name: string;
    domain: string;
    environment?: string;
  };
  expires_in: number;
}

export interface DecodedAuthClaims extends Record<string, any> {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  roles?: string[];
  permissions?: unknown;
  permissions_hierarchy?: Record<string, any>;
  app_id?: string;
  app_name?: string;
  app_domain?: string;
  user_metadata?: Record<string, any>;
  user_created_at?: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant?: unknown;
  subscription?: unknown;
  license?: unknown;
  has_access?: boolean;
  available_plans?: unknown;
  environment?: string;
  exp?: number;
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
    return null;
  }
}

/**
 * Legacy helper kept for backward compatibility.
 * The secure callback flow now relies on code exchange rather than direct token parsing.
 */
export function parseCallbackParams(_url: string): AuthTokenData | null {
  return null;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

export function decodeJwtClaims(token: string): DecodedAuthClaims {
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    throw new Error('Formato de token invalido');
  }

  const payload = decodeBase64Url(tokenParts[1]);
  const claims = JSON.parse(payload);

  if (!claims || typeof claims !== 'object') {
    throw new Error('Claims del token invalidos');
  }

  return claims as DecodedAuthClaims;
}

export function buildAuthDataFromTokenResponse(data: any, fallbackApplicationId?: string): AuthTokenData {
  const claims = decodeJwtClaims(String(data?.access_token || ''));
  const userRoles = Array.isArray(claims.roles)
    ? claims.roles
    : claims.role
      ? [claims.role]
      : ['user'];
  const expiresIn = typeof claims.exp === 'number'
    ? Math.max(0, claims.exp - Math.floor(Date.now() / 1000))
    : Number(data?.expires_in || 86400);

  return {
    access_token: String(data?.access_token || ''),
    refresh_token: String(data?.refresh_token || ''),
    user: {
      id: claims.sub || '',
      email: claims.email || '',
      name: claims.name || '',
      role: claims.role || userRoles[0] || 'user',
      roles: userRoles,
      permissions: claims.permissions || {},
      permissions_hierarchy: claims.permissions_hierarchy || {},
      metadata: claims.user_metadata || {},
      created_at: claims.user_created_at || undefined,
      last_login: new Date().toISOString(),
      tenant_id: claims.tenant_id || undefined,
      tenant_name: claims.tenant_name || undefined,
      tenant: claims.tenant || undefined,
      subscription: claims.subscription || undefined,
      license: claims.license || undefined,
      has_access: typeof claims.has_access === 'boolean' ? claims.has_access : undefined,
      available_plans: claims.available_plans || undefined,
      environment: claims.environment || undefined,
    },
    application: {
      id: claims.app_id || fallbackApplicationId || '',
      name: claims.app_name || '',
      domain: claims.app_domain || '',
      environment: claims.environment || undefined,
    },
    expires_in: expiresIn,
  };
}

export function storeTokenResponseAuthData(data: any, fallbackApplicationId?: string): AuthTokenData {
  const authData = buildAuthDataFromTokenResponse(data, fallbackApplicationId);
  storeAuthData(authData);
  return authData;
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
    throw new Error(result?.error?.message || 'No se pudo completar el intercambio de codigo');
  }

  return buildAuthDataFromTokenResponse(result.data || {}, params.application_id);
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
        role: parsedUser?.role || (Array.isArray(parsedUser?.roles) ? parsedUser.roles[0] : 'user'),
        roles: Array.isArray(parsedUser?.roles) ? parsedUser.roles : ['user'],
        permissions: parsedUser?.permissions ?? {},
        permissions_hierarchy: parsedUser?.permissions_hierarchy || {},
        metadata: parsedUser?.metadata || {},
        created_at: parsedUser?.created_at || undefined,
        last_login: parsedUser?.last_login || new Date().toISOString(),
        tenant_id: parsedUser?.tenant_id || undefined,
        tenant_name: parsedUser?.tenant_name || undefined,
        tenant: parsedUser?.tenant || undefined,
        subscription: parsedUser?.subscription || undefined,
        license: parsedUser?.license || undefined,
        has_access: typeof parsedUser?.has_access === 'boolean' ? parsedUser.has_access : undefined,
        available_plans: parsedUser?.available_plans || undefined,
        environment: parsedUser?.environment || undefined,
      },
      application: {
        id: parsedApplication?.id || '',
        name: parsedApplication?.name || '',
        domain: parsedApplication?.domain || '',
        environment: parsedApplication?.environment || undefined,
      },
      expires_in: expiresIn
    };
  } catch (error) {
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
    const supabaseUrl = requireSupabaseUrl();
    const anonKey = requireSupabaseAnonKey();

    const response = await fetch(`${supabaseUrl}/functions/v1/auth-verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        token,
        application_id: applicationId,
        api_key: apiKey
      })
    });

    const result = await response.json();
    return result.success && result.data?.valid;
  } catch (error) {
    return false;
  }
}
