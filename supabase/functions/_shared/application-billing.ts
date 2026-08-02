import {
  ApplicationBillingPlanRecord,
  isBillableSubscriptionActive,
  mapMercadoPagoSubscriptionStatus,
  mercadoPagoRequest,
  normalizeMercadoPagoConfig,
  normalizeBillingEnvironmentName,
  resolvePlanProviderState,
} from './mercadopago.ts';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'authorized', 'trialing'];
const CANCELLABLE_SUBSCRIPTION_STATUSES = ['pending', 'authorized', 'active', 'trialing', 'paused'];

type BillingFeatureCatalogRecord = {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  value_type?: string;
  default_value?: string | number | boolean | null;
  category?: string;
  unit?: string | null;
  active?: boolean;
};

type BillingPlanFeatureRelation = {
  id?: string;
  value?: string | number | boolean | null;
  sort_order?: number | null;
  application_billing_features?: BillingFeatureCatalogRecord | null;
};

function stringifyFeatureValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function normalizeFeatureValueType(value: unknown): 'boolean' | 'number' | 'text' {
  if (value === 'boolean' || value === 'number' || value === 'text') {
    return value;
  }
  return 'text';
}

function normalizeFeatures(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function mapCatalogFeatureToEntitlement(
  relation: BillingPlanFeatureRelation,
) {
  const feature = relation.application_billing_features || {};
  return {
    code: String(feature.code || '').trim(),
    name: String(feature.name || feature.code || '').trim(),
    description: String(feature.description || '').trim(),
    value: stringifyFeatureValue(relation.value, stringifyFeatureValue(feature.default_value, '')),
    value_type: normalizeFeatureValueType(feature.value_type),
    unit: feature.unit || null,
    category: String(feature.category || 'features').trim() || 'features',
  };
}

function normalizeEntitlementFeature(raw: any) {
  return {
    code: String(raw?.code || '').trim(),
    name: String(raw?.name || raw?.code || '').trim(),
    description: String(raw?.description || '').trim(),
    value: stringifyFeatureValue(raw?.value, stringifyFeatureValue(raw?.default_value, '')),
    value_type: normalizeFeatureValueType(raw?.value_type),
    unit: raw?.unit || null,
    category: String(raw?.category || 'features').trim() || 'features',
  };
}

function getPlanEntitlementFeatures(plan: ApplicationBillingPlanRecord) {
  const relationalFeatures = Array.isArray(plan.application_billing_plan_features)
    ? plan.application_billing_plan_features
      .slice()
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
      .map(mapCatalogFeatureToEntitlement)
      .filter((feature) => feature.code)
    : [];

  if (relationalFeatures.length > 0) {
    return relationalFeatures;
  }

  const raw = plan.entitlements && typeof plan.entitlements === 'object'
    ? { ...plan.entitlements }
    : {};

  return Array.isArray((raw as any).features)
    ? (raw as any).features
      .filter((item: any) => item && typeof item === 'object')
      .map(normalizeEntitlementFeature)
      .filter((feature: any) => feature.code)
    : [];
}

export function normalizeEntitlements(plan: ApplicationBillingPlanRecord) {
  const raw = plan.entitlements && typeof plan.entitlements === 'object'
    ? { ...plan.entitlements }
    : {};

  return {
    ...raw,
    features: getPlanEntitlementFeatures(plan),
  };
}

function deriveBillingCycle(plan: ApplicationBillingPlanRecord) {
  const interval = String(plan.interval || 'month').toLowerCase();
  const intervalCount = Number(plan.interval_count || 1);

  if (interval === 'month' && intervalCount === 1) return 'monthly';
  if (interval === 'year' && intervalCount === 1) return 'yearly';
  if (interval === 'week' && intervalCount === 1) return 'weekly';
  if (interval === 'day' && intervalCount === 1) return 'daily';

  return `${intervalCount}_${interval}`;
}

export function buildAvailablePlan(
  plan: ApplicationBillingPlanRecord,
  options: {
    backUrl?: string | null;
    currentPlanId?: string | null;
    currentPlanPrice?: number;
    managedCheckout?: boolean;
    environmentName?: string | null;
  } = {},
) {
  const price = Number(plan.price || 0);
  const providerState = resolvePlanProviderState(plan, options.environmentName);
  const providerCheckoutUrl = providerState.provider_init_point || (providerState.provider_metadata as any)?.init_point || null;
  const managedCheckout = options.managedCheckout === true;
  const checkoutUrl = managedCheckout ? null : providerCheckoutUrl;
  const intervalCount = Number(plan.interval_count || 1);
  const entitlements = normalizeEntitlements(plan);

  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    price,
    amount: price,
    currency: plan.currency,
    interval: plan.interval,
    interval_count: intervalCount,
    billing_cycle: deriveBillingCycle(plan),
    frequency_type: String(plan.interval || 'month').toUpperCase(),
    frequency_value: intervalCount,
    trial_days: Number(plan.trial_days || 0),
    free_trial_days: Number(plan.trial_days || 0),
    active: plan.is_active === true,
    is_default: plan.is_default === true,
    sort_order: Number(plan.sort_order || 0),
    features: normalizeFeatures(plan.features),
    entitlements,
    provider: providerState.provider || 'mercadopago',
    provider_plan_id: providerState.provider_plan_id || null,
    provider_status: providerState.provider_status || null,
    plan_token: providerState.provider_plan_id || plan.id,
    managed_checkout: managedCheckout,
    requires_checkout_session: managedCheckout,
    provider_checkout_url: providerCheckoutUrl,
    checkout_url: checkoutUrl,
    subscribe_url: checkoutUrl,
    is_upgrade: Boolean(
      options.currentPlanId &&
      options.currentPlanId !== plan.id &&
      price > Number(options.currentPlanPrice || 0),
    ),
    price_difference: options.currentPlanId
      ? price - Number(options.currentPlanPrice || 0)
      : 0,
    mp_init_point: checkoutUrl,
    mp_back_url: options.backUrl || null,
    mp_preapproval_plan_id: providerState.provider_plan_id || null,
    mp_status: providerState.provider_status || null,
    billing_environment: providerState.environmentName || null,
  };
}

