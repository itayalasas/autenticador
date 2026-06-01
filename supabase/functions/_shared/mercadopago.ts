export interface MercadoPagoBillingConfig {
  enabled: boolean;
  provider: 'mercadopago';
  accessToken: string;
  publicKey: string;
  backUrl: string;
  webhookSecret: string;
  autoSyncOnLogin: boolean;
  autoAssignDefaultPlan: boolean;
  requirePlanForAccess: boolean;
}

export class MercadoPagoApiError extends Error {
  status: number;
  responseBody: unknown;

  constructor(status: number, responseBody: unknown, fallbackMessage?: string) {
    const resolvedMessage =
      typeof responseBody === 'object' && responseBody && 'message' in responseBody
        ? `Mercado Pago ${status}: ${String((responseBody as { message?: unknown }).message || fallbackMessage || 'Unknown error')}`
        : `Mercado Pago ${status}: ${fallbackMessage || 'Unknown error'}`;

    super(resolvedMessage);
    this.name = 'MercadoPagoApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface ApplicationBillingPlanRecord {
  application_billing_plan_features?: Array<{
    id?: string;
    value?: string | number | boolean | null;
    sort_order?: number | null;
    application_billing_features?: {
      id?: string;
      code?: string;
      name?: string;
      description?: string;
      value_type?: 'boolean' | 'number' | 'text' | string;
      default_value?: string | number | boolean | null;
      category?: string;
      unit?: string | null;
      active?: boolean;
    } | null;
  }>;
  id: string;
  application_id: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  repetitions?: number | null;
  trial_days?: number | null;
  billing_day?: number | null;
  is_active: boolean;
  is_default?: boolean | null;
  sort_order?: number | null;
  features?: unknown;
  entitlements?: Record<string, unknown> | null;
  provider?: string | null;
  provider_plan_id?: string | null;
  provider_status?: string | null;
  provider_init_point?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return fallback;
}

export function normalizeMercadoPagoConfig(raw: Record<string, any> | null | undefined): MercadoPagoBillingConfig {
  const config = raw || {};
  return {
    enabled: normalizeBoolean(config.enabled, false),
    provider: 'mercadopago',
    accessToken: String(
      config.mercado_pago_access_token ||
      config.access_token ||
      ''
    ).trim(),
    publicKey: String(
      config.mercado_pago_public_key ||
      config.public_key ||
      ''
    ).trim(),
    backUrl: String(config.mercado_pago_back_url || config.back_url || '').trim(),
    webhookSecret: String(config.mercado_pago_webhook_secret || config.webhook_secret || '').trim(),
    autoSyncOnLogin: normalizeBoolean(config.auto_sync_on_login, true),
    autoAssignDefaultPlan: normalizeBoolean(config.auto_assign_default_plan, true),
    requirePlanForAccess: normalizeBoolean(config.require_plan_for_access, true),
  };
}

export function buildMercadoPagoPlanPayload(
  plan: ApplicationBillingPlanRecord,
  backUrl: string
) {
  const price = Number(plan.price || 0);
  const intervalCount = Number(plan.interval_count || 1);
  const trialDays = Number(plan.trial_days || 0);
  const repetitions = plan.repetitions ? Number(plan.repetitions) : undefined;
  const billingDay = plan.billing_day ? Number(plan.billing_day) : undefined;

  const autoRecurring: Record<string, unknown> = {
    frequency: intervalCount,
    frequency_type: `${plan.interval}s`,
    transaction_amount: price,
    currency_id: plan.currency || 'UYU',
  };

  if (repetitions && repetitions > 0) {
    autoRecurring.repetitions = repetitions;
  }

  if (billingDay && billingDay >= 1 && billingDay <= 28) {
    autoRecurring.billing_day = billingDay;
    autoRecurring.billing_day_proportional = false;
  }

  if (trialDays > 0) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: 'days',
    };
  }

  return {
    reason: plan.name,
    auto_recurring: autoRecurring,
    payment_methods_allowed: {
      payment_types: [{}],
      payment_methods: [{}],
    },
    back_url: backUrl,
    external_reference: `${plan.application_id}:${plan.id}`,
  };
}

export function buildMercadoPagoPendingSubscriptionPayload(
  plan: ApplicationBillingPlanRecord,
  options: {
    backUrl: string;
    externalReference: string;
    payerEmail?: string | null;
    reason?: string | null;
    includeFreeTrial?: boolean;
    status?: 'pending' | 'authorized';
  },
) {
  const price = Number(plan.price || 0);
  const intervalCount = Number(plan.interval_count || 1);
  const trialDays = Number(plan.trial_days || 0);
  const repetitions = plan.repetitions ? Number(plan.repetitions) : undefined;
  const billingDay = plan.billing_day ? Number(plan.billing_day) : undefined;

  const autoRecurring: Record<string, unknown> = {
    frequency: intervalCount,
    frequency_type: `${plan.interval}s`,
    transaction_amount: price,
    currency_id: plan.currency || 'UYU',
  };

  if (repetitions && repetitions > 0) {
    autoRecurring.repetitions = repetitions;
  }

  if (billingDay && billingDay >= 1 && billingDay <= 28) {
    autoRecurring.billing_day = billingDay;
    autoRecurring.billing_day_proportional = false;
  }

  if (options.includeFreeTrial === true && trialDays > 0) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: 'days',
    };
  }

  return {
    reason: String(options.reason || plan.name || 'Subscription').trim(),
    external_reference: options.externalReference,
    payer_email: options.payerEmail || undefined,
    auto_recurring: autoRecurring,
    back_url: options.backUrl,
    status: options.status || 'pending',
  };
}

export async function mercadoPagoRequest(
  config: MercadoPagoBillingConfig,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  options: {
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | undefined | null>;
  } = {}
) {
  if (!config.accessToken) {
    throw new Error('Mercado Pago access token is not configured');
  }

  const url = new URL(`https://api.mercadopago.com${path}`);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(options.body || {}),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    throw new MercadoPagoApiError(response.status, data, text || 'Unknown error');
  }

  return data;
}

export function mapMercadoPagoSubscriptionStatus(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'authorized':
      return 'authorized';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'pending':
      return 'pending';
    default:
      return 'active';
  }
}

export function isBillableSubscriptionActive(status: string | null | undefined) {
  return ['active', 'authorized', 'trialing'].includes((status || '').toLowerCase());
}
