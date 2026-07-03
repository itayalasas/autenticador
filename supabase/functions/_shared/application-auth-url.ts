function hasExplicitScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function isWebProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

export function normalizeUrl(raw: string | null | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';

  if (value.startsWith('/')) {
    return value.replace(/\/$/, '');
  }

  const withScheme = hasExplicitScheme(value)
    ? value
    : `https://${value}`;

  try {
    const parsed = new URL(withScheme);
    const serialized = parsed.toString();
    return isWebProtocol(parsed.protocol)
      ? serialized.replace(/\/$/, '')
      : serialized;
  } catch {
    return withScheme.replace(/\/$/, '');
  }
}

function normalizeOrigin(raw: string | null | undefined): string {
  const normalized = normalizeUrl(raw);
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    if (!isWebProtocol(parsed.protocol)) {
      return '';
    }

    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

export function buildRedirectUrl(baseUrl: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const normalizedBaseUrl = normalizeUrl(baseUrl);
  if (!normalizedBaseUrl) return '';

  try {
    const url = new URL(normalizedBaseUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  } catch (error) {
    console.error('Error building redirect URL:', error);

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      queryParams.set(key, String(value));
    });

    const separator = normalizedBaseUrl.includes('?') ? '&' : '?';
    return `${normalizedBaseUrl}${queryParams.toString() ? `${separator}${queryParams.toString()}` : ''}`;
  }
}

function collectMetadataOrigins(metadata: Record<string, any> | null | undefined): Set<string> {
  const origins = new Set<string>();
  if (!metadata || typeof metadata !== 'object') return origins;

  const envUrls = metadata.environment_urls;
  if (envUrls && typeof envUrls === 'object') {
    Object.values(envUrls).forEach((envConfig: any) => {
      const callbackOrigin = normalizeOrigin(envConfig?.callback_url);
      const baseOrigin = normalizeOrigin(envConfig?.base_url);
      if (callbackOrigin) origins.add(callbackOrigin);
      if (baseOrigin) origins.add(baseOrigin);
    });
  }

  const corsOrigins = Array.isArray(metadata.cors_origins)
    ? metadata.cors_origins
    : typeof metadata.cors_origins === 'string'
      ? metadata.cors_origins.split(/[\n,]/).map((value: string) => value.trim()).filter(Boolean)
      : [];

  corsOrigins.forEach((origin: string) => {
    const normalized = normalizeOrigin(origin);
    if (normalized) origins.add(normalized);
  });

  return origins;
}

function collectMetadataMobileRedirectUris(
  metadata: Record<string, any> | null | undefined,
  environmentName?: string | null,
): Set<string> {
  const redirectUris = new Set<string>();
  if (!metadata || typeof metadata !== 'object') return redirectUris;

  const normalizedEnvironmentName = String(environmentName || '').trim().toLowerCase();
  const environmentUrls = metadata.environment_urls;

  const addUris = (config: any) => {
    if (!config || typeof config !== 'object' || !Array.isArray(config.mobile_redirect_uris)) return;

    config.mobile_redirect_uris.forEach((value: unknown) => {
      const normalized = normalizeUrl(String(value || '').trim());
      if (normalized) {
        redirectUris.add(normalized);
      }
    });
  };

  if (environmentUrls && typeof environmentUrls === 'object') {
    if (normalizedEnvironmentName && environmentUrls[normalizedEnvironmentName]) {
      addUris(environmentUrls[normalizedEnvironmentName]);
    }

    Object.values(environmentUrls).forEach((config: any) => addUris(config));
  }

  if (Array.isArray(metadata.mobile_redirect_uris)) {
    metadata.mobile_redirect_uris.forEach((value: unknown) => {
      const normalized = normalizeUrl(String(value || '').trim());
      if (normalized) {
        redirectUris.add(normalized);
      }
    });
  }

  return redirectUris;
}

export function resolveTrustedApplicationCallbackUrl(options: {
  requestedCallbackUrl?: string | null;
  configuredCallbackUrl?: string | null;
  configuredBaseUrl?: string | null;
  applicationDomain?: string | null;
  applicationMetadata?: Record<string, any> | null;
  channel?: 'web' | 'mobile' | string | null;
  environmentName?: string | null;
}): string {
  const channel = String(options.channel || 'web').trim().toLowerCase() === 'mobile' ? 'mobile' : 'web';
  const normalizedRequested = normalizeUrl(options.requestedCallbackUrl);
  const normalizedConfigured = normalizeUrl(options.configuredCallbackUrl);

  if (channel === 'mobile') {
    const allowedExactUrls = collectMetadataMobileRedirectUris(
      options.applicationMetadata,
      options.environmentName,
    );

    if (normalizedRequested && allowedExactUrls.has(normalizedRequested)) {
      return normalizedRequested;
    }

    return '';
  }

  if (!normalizedRequested) {
    return normalizedConfigured;
  }

  const allowedExactUrls = new Set<string>();
  const allowedOrigins = collectMetadataOrigins(options.applicationMetadata);

  const addCandidate = (value: string | null | undefined) => {
    const normalized = normalizeUrl(value);
    if (!normalized) return;

    allowedExactUrls.add(normalized);
    const origin = normalizeOrigin(normalized);
    if (origin) allowedOrigins.add(origin);
  };

  addCandidate(options.configuredCallbackUrl);
  addCandidate(options.configuredBaseUrl);
  addCandidate(options.applicationDomain);

  const requestedOrigin = normalizeOrigin(normalizedRequested);

  if (allowedExactUrls.has(normalizedRequested)) {
    return normalizedRequested;
  }

  if (requestedOrigin && allowedOrigins.has(requestedOrigin)) {
    return normalizedRequested;
  }

  return normalizedConfigured;
}