function calculatePeriodEnd(plan: ApplicationBillingPlanRecord, fromDate: Date) {
  const start = new Date(fromDate);
  const intervalCount = Number(plan.interval_count || 1);

  switch (plan.interval) {
    case 'day':
      start.setDate(start.getDate() + intervalCount);
      break;
    case 'week':
      start.setDate(start.getDate() + intervalCount * 7);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() + intervalCount);
      break;
    case 'month':
    default:
      start.setMonth(start.getMonth() + intervalCount);
      break;
  }

  return start.toISOString();
}

export async function getActivePlans(supabase: any, applicationId: string) {
  const { data, error } = await supabase
    .from('application_billing_plans')
    .select(`
      *,
      application_billing_plan_features(
        id,
        value,
        sort_order,
        application_billing_features(
          id,
          code,
          name,
          description,
          value_type,
          default_value,
          category,
          unit,
          active
        )
      )
    `)
    .eq('application_id', applicationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('price', { ascending: true });

  if (error) throw error;
  return (data || []) as ApplicationBillingPlanRecord[];
}

// Resuelve el plan efectivo (y sus entitlements) para un scope
// tenant/app_user dado, sin depender de un login completo (a diferencia de
// resolveApplicationBillingAccess, que requiere un appUser real). Si no hay
// suscripcion activa cae al plan por defecto de la aplicacion, igual que el
// resto del sistema. Usado por application-usage-limits y wallet-debit para
// leer limites/precios de excedente server-a-server.
export async function resolveScopedPlanEntitlements(params: {
  supabase: any;
  application: Record<string, any>;
  tenantId?: string | null;
  appUserId?: string | null;
  environmentName?: string | null;
}) {
  const { supabase, application, tenantId, appUserId, environmentName } = params;
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);

  const subscription = await getScopedSubscription(
    supabase,
    application.id,
    tenantId,
    appUserId,
    normalizedEnvironment,
  );

  let plan: ApplicationBillingPlanRecord | null = subscription?.application_billing_plans || null;

  if (!plan) {
    const activePlans = await getActivePlans(supabase, application.id);
    plan = activePlans.find((candidate) => candidate.is_default) || null;
  }

  return {
    subscription,
    plan,
    entitlements: plan ? normalizeEntitlements(plan) : { features: [] as ReturnType<typeof normalizeEntitlements>['features'] },
  };
}

