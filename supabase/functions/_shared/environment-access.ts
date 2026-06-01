export interface EnvironmentAccessMetadata {
  allowed_environments?: string[];
  created_from_environment?: string | null;
  last_registered_environment?: string | null;
  granted_via?: string | null;
}

export interface EnvironmentAccessEvaluation {
  allowed: boolean;
  source: 'legacy' | 'user_metadata' | 'tenant_metadata';
  requestedEnvironment: string | null;
  allowedEnvironments: string[];
}

const KNOWN_ENVIRONMENTS = new Set(['development', 'testing', 'production']);

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeEnvironmentName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return KNOWN_ENVIRONMENTS.has(normalized) ? normalized : normalized;
}

export function readAllowedEnvironments(metadata: Record<string, any> | null | undefined): string[] {
  const rawAllowed = metadata?.environment_access?.allowed_environments;
  if (!Array.isArray(rawAllowed)) {
    return [];
  }

  return unique(
    rawAllowed
      .map((value) => normalizeEnvironmentName(value))
      .filter((value): value is string => Boolean(value))
  );
}

export function buildEnvironmentScopedMetadata(
  metadata: Record<string, any> | null | undefined,
  environmentName: string | null
): Record<string, any> {
  const nextMetadata: Record<string, any> = { ...(metadata || {}) };
  const normalizedEnvironment = normalizeEnvironmentName(environmentName);

  if (!normalizedEnvironment) {
    return nextMetadata;
  }

  const currentEnvironmentAccess =
    nextMetadata.environment_access && typeof nextMetadata.environment_access === 'object' && !Array.isArray(nextMetadata.environment_access)
      ? { ...(nextMetadata.environment_access as Record<string, any>) }
      : {};

  const nextAllowedEnvironments = unique([
    ...readAllowedEnvironments(nextMetadata),
    normalizedEnvironment,
  ]);

  nextMetadata.environment_access = {
    ...currentEnvironmentAccess,
    allowed_environments: nextAllowedEnvironments,
    created_from_environment:
      normalizeEnvironmentName(currentEnvironmentAccess.created_from_environment) || normalizedEnvironment,
    last_registered_environment: normalizedEnvironment,
    granted_via: currentEnvironmentAccess.granted_via || 'api_key_environment',
  };

  return nextMetadata;
}

export function evaluateUserEnvironmentAccess(params: {
  requestedEnvironment: string | null | undefined;
  userMetadata?: Record<string, any> | null;
  tenantMetadata?: Record<string, any> | null;
}): EnvironmentAccessEvaluation {
  const requestedEnvironment = normalizeEnvironmentName(params.requestedEnvironment);
  const hasExplicitUserAllowedEnvironments = Array.isArray(
    params.userMetadata?.environment_access?.allowed_environments
  );
  const hasExplicitTenantAllowedEnvironments = Array.isArray(
    params.tenantMetadata?.environment_access?.allowed_environments
  );
  const userAllowedEnvironments = readAllowedEnvironments(params.userMetadata);
  const tenantAllowedEnvironments = readAllowedEnvironments(params.tenantMetadata);

  if (!requestedEnvironment) {
    return {
      allowed: true,
      source: 'legacy',
      requestedEnvironment,
      allowedEnvironments: [],
    };
  }

  if (hasExplicitUserAllowedEnvironments) {
    return {
      allowed: userAllowedEnvironments.includes(requestedEnvironment),
      source: 'user_metadata',
      requestedEnvironment,
      allowedEnvironments: userAllowedEnvironments,
    };
  }

  if (hasExplicitTenantAllowedEnvironments) {
    return {
      allowed: tenantAllowedEnvironments.includes(requestedEnvironment),
      source: 'tenant_metadata',
      requestedEnvironment,
      allowedEnvironments: tenantAllowedEnvironments,
    };
  }

  return {
    allowed: true,
    source: 'legacy',
    requestedEnvironment,
    allowedEnvironments: [],
  };
}