export async function resolveApplicationAuthUrl(
  supabase: any,
  applicationId: string,
  apiKeyEnvironment?: string | null,
): Promise<{ baseUrl: string; callbackUrl: string; environmentName: string }> {
  let baseUrl = '';
  let callbackUrl = '';
  let environmentName = '';
  let applicationMetadata: Record<string, any> | null = null;

  const { data: applicationRecord, error: applicationError } = await supabase
    .from('applications')
    .select('domain, metadata')
    .eq('id', applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error('Error looking up application metadata for auth URL resolution:', applicationError);
  } else {
    applicationMetadata = applicationRecord?.metadata || null;
  }

  const metadataEnvironmentUrls = applicationMetadata?.environment_urls || {};
  const getMetadataEnvironmentConfig = (envName?: string | null) => {
    if (!envName) return null;
    const config = metadataEnvironmentUrls?.[String(envName).toLowerCase()];
    return config && typeof config === 'object' ? config : null;
  };

  if (apiKeyEnvironment) {
    const { data: exactEnv, error: exactEnvError } = await supabase
      .from('environments')
      .select('auth_url, callback_url, name, is_active')
      .eq('application_id', applicationId)
      .eq('name', apiKeyEnvironment)
      .eq('is_active', true)
      .maybeSingle();

    if (exactEnvError) {
      console.error('Error looking up exact environment URL:', exactEnvError);
    }

    if (exactEnv?.auth_url) {
      const metadataEnvConfig = getMetadataEnvironmentConfig(exactEnv.name || apiKeyEnvironment);
      baseUrl = normalizeUrl(metadataEnvConfig?.base_url || exactEnv.auth_url);
      callbackUrl = normalizeUrl(metadataEnvConfig?.callback_url || exactEnv.callback_url || (baseUrl ? `${baseUrl}/callback` : ''));
      environmentName = exactEnv.name || '';
    }
  }

  if (!baseUrl && apiKeyEnvironment) {
    const metadataEnvConfig = getMetadataEnvironmentConfig(apiKeyEnvironment);
    if (metadataEnvConfig?.base_url || metadataEnvConfig?.callback_url) {
      baseUrl = normalizeUrl(metadataEnvConfig?.base_url);
      callbackUrl = normalizeUrl(metadataEnvConfig?.callback_url || (baseUrl ? `${baseUrl}/callback` : ''));
      environmentName = String(apiKeyEnvironment);
    }
  }

  if (!baseUrl) {
    const { data: anyEnvs, error: anyEnvError } = await supabase
      .from('environments')
      .select('auth_url, callback_url, name')
      .eq('application_id', applicationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (anyEnvError) {
      console.error('Error looking up fallback environment URL:', anyEnvError);
    }

    const firstWithAuth = (anyEnvs || []).find((env: any) => normalizeUrl(env.auth_url));
    if (firstWithAuth) {
      const metadataEnvConfig = getMetadataEnvironmentConfig(firstWithAuth.name || '');
      baseUrl = normalizeUrl(metadataEnvConfig?.base_url || firstWithAuth.auth_url);
      callbackUrl = normalizeUrl(metadataEnvConfig?.callback_url || firstWithAuth.callback_url || (baseUrl ? `${baseUrl}/callback` : ''));
      environmentName = firstWithAuth.name || '';
    }
  }

  if (!baseUrl && metadataEnvironmentUrls && typeof metadataEnvironmentUrls === 'object') {
    const fallbackEntry = Object.entries(metadataEnvironmentUrls).find(([, config]: [string, any]) => normalizeUrl(config?.base_url));
    if (fallbackEntry) {
      environmentName = fallbackEntry[0];
      baseUrl = normalizeUrl((fallbackEntry[1] as any)?.base_url);
      callbackUrl = normalizeUrl((fallbackEntry[1] as any)?.callback_url || (baseUrl ? `${baseUrl}/callback` : ''));
    }
  }

  if (!callbackUrl && baseUrl) {
    callbackUrl = normalizeUrl(`${baseUrl}/callback`);
  }

  return { baseUrl, callbackUrl, environmentName };
}
