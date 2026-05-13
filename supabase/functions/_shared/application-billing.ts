import {
  ApplicationBillingPlanRecord,
  isBillableSubscriptionActive,
  mapMercadoPagoSubscriptionStatus,
  mercadoPagoRequest,
  normalizeMercadoPagoConfig,
} from './mercadopago.ts';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'authorized', 'trialing'];

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

function normalizeEntitlements(plan: ApplicationBillingPlanRecord) {
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
  options: { backUrl?: string | null; currentPlanId?: string | null; currentPlanPrice?: number } = {},
) {
  const price = Number(plan.price || 0);
  const checkoutUrl = plan.provider_init_point || (plan.provider_metadata as any)?.init_point || null;
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
    provider: plan.provider || 'mercadopago',
    provider_plan_id: plan.provider_plan_id || null,
    provider_status: plan.provider_status || null,
    plan_token: plan.provider_plan_id || plan.id,
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
    mp_preapproval_plan_id: plan.provider_plan_id || null,
    mp_status: plan.provider_status || null,
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

async function getScopedSubscription(
  supabase: any,
  applicationId: string,
  tenantId?: string | null,
  appUserId?: string | null,
) {
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
    .limit(1);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  } else if (appUserId) {
    query = query.eq('app_user_id', appUserId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
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
  } = params;

  const currentStatus = mapMercadoPagoSubscriptionStatus(providerSubscription.status);
  const { data: existing } = await supabase
    .from('application_plan_subscriptions')
    .select('id')
    .eq('provider', 'mercadopago')
    .eq('provider_subscription_id', providerSubscription.id)
    .maybeSingle();

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
    provider_plan_id: providerSubscription.preapproval_plan_id || plan.provider_plan_id || null,
    next_payment_date: providerSubscription.next_payment_date || null,
    current_period_start: providerSubscription.auto_recurring?.start_date || null,
    current_period_end: providerSubscription.auto_recurring?.end_date || null,
    trial_end: providerSubscription.auto_recurring?.free_trial ? providerSubscription.auto_recurring?.start_date || null : null,
    provider_metadata: providerSubscription,
    metadata: {
      source: source || 'mercadopago_sync',
      last_synced_at: new Date().toISOString(),
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
  } = params;

  const config = normalizeMercadoPagoConfig(application.billing_config || {});
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
    activePlans.find((plan) => plan.provider_plan_id && plan.provider_plan_id === providerSubscription?.preapproval_plan_id) ||
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
  });

  const subscription = await getScopedSubscription(
    supabase,
    application.id,
    tenantId,
    appUserId,
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
}) {
  const { supabase, application, plans, payerEmail, tenantId, appUserId } = params;
  const config = normalizeMercadoPagoConfig(application.billing_config || {});

  if (!config.enabled || !config.accessToken || !config.autoSyncOnLogin || !payerEmail) {
    return null;
  }

  for (const plan of plans) {
    if (!plan.provider_plan_id) continue;

    try {
      const response = await mercadoPagoRequest(
        config,
        'GET',
        '/preapproval/search',
        {
          query: {
            payer_email: payerEmail,
            preapproval_plan_id: plan.provider_plan_id,
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
}) {
  const { supabase, applicationId, plan, tenantId, appUserId, payerEmail, source } = params;
  const now = new Date();
  const price = Number(plan.price || 0);
  const trialDays = Number(plan.trial_days || 0);
  const hasTrial = trialDays > 0;

  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = calculatePeriodEnd(plan, now);
  const trialEnd = hasTrial
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const status = hasTrial ? 'trialing' : (price === 0 ? 'active' : 'pending');

  const existing = await getScopedSubscription(supabase, applicationId, tenantId, appUserId);
  const payload = {
    application_id: applicationId,
    application_plan_id: plan.id,
    tenant_id: tenantId || null,
    app_user_id: appUserId || null,
    payer_email: payerEmail || null,
    external_reference: `${applicationId}:${plan.id}:${tenantId || appUserId || payerEmail || 'scope'}`,
    status,
    provider: price === 0 ? 'internal' : (plan.provider || 'mercadopago'),
    provider_plan_id: plan.provider_plan_id || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_end: trialEnd,
    metadata: {
      source: source || 'auto_provision',
      auto_created: true,
      selected_plan_id: plan.id,
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
}) {
  const { supabase, application, selectedPlanId, tenantId, appUserId, payerEmail } = params;
  const config = normalizeMercadoPagoConfig(application.billing_config || {});
  if (!config.enabled || !config.autoAssignDefaultPlan) {
    return null;
  }

  const activePlans = await getActivePlans(supabase, application.id);
  const targetPlan = (selectedPlanId
    ? activePlans.find((plan) => plan.id === selectedPlanId)
    : activePlans.find((plan) => plan.is_default)) || null;

  if (!targetPlan) return null;

  const canProvisionAutomatically = Number(targetPlan.price || 0) === 0 || Number(targetPlan.trial_days || 0) > 0;
  if (!canProvisionAutomatically) return null;

  return createLocalPlanSubscription({
    supabase,
    applicationId: application.id,
    plan: targetPlan,
    tenantId,
    appUserId,
    payerEmail,
    source: 'default_plan_assignment',
  });
}

export async function resolveApplicationBillingAccess(params: {
  supabase: any;
  application: Record<string, any>;
  appUser: Record<string, any>;
  tenantId?: string | null;
}) {
  const { supabase, application, appUser, tenantId } = params;
  const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {});
  const plans = await getActivePlans(supabase, application.id);
  const baseAvailablePlans = plans.map((plan) => buildAvailablePlan(plan, { backUrl: billingConfig.backUrl || null }));

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

  let subscription = await getScopedSubscription(supabase, application.id, tenantId, appUser.id);

  if (!subscription && appUser.email) {
    await syncSubscriptionFromMercadoPago({
      supabase,
      application,
      plans,
      payerEmail: appUser.email,
      tenantId,
      appUserId: appUser.id,
    });
    subscription = await getScopedSubscription(supabase, application.id, tenantId, appUser.id);
  }

  if (!subscription) {
    const provisioned = await ensureSelectedPlanSubscription({
      supabase,
      application,
      selectedPlanId,
      tenantId,
      appUserId: appUser.id,
      payerEmail: appUser.email || null,
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
    })
  );
  const entitlements = planRecord ? normalizeEntitlements(planRecord) : { features: [] };
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const subscriptionActive = subscription
    ? isBillableSubscriptionActive(subscription.status) && (!periodEnd || periodEnd >= new Date())
    : false;

  const hasAccess = plans.length === 0
    ? true
    : (billingConfig.requirePlanForAccess ? subscriptionActive : true);

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
