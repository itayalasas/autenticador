export type PublicAuthChannel = 'web' | 'mobile';

function hasExplicitScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function isWebProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

export function normalizePublicUrl(raw: string | null | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';

  if (value.startsWith('/')) {
    return `${window.location.origin}${value}`.replace(/\/$/, '');
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

function normalizePublicOrigin(raw: string | null | undefined): string {
  const normalized = normalizePublicUrl(raw);
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

export function buildPublicRedirectUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const normalizedBaseUrl = normalizePublicUrl(baseUrl);
  if (!normalizedBaseUrl) return '';

  try {
    const url = new URL(normalizedBaseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  } catch (error) {
    console.error('Error building public redirect URL:', error);

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      queryParams.set(key, String(value));
    });

    const separator = normalizedBaseUrl.includes('?') ? '&' : '?';
    return `${normalizedBaseUrl}${queryParams.toString() ? `${separator}${queryParams.toString()}` : ''}`;
  }
}

function getEnvironmentEntries(environmentUrls: Record<string, any> | null | undefined): Array<{ key: string; callbackUrl: string }> {
  if (!environmentUrls || typeof environmentUrls !== 'object') {
    return [];
  }

  return Object.entries(environmentUrls)
    .map(([key, envConfig]) => ({
      key: key.toLowerCase(),
      callbackUrl: normalizePublicUrl((envConfig as any)?.callback_url),
    }))
    .filter((entry) => !!entry.callbackUrl);
}

function getMobileRedirectUris(environmentUrls: Record<string, any> | null | undefined): string[] {
  if (!environmentUrls || typeof environmentUrls !== 'object') {
    return [];
  }

  const redirectUris = new Set<string>();

  Object.values(environmentUrls).forEach((envConfig: any) => {
    if (!Array.isArray(envConfig?.mobile_redirect_uris)) return;

    envConfig.mobile_redirect_uris.forEach((uri: unknown) => {
      const normalized = normalizePublicUrl(String(uri || '').trim());
      if (normalized) {
        redirectUris.add(normalized);
      }
    });
  });

  return Array.from(redirectUris);
}

function getEnvironmentOrigins(environmentUrls: Record<string, any> | null | undefined): string[] {
  if (!environmentUrls || typeof environmentUrls !== 'object') {
    return [];
  }

  const origins = new Set<string>();

  Object.values(environmentUrls).forEach((envConfig: any) => {
    const callbackOrigin = normalizePublicOrigin(envConfig?.callback_url);
    const baseOrigin = normalizePublicOrigin(envConfig?.base_url);
    if (callbackOrigin) origins.add(callbackOrigin);
    if (baseOrigin) origins.add(baseOrigin);
  });

  return Array.from(origins);
}

function getAllowedOrigins(allowedOrigins: string[] | string | null | undefined): string[] {
  if (!allowedOrigins) return [];

  const rawValues = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : String(allowedOrigins)
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);

  return Array.from(
    new Set(
      rawValues
        .map((value) => normalizePublicOrigin(value))
        .filter(Boolean)
    )
  );
}

export function getCanonicalCallbackUrl(
  environmentUrls: Record<string, any> | null | undefined,
  preferredEnvironment?: string | null,
): string | null {
  const envEntries = getEnvironmentEntries(environmentUrls);
  if (!envEntries.length) return null;

  const preferredKey = (preferredEnvironment || '').trim().toLowerCase();
  if (preferredKey) {
    const preferredEntry = envEntries.find((entry) => entry.key === preferredKey);
    if (preferredEntry?.callbackUrl) {
      return preferredEntry.callbackUrl;
    }
  }

  return envEntries[0]?.callbackUrl || null;
}

export function getTrustedCallbackUrl(
  environmentUrls: Record<string, any> | null | undefined,
  requestedUrl: string | null | undefined,
  preferredEnvironment?: string | null,
  allowedOrigins?: string[] | string | null,
  channel: PublicAuthChannel = 'web',
): string | null {
  const normalizedRequested = normalizePublicUrl(requestedUrl);
  const requestedOrigin = normalizePublicOrigin(requestedUrl);
  const envEntries = getEnvironmentEntries(environmentUrls);
  const mobileRedirectUris = getMobileRedirectUris(environmentUrls);
  const trustedOrigins = new Set<string>([
    ...getEnvironmentOrigins(environmentUrls),
    ...getAllowedOrigins(allowedOrigins)
  ]);

  if (channel === 'mobile') {
    if (normalizedRequested && mobileRedirectUris.includes(normalizedRequested)) {
      return normalizedRequested;
    }

    return null;
  }

  if (normalizedRequested) {
    const requestedEntry = envEntries.find((entry) => entry.callbackUrl === normalizedRequested);
    if (requestedEntry?.callbackUrl) {
      return requestedEntry.callbackUrl;
    }

    if (requestedOrigin && trustedOrigins.has(requestedOrigin)) {
      return normalizedRequested;
    }
  }

  if (!envEntries.length) {
    return null;
  }

  return getCanonicalCallbackUrl(environmentUrls, preferredEnvironment);
}
