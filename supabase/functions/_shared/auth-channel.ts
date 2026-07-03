export type AuthChannel = 'web' | 'mobile';

export interface AuthChannelConfig {
  enabled: boolean;
  pkce_required?: boolean;
  code_challenge_methods?: string[];
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeAuthChannel(raw: unknown): AuthChannel {
  return String(raw || '').trim().toLowerCase() === 'mobile' ? 'mobile' : 'web';
}

function normalizeChannelList(values: unknown[]): AuthChannel[] {
  const normalized = values
    .map((value) => normalizeAuthChannel(value))
    .filter((value, index, list) => list.indexOf(value) === index);

  return normalized.length > 0 ? normalized : ['web'];
}

function inferMobileSupportFromMetadata(metadata: Record<string, any> | null | undefined): boolean {
  if (!isRecord(metadata)) return false;

  const environmentUrls = isRecord(metadata.environment_urls) ? metadata.environment_urls : null;
  if (!environmentUrls) return false;

  return Object.values(environmentUrls).some((config) => {
    if (!isRecord(config)) return false;
    return Array.isArray(config.mobile_redirect_uris) && config.mobile_redirect_uris.length > 0;
  });
}

export function getSupportedAuthChannels(metadata: Record<string, any> | null | undefined): AuthChannel[] {
  if (!isRecord(metadata)) {
    return ['web'];
  }

  if (Array.isArray(metadata.supported_auth_channels)) {
    return normalizeChannelList(metadata.supported_auth_channels);
  }

  if (inferMobileSupportFromMetadata(metadata)) {
    return ['web', 'mobile'];
  }

  return ['web'];
}

export function isAuthChannelEnabled(
  metadata: Record<string, any> | null | undefined,
  channel: AuthChannel,
): boolean {
  const supportedChannels = getSupportedAuthChannels(metadata);
  if (!supportedChannels.includes(channel)) {
    return false;
  }

  const channelConfig = getAuthChannelConfig(metadata, channel);
  return channelConfig.enabled !== false;
}

export function getAuthChannelConfig(
  metadata: Record<string, any> | null | undefined,
  channel: AuthChannel,
): AuthChannelConfig {
  const channelConfigRoot = isRecord(metadata?.auth_channel_config)
    ? metadata?.auth_channel_config
    : isRecord(metadata?.channel_config)
      ? metadata?.channel_config
      : {};

  const rawConfig = isRecord(channelConfigRoot?.[channel]) ? channelConfigRoot[channel] : {};

  if (channel === 'mobile') {
    return {
      enabled: rawConfig.enabled !== false,
      pkce_required: rawConfig.pkce_required !== false,
      code_challenge_methods: Array.isArray(rawConfig.code_challenge_methods) && rawConfig.code_challenge_methods.length > 0
        ? rawConfig.code_challenge_methods.map((value: unknown) => String(value))
        : ['S256'],
    };
  }

  return {
    enabled: rawConfig.enabled !== false,
  };
}

export function getMobileRedirectUris(
  metadata: Record<string, any> | null | undefined,
  environmentName?: string | null,
): string[] {
  if (!isRecord(metadata)) return [];

  const environmentUrls = isRecord(metadata.environment_urls) ? metadata.environment_urls : {};
  const normalizedEnvironmentName = String(environmentName || '').trim().toLowerCase();
  const candidates: string[] = [];

  const collectUris = (config: Record<string, any> | null | undefined) => {
    if (!isRecord(config) || !Array.isArray(config.mobile_redirect_uris)) return;

    config.mobile_redirect_uris.forEach((uri: unknown) => {
      const value = String(uri || '').trim();
      if (value) {
        candidates.push(value);
      }
    });
  };

  if (normalizedEnvironmentName && isRecord(environmentUrls[normalizedEnvironmentName])) {
    collectUris(environmentUrls[normalizedEnvironmentName]);
  }

  Object.values(environmentUrls).forEach((config) => collectUris(isRecord(config) ? config : null));

  if (Array.isArray(metadata.mobile_redirect_uris)) {
    metadata.mobile_redirect_uris.forEach((uri: unknown) => {
      const value = String(uri || '').trim();
      if (value) {
        candidates.push(value);
      }
    });
  }

  return candidates.filter((value, index, list) => list.indexOf(value) === index);
}
