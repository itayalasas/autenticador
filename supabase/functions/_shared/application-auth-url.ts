export function normalizeUrl(raw: string | null | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';

  const withScheme = value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`;

  return withScheme.replace(/\/$/, '');
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

export async function resolveApplicationAuthUrl(
  supabase: any,
  applicationId: string,
  apiKeyEnvironment?: string | null,
): Promise<{ baseUrl: string; callbackUrl: string; environmentName: string }> {
  let baseUrl = '';
  let callbackUrl = '';
  let environmentName = '';

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
      baseUrl = normalizeUrl(exactEnv.auth_url);
      callbackUrl = normalizeUrl(exactEnv.callback_url || (baseUrl ? `${baseUrl}/auth/callback` : ''));
      environmentName = exactEnv.name || '';
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
      baseUrl = normalizeUrl(firstWithAuth.auth_url);
      callbackUrl = normalizeUrl(firstWithAuth.callback_url || (baseUrl ? `${baseUrl}/auth/callback` : ''));
      environmentName = firstWithAuth.name || '';
    }
  }

  if (!callbackUrl && baseUrl) {
    callbackUrl = normalizeUrl(`${baseUrl}/auth/callback`);
  }

  return { baseUrl, callbackUrl, environmentName };
}
