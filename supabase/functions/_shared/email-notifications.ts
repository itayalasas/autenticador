export interface ResolvedConfigValue<T> {
  value: T | undefined;
  source: string | null;
}

export interface ResolvedNotificationConfig {
  key: string | null;
  entry: Record<string, any>;
  enabled: boolean;
  enabledSource: string | null;
  templateName: string;
  templateSource: string | null;
  apiUrl: string;
  apiUrlSource: string | null;
  apiKey: string;
  apiKeySource: string | null;
  adminEmail: string;
  adminEmailSource: string | null;
  tokenExpirationMinutes: number | undefined;
  tokenExpirationSource: string | null;
}

interface NotificationCandidate<T> {
  source: string;
  value: T | null | undefined;
}

interface ResolveNotificationConfigOptions {
  emailConfig?: Record<string, any> | null;
  notificationKeys: string[];
  defaultTemplate: string;
  enabledDefault?: boolean;
  enabledCandidates?: Array<NotificationCandidate<boolean>>;
  templateCandidates?: Array<NotificationCandidate<string>>;
  adminEmailCandidates?: Array<NotificationCandidate<string>>;
  tokenExpirationCandidates?: Array<NotificationCandidate<number>>;
}

export function resolveConfiguredValue<T>(candidates: Array<NotificationCandidate<T>>): ResolvedConfigValue<T> {
  for (const candidate of candidates) {
    const value = candidate.value;

    if (typeof value === 'string') {
      if (value.trim()) {
        return { value: value as T, source: candidate.source };
      }
      continue;
    }

    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return { value: value as T, source: candidate.source };
      }
      continue;
    }

    if (typeof value === 'boolean') {
      return { value: value as T, source: candidate.source };
    }

    if (value !== undefined && value !== null) {
      return { value, source: candidate.source };
    }
  }

  return { value: undefined, source: null };
}

export function resolveNotificationEntry(emailConfig: Record<string, any> | null | undefined, notificationKeys: string[]) {
  const notifications = emailConfig?.notifications;

  if (!notifications || typeof notifications !== 'object') {
    return { key: null, entry: {} as Record<string, any> };
  }

  for (const key of notificationKeys) {
    const entry = notifications[key];
    if (entry && typeof entry === 'object') {
      return { key, entry };
    }
  }

  return { key: null, entry: {} as Record<string, any> };
}

export function resolveNotificationConfig(options: ResolveNotificationConfigOptions): ResolvedNotificationConfig {
  const emailConfig = options.emailConfig || {};
  const { key, entry } = resolveNotificationEntry(emailConfig, options.notificationKeys);
  const entryPrefix = key ? `application.email_config.notifications.${key}` : null;

  const enabled = resolveConfiguredValue<boolean>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.enabled`, value: entry.enabled }] : []),
    ...(options.enabledCandidates || []),
    { source: 'default', value: options.enabledDefault ?? false },
  ]);

  const template = resolveConfiguredValue<string>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.template_name`, value: entry.template_name }] : []),
    ...(options.templateCandidates || []),
    { source: 'default', value: options.defaultTemplate },
  ]);

  const apiUrl = resolveConfiguredValue<string>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.api_url`, value: entry.api_url }] : []),
    { source: 'application.email_config.external_email_api_url', value: emailConfig?.external_email_api_url },
    { source: 'env.EMAIL_API_URL', value: Deno.env.get('EMAIL_API_URL') },
    { source: 'env.EXTERNAL_EMAIL_API_URL', value: Deno.env.get('EXTERNAL_EMAIL_API_URL') },
  ]);

  const apiKey = resolveConfiguredValue<string>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.api_key`, value: entry.api_key }] : []),
    { source: 'application.email_config.external_email_api_key', value: emailConfig?.external_email_api_key },
    { source: 'env.EMAIL_API_KEY', value: Deno.env.get('EMAIL_API_KEY') },
    { source: 'env.EXTERNAL_EMAIL_API_KEY', value: Deno.env.get('EXTERNAL_EMAIL_API_KEY') },
  ]);

  const adminEmail = resolveConfiguredValue<string>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.admin_email`, value: entry.admin_email }] : []),
    ...(options.adminEmailCandidates || []),
  ]);

  const tokenExpirationMinutes = resolveConfiguredValue<number>([
    ...(entryPrefix ? [{ source: `${entryPrefix}.token_expiration_minutes`, value: Number(entry.token_expiration_minutes) }] : []),
    ...(options.tokenExpirationCandidates || []),
  ]);

  return {
    key,
    entry,
    enabled: Boolean(enabled.value),
    enabledSource: enabled.source,
    templateName: (template.value || options.defaultTemplate || '').trim(),
    templateSource: template.source,
    apiUrl: (apiUrl.value || '').trim().replace(/\/$/, ''),
    apiUrlSource: apiUrl.source,
    apiKey: (apiKey.value || '').trim(),
    apiKeySource: apiKey.source,
    adminEmail: (adminEmail.value || '').trim(),
    adminEmailSource: adminEmail.source,
    tokenExpirationMinutes: tokenExpirationMinutes.value,
    tokenExpirationSource: tokenExpirationMinutes.source,
  };
}

export async function sendTemplatedEmail(params: {
  apiUrl: string;
  apiKey: string;
  templateName: string;
  recipientEmail: string;
  data: Record<string, unknown>;
}) {
  const response = await fetch(params.apiUrl.trim().replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey.trim(),
    },
    body: JSON.stringify({
      template_name: params.templateName,
      recipient_email: params.recipientEmail,
      data: params.data,
    }),
  });

  const raw = await response.text();
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error?.message || json?.message || `Email API error ${response.status}: ${raw}`);
  }

  return json;
}
