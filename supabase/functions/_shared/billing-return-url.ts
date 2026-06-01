import { normalizeUrl } from './application-auth-url.ts';

function toOrigin(raw: string | null | undefined): string | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;

  try {
    return new URL(normalized).origin.toLowerCase();
  } catch {
    return null;
  }
}

function collectMetadataUrls(application: Record<string, any>) {
  const metadata = (application?.metadata || {}) as Record<string, any>;
  const urls = new Set<string>();

  const addUrl = (value: unknown) => {
    const normalized = normalizeUrl(typeof value === 'string' ? value : '');
    if (normalized) urls.add(normalized);
  };

  addUrl(application?.domain);
  addUrl(application?.billing_config?.mercado_pago_back_url);
  addUrl(application?.billing_config?.back_url);

  const allowedCallbackUrls = Array.isArray(metadata.allowed_callback_urls)
    ? metadata.allowed_callback_urls
    : [];

  allowedCallbackUrls.forEach(addUrl);

  const environmentUrls = metadata.environment_urls || {};
  Object.values(environmentUrls).forEach((entry: any) => {
    addUrl(entry?.base_url);
    addUrl(entry?.callback_url);
  });

  return Array.from(urls);
}

export async function resolveTrustedBillingReturnUrl(
  supabase: any,
  application: Record<string, any>,
  requestedReturnUrl: string | null | undefined,
) {
  const normalizedRequested = normalizeUrl(requestedReturnUrl);
  if (!normalizedRequested) return null;

  const allowedOrigins = new Set<string>();

  collectMetadataUrls(application).forEach((url) => {
    const origin = toOrigin(url);
    if (origin) allowedOrigins.add(origin);
  });

  try {
    const { data: environments } = await supabase
      .from('environments')
      .select('auth_url, callback_url')
      .eq('application_id', application.id)
      .eq('is_active', true);

    (environments || []).forEach((environment: any) => {
      const authOrigin = toOrigin(environment?.auth_url);
      const callbackOrigin = toOrigin(environment?.callback_url);
      if (authOrigin) allowedOrigins.add(authOrigin);
      if (callbackOrigin) allowedOrigins.add(callbackOrigin);
    });
  } catch (error) {
    console.warn('Could not resolve extra environment origins for billing return URL:', error);
  }

  const requestedOrigin = toOrigin(normalizedRequested);
  if (!requestedOrigin) return null;

  return allowedOrigins.has(requestedOrigin) ? normalizedRequested : null;
}