export async function getScopedSubscription(
  supabase: any,
  applicationId: string,
  tenantId?: string | null,
  appUserId?: string | null,
  environmentName?: string | null,
) {
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  let query = supabase
    .from('application_plan_subscriptions')
    .select(`
      *,
      application_billing_plans(
        *,
        application_billing_plan_features(
          id,
          value,
          sort_order,
          application_billing_features(
            id,
            code,
            name,
            description,
            value_type,
            default_value,
            category,
            unit,
            active
          )
        )
      )
    `)
    .eq('application_id', applicationId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  } else if (appUserId) {
    query = query.eq('app_user_id', appUserId);
  } else {
    return null;
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  if (!normalizedEnvironment) {
    return rows[0] || null;
  }

  return rows.find((row: any) => {
    const subscriptionEnvironment = normalizeBillingEnvironmentName(
      row?.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, any>).billing_environment
        : null
    );

    return subscriptionEnvironment === normalizedEnvironment;
  }) || null;
}

export async function getScopedTrialUsage(params: {
  supabase: any;
  applicationId: string;
  tenantId?: string | null;
  appUserId?: string | null;
}) {
  const { supabase, applicationId, tenantId, appUserId } = params;

  if (tenantId) {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, metadata')
      .eq('id', tenantId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    const metadata = tenant?.metadata && typeof tenant.metadata === 'object'
      ? { ...(tenant.metadata as Record<string, any>) }
      : {};
    const billing = metadata.billing && typeof metadata.billing === 'object'
      ? { ...(metadata.billing as Record<string, any>) }
      : {};

    let consumed = billing.trial_consumed === true;

    if (!consumed) {
      const { data: previousTrial } = await supabase
        .from('application_plan_subscriptions')
        .select('id, trial_end, application_plan_id, created_at')
        .eq('application_id', applicationId)
        .eq('tenant_id', tenantId)
        .not('trial_end', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousTrial) {
        consumed = true;
        billing.trial_consumed_at = billing.trial_consumed_at || previousTrial.created_at || null;
        billing.trial_plan_id = billing.trial_plan_id || previousTrial.application_plan_id || null;
        billing.trial_ended_at = billing.trial_ended_at || previousTrial.trial_end || null;
      }
    }

    return {
      scope: 'tenant' as const,
      id: tenantId,
      metadata,
      billing,
      consumed,
    };
  }

  if (appUserId) {
    const { data: appUser, error } = await supabase
      .from('app_users')
      .select('id, metadata')
      .eq('id', appUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    const metadata = appUser?.metadata && typeof appUser.metadata === 'object'
      ? { ...(appUser.metadata as Record<string, any>) }
      : {};
    const billing = metadata.billing && typeof metadata.billing === 'object'
      ? { ...(metadata.billing as Record<string, any>) }
      : {};

    let consumed = billing.trial_consumed === true;

    if (!consumed) {
      const { data: previousTrial } = await supabase
        .from('application_plan_subscriptions')
        .select('id, trial_end, application_plan_id, created_at')
        .eq('application_id', applicationId)
        .eq('app_user_id', appUserId)
        .not('trial_end', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousTrial) {
        consumed = true;
        billing.trial_consumed_at = billing.trial_consumed_at || previousTrial.created_at || null;
        billing.trial_plan_id = billing.trial_plan_id || previousTrial.application_plan_id || null;
        billing.trial_ended_at = billing.trial_ended_at || previousTrial.trial_end || null;
      }
    }

    return {
      scope: 'app_user' as const,
      id: appUserId,
      metadata,
      billing,
      consumed,
    };
  }

  return {
    scope: 'none' as const,
    id: null,
    metadata: {},
    billing: {},
    consumed: false,
  };
}

function resolveProviderTrialEnd(providerSubscription: Record<string, any> | null | undefined) {
  const nextPaymentDate = String(providerSubscription?.next_payment_date || '').trim();
  if (nextPaymentDate) {
    return nextPaymentDate;
  }

  const freeTrial = providerSubscription?.auto_recurring?.free_trial;
  const startDate = String(
    providerSubscription?.auto_recurring?.start_date ||
    providerSubscription?.date_created ||
    ''
  ).trim();

  if (!freeTrial || !startDate) {
    return null;
  }

  const frequency = Number(freeTrial.frequency || 0);
  const frequencyType = String(freeTrial.frequency_type || '').trim().toLowerCase();
  if (!frequency || !frequencyType) {
    return null;
  }

  const resolvedStartDate = new Date(startDate);
  if (Number.isNaN(resolvedStartDate.getTime())) {
    return null;
  }

  switch (frequencyType) {
    case 'day':
    case 'days':
      resolvedStartDate.setDate(resolvedStartDate.getDate() + frequency);
      break;
    case 'week':
    case 'weeks':
      resolvedStartDate.setDate(resolvedStartDate.getDate() + frequency * 7);
      break;
    case 'month':
    case 'months':
      resolvedStartDate.setMonth(resolvedStartDate.getMonth() + frequency);
      break;
    case 'year':
    case 'years':
      resolvedStartDate.setFullYear(resolvedStartDate.getFullYear() + frequency);
      break;
    default:
      return null;
  }

  return resolvedStartDate.toISOString();
}

async function markTrialConsumedForScope(params: {
  supabase: any;
  scope: 'tenant' | 'app_user' | 'none';
  id?: string | null;
  metadata: Record<string, any>;
  billing: Record<string, any>;
  planId: string;
  trialEnd: string | null;
  source?: string;
}) {
  const { supabase, scope, id, metadata, billing, planId, trialEnd, source } = params;
  if (!id || scope === 'none') return;

  const updatedMetadata = {
    ...metadata,
    billing: {
      ...billing,
      trial_consumed: true,
      trial_consumed_at: billing.trial_consumed_at || new Date().toISOString(),
      trial_plan_id: planId,
      trial_ended_at: trialEnd,
      trial_source: source || 'initial_plan_trial',
    },
  };

  if (scope === 'tenant') {
    await supabase
      .from('tenants')
      .update({ metadata: updatedMetadata })
      .eq('id', id);
    return;
  }

  await supabase
    .from('app_users')
    .update({ metadata: updatedMetadata })
    .eq('id', id);
}

async function markProviderTrialConsumedForScope(params: {
  supabase: any;
  scope: 'tenant' | 'app_user' | 'none';
  id?: string | null;
  planId: string;
  trialEnd: string | null;
  source?: string;
}) {
  const { supabase, scope, id, planId, trialEnd, source } = params;
  if (!id || scope === 'none') return;

  const table = scope === 'tenant' ? 'tenants' : 'app_users';
  const { data: record, error } = await supabase
    .from(table)
    .select('id, metadata')
    .eq('id', id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (!record) return;

  const metadata = record.metadata && typeof record.metadata === 'object'
    ? { ...(record.metadata as Record<string, any>) }
    : {};
  const billing = metadata.billing && typeof metadata.billing === 'object'
    ? { ...(metadata.billing as Record<string, any>) }
    : {};

  if (billing.trial_consumed === true) {
    return;
  }

  await markTrialConsumedForScope({
    supabase,
    scope,
    id,
    metadata,
    billing,
    planId,
    trialEnd,
    source: source || 'mercadopago_subscription_trial',
  });
}

async function upsertProviderSubscription(params: {
  supabase: any;
  applicationId: string;
  plan: ApplicationBillingPlanRecord;
  tenantId?: string | null;
  appUserId?: string | null;
  payerEmail: string;
  providerSubscription: Record<string, any>;
  source?: string;
  environmentName?: string | null;
}) {
  const {
    supabase,
    applicationId,
    plan,
    tenantId,
    appUserId,
    payerEmail,
    providerSubscription,
    source,
    environmentName,
  } = params;

  const providerTrialEnd = resolveProviderTrialEnd(providerSubscription);
  const currentStatus = providerTrialEnd
    ? 'trialing'
    : mapMercadoPagoSubscriptionStatus(providerSubscription.status);
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const planProviderState = resolvePlanProviderState(plan, normalizedEnvironment);
  const { data: existing } = await supabase
    .from('application_plan_subscriptions')
    .select('id, metadata')
    .eq('provider', 'mercadopago')
    .eq('provider_subscription_id', providerSubscription.id)
    .maybeSingle();

  const existingMetadata = existing?.metadata && typeof existing.metadata === 'object'
    ? { ...(existing.metadata as Record<string, any>) }
    : {};

  const payload = {
    application_id: applicationId,
    application_plan_id: plan.id,
    tenant_id: tenantId || null,
    app_user_id: appUserId || null,
    payer_email: payerEmail,
    external_reference: String(providerSubscription.external_reference || `${applicationId}:${plan.id}:${payerEmail}`),
    status: currentStatus,
    provider: 'mercadopago',
    provider_subscription_id: providerSubscription.id,
    provider_plan_id: providerSubscription.preapproval_plan_id || planProviderState.provider_plan_id || null,
    next_payment_date: providerSubscription.next_payment_date || null,
    current_period_start: providerSubscription.auto_recurring?.start_date || null,
    current_period_end: providerSubscription.auto_recurring?.end_date || null,
    trial_end: providerTrialEnd,
    provider_metadata: providerSubscription,
    metadata: {
      ...existingMetadata,
      source: source || 'mercadopago_sync',
      last_synced_at: new Date().toISOString(),
      billing_environment: normalizedEnvironment,
    },
  };

  if (existing?.id) {
    await supabase
      .from('application_plan_subscriptions')
      .update(payload)
      .eq('id', existing.id);
  } else {
    await supabase
      .from('application_plan_subscriptions')
      .insert(payload);
  }

  const hasProviderFreeTrial = Boolean(providerSubscription?.auto_recurring?.free_trial);
  if (hasProviderFreeTrial) {
    const trialScope: 'tenant' | 'app_user' | 'none' = tenantId ? 'tenant' : appUserId ? 'app_user' : 'none';
    const trialScopeId = tenantId || appUserId || null;

    await markProviderTrialConsumedForScope({
      supabase,
      scope: trialScope,
      id: trialScopeId,
      planId: plan.id,
      trialEnd: providerTrialEnd || null,
      source: source || 'mercadopago_checkout',
    });
  }
}

export async function syncMercadoPagoSubscriptionById(params: {
  supabase: any;
  application: Record<string, any>;
  providerSubscriptionId: string;
  selectedPlanId?: string | null;
  tenantId?: string | null;
  appUserId?: string | null;
  payerEmail?: string | null;
  source?: string;
  environmentName?: string | null;
}) {
  const {
    supabase,
    application,
    providerSubscriptionId,
    selectedPlanId,
    tenantId,
    appUserId,
    payerEmail,
    source,
    environmentName,
  } = params;

  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const config = normalizeMercadoPagoConfig(application.billing_config || {}, normalizedEnvironment);
  if (!config.enabled || !config.accessToken || !providerSubscriptionId) {
    return null;
  }

  const providerSubscription = await mercadoPagoRequest(
    config,
    'GET',
    `/preapproval/${providerSubscriptionId}`,
  );

  const activePlans = await getActivePlans(supabase, application.id);
  const targetPlan = (
    (selectedPlanId
      ? activePlans.find((plan) => plan.id === selectedPlanId)
      : null) ||
    activePlans.find((plan) => {
      const providerState = resolvePlanProviderState(plan, normalizedEnvironment);
      return providerState.provider_plan_id && providerState.provider_plan_id === providerSubscription?.preapproval_plan_id;
    }) ||
    null
  );

  if (!targetPlan) {
    return {
      providerSubscription,
      subscription: null,
      plan: null,
    };
  }

  const resolvedEmail = String(
    payerEmail ||
    providerSubscription?.payer_email ||
    ''
  ).trim().toLowerCase();

  await upsertProviderSubscription({
    supabase,
    applicationId: application.id,
    plan: targetPlan,
    tenantId,
    appUserId,
    payerEmail: resolvedEmail,
    providerSubscription,
    source: source || 'mercadopago_checkout',
    environmentName: normalizedEnvironment,
  });

  const subscription = await getScopedSubscription(
    supabase,
    application.id,
    tenantId,
    appUserId,
    normalizedEnvironment,
  );

  return {
    providerSubscription,
    subscription,
    plan: targetPlan,
  };
}

async function syncSubscriptionFromMercadoPago(params: {
  supabase: any;
  application: Record<string, any>;
  plans: ApplicationBillingPlanRecord[];
  payerEmail: string;
  tenantId?: string | null;
  appUserId?: string | null;
  environmentName?: string | null;
}) {
  const { supabase, application, plans, payerEmail, tenantId, appUserId, environmentName } = params;
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const config = normalizeMercadoPagoConfig(application.billing_config || {}, normalizedEnvironment);

  if (!config.enabled || !config.accessToken || !config.autoSyncOnLogin || !payerEmail) {
    return null;
  }

  for (const plan of plans) {
    const providerState = resolvePlanProviderState(plan, normalizedEnvironment);
    if (!providerState.provider_plan_id) continue;

    try {
      const response = await mercadoPagoRequest(
        config,
        'GET',
        '/preapproval/search',
        {
          query: {
            payer_email: payerEmail,
            preapproval_plan_id: providerState.provider_plan_id,
          },
        },
      );

      const results = Array.isArray(response?.results) ? response.results : [];
      const matching = results.find((item: any) => isBillableSubscriptionActive(item?.status));

      if (!matching) continue;

      await upsertProviderSubscription({
        supabase,
        applicationId: application.id,
        plan,
        tenantId,
        appUserId,
        payerEmail,
        providerSubscription: matching,
        source: 'mercadopago_sync',
        environmentName: normalizedEnvironment,
      });

      return matching;
    } catch (error) {
      console.warn('Mercado Pago subscription sync failed for plan', plan.id, error);
    }
  }

  return null;
}

export async function createLocalPlanSubscription(params: {
  supabase: any;
  applicationId: string;
  plan: ApplicationBillingPlanRecord;
  tenantId?: string | null;
  appUserId?: string | null;
  payerEmail?: string | null;
  source?: string;
  environmentName?: string | null;
}) {
  const { supabase, applicationId, plan, tenantId, appUserId, payerEmail, source, environmentName } = params;
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const planProviderState = resolvePlanProviderState(plan, normalizedEnvironment);
  const now = new Date();
  const price = Number(plan.price || 0);
  const trialDays = Number(plan.trial_days || 0);
  const hasTrial = trialDays > 0;

  const currentPeriodStart = now.toISOString();
  const trialEnd = hasTrial
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const currentPeriodEnd = trialEnd || calculatePeriodEnd(plan, now);

  const status = hasTrial ? 'trialing' : (price === 0 ? 'active' : 'pending');

  const existing = await getScopedSubscription(supabase, applicationId, tenantId, appUserId, normalizedEnvironment);
  const payload = {
    application_id: applicationId,
    application_plan_id: plan.id,
    tenant_id: tenantId || null,
    app_user_id: appUserId || null,
    payer_email: payerEmail || null,
    external_reference: `${applicationId}:${plan.id}:${tenantId || appUserId || payerEmail || 'scope'}`,
    status,
    provider: price === 0 ? 'internal' : (planProviderState.provider || 'mercadopago'),
    provider_plan_id: planProviderState.provider_plan_id || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_end: trialEnd,
    metadata: {
      source: source || 'auto_provision',
      auto_created: true,
      selected_plan_id: plan.id,
      billing_environment: normalizedEnvironment,
    },
  };

  if (existing?.id) {
    const existingStatus = String(existing.status || '').toLowerCase();
    if (ACTIVE_SUBSCRIPTION_STATUSES.includes(existingStatus)) {
      return existing;
    }

    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .update(payload)
      .eq('id', existing.id)
      .select(`
        *,
        application_billing_plans(
          *,
          application_billing_plan_features(
            id,
            value,
            sort_order,
            application_billing_features(
              id,
              code,
              name,
              description,
              value_type,
              default_value,
              category,
              unit,
              active
            )
          )
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('application_plan_subscriptions')
    .insert(payload)
    .select(`
      *,
      application_billing_plans(
        *,
        application_billing_plan_features(
          id,
          value,
          sort_order,
          application_billing_features(
            id,
            code,
            name,
            description,
            value_type,
            default_value,
            category,
            unit,
            active
          )
        )
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function ensureSelectedPlanSubscription(params: {
  supabase: any;
  application: Record<string, any>;
  selectedPlanId?: string | null;
  tenantId?: string | null;
  appUserId?: string | null;
  payerEmail?: string | null;
  context?: 'initial_registration' | 'runtime_access';
  source?: string;
  environmentName?: string | null;
}) {
  const {
    supabase,
    application,
    selectedPlanId,
    tenantId,
    appUserId,
    payerEmail,
    context = 'runtime_access',
    source,
    environmentName,
  } = params;
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const config = normalizeMercadoPagoConfig(application.billing_config || {}, normalizedEnvironment);
  if (!config.enabled || !config.autoAssignDefaultPlan) {
    return null;
  }

  const activePlans = await getActivePlans(supabase, application.id);
  const targetPlan = (selectedPlanId
    ? activePlans.find((plan) => plan.id === selectedPlanId)
    : activePlans.find((plan) => plan.is_default)) || null;

  if (!targetPlan) return null;

  const price = Number(targetPlan.price || 0);
  const trialDays = Number(targetPlan.trial_days || 0);
  const hasTrial = trialDays > 0;
  const trialUsage = await getScopedTrialUsage({
    supabase,
    applicationId: application.id,
    tenantId,
    appUserId,
  });
  const allowInitialTrial = context === 'initial_registration' && hasTrial && !trialUsage.consumed;
  const canProvisionAutomatically = price === 0 || allowInitialTrial;
  if (!canProvisionAutomatically) return null;

  const subscription = await createLocalPlanSubscription({
    supabase,
    applicationId: application.id,
    plan: targetPlan,
    tenantId,
    appUserId,
    payerEmail,
    source: source || (allowInitialTrial ? 'initial_plan_trial' : 'default_plan_assignment'),
    environmentName: normalizedEnvironment,
  });

  if (allowInitialTrial) {
    await markTrialConsumedForScope({
      supabase,
      scope: trialUsage.scope,
      id: trialUsage.id,
      metadata: trialUsage.metadata,
      billing: trialUsage.billing,
      planId: targetPlan.id,
      trialEnd: subscription?.trial_end || null,
      source: source || 'initial_plan_trial',
    });
  }

  return subscription;
}

export async function resolveApplicationBillingAccess(params: {
  supabase: any;
  application: Record<string, any>;
  appUser: Record<string, any>;
  tenantId?: string | null;
  environmentName?: string | null;
}) {
  const { supabase, application, appUser, tenantId, environmentName } = params;
  const normalizedEnvironment = normalizeBillingEnvironmentName(environmentName);
  const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {}, normalizedEnvironment);
  const plans = await getActivePlans(supabase, application.id);
  const baseAvailablePlans = plans.map((plan) => buildAvailablePlan(plan, {
    backUrl: billingConfig.backUrl || null,
    managedCheckout: true,
    environmentName: normalizedEnvironment,
  }));

  if (!billingConfig.enabled) {
    return {
      enabled: false,
      success: true,
      has_access: true,
      available_plans: baseAvailablePlans,
      subscription: null,
      license: {
        source: 'none',
        status: 'not_required',
        provider: null,
      },
    };
  }

  let selectedPlanId: string | null = null;
  if (tenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();
    selectedPlanId = String(tenant?.metadata?.plan_id || '') || null;
  } else if (appUser?.metadata?.plan_id) {
    selectedPlanId = String(appUser.metadata.plan_id);
  }

  let subscription = await getScopedSubscription(supabase, application.id, tenantId, appUser.id, normalizedEnvironment);

  if (!subscription && appUser.email) {
    await syncSubscriptionFromMercadoPago({
      supabase,
      application,
      plans,
      payerEmail: appUser.email,
      tenantId,
      appUserId: appUser.id,
      environmentName: normalizedEnvironment,
    });
    subscription = await getScopedSubscription(supabase, application.id, tenantId, appUser.id, normalizedEnvironment);
  }

  if (!subscription) {
    const provisioned = await ensureSelectedPlanSubscription({
      supabase,
      application,
      selectedPlanId,
      tenantId,
      appUserId: appUser.id,
      payerEmail: appUser.email || null,
      context: 'runtime_access',
      source: 'runtime_access_resolution',
      environmentName: normalizedEnvironment,
    });
    if (provisioned) {
      subscription = provisioned;
    }
  }

  const planRecord = subscription?.application_billing_plans || null;
  const availablePlans = plans.map((plan) =>
    buildAvailablePlan(plan, {
      backUrl: billingConfig.backUrl || null,
      currentPlanId: planRecord?.id || null,
      currentPlanPrice: Number(planRecord?.price || 0),
      managedCheckout: true,
      environmentName: normalizedEnvironment,
    })
  );
  const entitlements = planRecord ? normalizeEntitlements(planRecord) : { features: [] };
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const effectiveEnd = String(subscription?.status || '').toLowerCase() === 'trialing' && trialEnd
    ? trialEnd
    : periodEnd;
  const subscriptionActive = subscription
    ? isBillableSubscriptionActive(subscription.status) && (!effectiveEnd || effectiveEnd >= new Date())
    : false;
  const subscriptionCancellable = subscription
    ? isBillableSubscriptionCancellable(subscription.status)
    : false;

  const hasAccess = plans.length === 0
    ? true
    : (billingConfig.requirePlanForAccess ? subscriptionActive : true);

  console.log('💳 Billing access resolved:', {
    application_id: application.id,
    environment: normalizedEnvironment,
    billing_enabled: billingConfig.enabled,
    require_plan_for_access: billingConfig.requirePlanForAccess,
    selected_plan_id: selectedPlanId,
    subscription_id: subscription?.id || null,
    subscription_status: subscription?.status || null,
    subscription_active: subscriptionActive,
    has_access: hasAccess,
    available_plans_count: availablePlans.length,
  });

  return {
    enabled: true,
    success: true,
    has_access: hasAccess,
    available_plans: availablePlans,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          provider: subscription.provider,
          provider_subscription_id: subscription.provider_subscription_id,
          provider_plan_id: subscription.provider_plan_id,
          plan_id: planRecord?.id || subscription.application_plan_id,
          plan_name: planRecord?.name || null,
          payer_email: subscription.payer_email || appUser.email || null,
          current_period_start: subscription.current_period_start || null,
          current_period_end: subscription.current_period_end || null,
          next_payment_date: subscription.next_payment_date || null,
          trial_end: subscription.trial_end || null,
          can_cancel: subscriptionCancellable,
          entitlements,
          metadata: subscription.metadata || {},
        }
      : null,
    license: {
      source: 'internal',
      status: subscriptionActive ? 'active' : 'inactive',
      provider: planRecord?.provider || billingConfig.provider,
      selected_plan_id: selectedPlanId,
      active_subscription_id: subscription?.id || null,
      plan_required: billingConfig.requirePlanForAccess,
    },
  };
}

export function isBillableSubscriptionCancellable(status: string | null | undefined) {
  return CANCELLABLE_SUBSCRIPTION_STATUSES.includes((status || '').toLowerCase());
}
