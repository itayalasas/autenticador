import { supabase } from '../lib/supabase';
import {
  ApplicationBillingConfig,
  BillingEnvironmentName,
  ApplicationBillingFeatureCatalogItem,
  ApplicationBillingPlan,
  ApplicationPlanSubscription,
  BillingFeatureValueType,
} from '../types';

export interface EditableApplicationBillingPlan extends Partial<ApplicationBillingPlan> {
  application_id: string;
}

export interface ApplicationWalletBalance {
  id: string;
  application_id: string;
  tenant_id: string | null;
  app_user_id: string | null;
  balance: number;
  currency: string;
  updated_at: string;
  created_at: string;
  tenants?: { id: string; name: string; slug: string } | null;
  app_users?: { id: string; name: string; email: string } | null;
}

export interface ApplicationWalletTransaction {
  id: string;
  wallet_balance_id: string;
  type: 'topup' | 'debit' | 'refund' | 'adjustment';
  amount: number;
  currency: string;
  balance_after: number;
  reference: string | null;
  feature_code: string | null;
  provider: string | null;
  status: string;
  created_at: string;
}

export interface PlanEditorFeatureValue {
  feature_id?: string;
  code: string;
  name: string;
  description: string;
  value_type: BillingFeatureValueType;
  default_value: string;
  value: string;
  category: string;
  unit?: string | null;
  active?: boolean;
}

export interface PlanEditorValues {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  repetitions?: number | null;
  trial_days: number;
  billing_day?: number | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  features: string[];
  plan_features: PlanEditorFeatureValue[];
}

export interface CreateBillingFeatureInput {
  code: string;
  name: string;
  description: string;
  value_type: BillingFeatureValueType;
  default_value: string;
  category: string;
  unit?: string | null;
  active?: boolean;
}

export interface CancelManagedSubscriptionInput {
  application_id: string;
  api_key: string;
  subscription_id?: string;
  provider_subscription_id?: string;
  tenant_id?: string;
  app_user_id?: string;
  cancel_reason?: string;
}

const STANDARD_FEATURE_CATEGORIES = new Set([
  'limits',
  'integrations',
  'security',
  'support',
  'branding',
  'analytics',
  'developer_experience',
]);

type RawPlanFeatureRelation = {
  id?: string;
  value?: string | number | boolean | null;
  sort_order?: number | null;
  application_billing_features?: Record<string, any> | null;
};

function normalizeValueType(value: unknown): BillingFeatureValueType {
  if (value === 'boolean' || value === 'number' || value === 'text' || value === 'string') {
    return value === 'string' ? 'text' : value;
  }
  return 'text';
}

function normalizeFeatureCode(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60);
}

function normalizeFeatureCategory(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (STANDARD_FEATURE_CATEGORIES.has(normalized)) {
    return normalized;
  }

  if (normalized === 'features') {
    return 'developer_experience';
  }

  return 'limits';
}

function normalizeFeatureName(value: unknown, fallbackCode = '') {
  const normalized = String(value || '').trim();
  return normalized || fallbackCode;
}

function normalizeFeatureDescription(value: unknown) {
  return String(value || '').trim();
}

function normalizeFeatureUnit(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function stringifyFeatureValue(value: unknown, valueType?: BillingFeatureValueType | string) {
  if (value === null || value === undefined) {
    return valueType === 'boolean' ? 'false' : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function normalizeCatalogFeature(row: any): ApplicationBillingFeatureCatalogItem {
  return {
    id: row.id,
    code: normalizeFeatureCode(row.code),
    name: normalizeFeatureName(row.name, normalizeFeatureCode(row.code)),
    description: normalizeFeatureDescription(row.description),
    value_type: normalizeValueType(row.value_type),
    default_value: stringifyFeatureValue(row.default_value, row.value_type),
    category: normalizeFeatureCategory(row.category),
    unit: normalizeFeatureUnit(row.unit),
    active: row.active !== false,
    is_system: row.is_system === true,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeEntitlementFeature(raw: any, fallback?: Partial<ApplicationBillingFeatureCatalogItem>): PlanEditorFeatureValue {
  const valueType = normalizeValueType(raw?.value_type ?? fallback?.value_type);
  const defaultValue = stringifyFeatureValue(raw?.default_value ?? fallback?.default_value, valueType);
  const value = stringifyFeatureValue(raw?.value ?? defaultValue, valueType);
  const normalizedCode = normalizeFeatureCode(raw?.code || fallback?.code || '');

  return {
    feature_id: raw?.feature_id || fallback?.id,
    code: normalizedCode,
    name: normalizeFeatureName(raw?.name || fallback?.name, normalizedCode),
    description: normalizeFeatureDescription(raw?.description || fallback?.description),
    value_type: valueType,
    default_value: defaultValue,
    value,
    category: normalizeFeatureCategory(raw?.category || fallback?.category || 'limits'),
    unit: normalizeFeatureUnit(raw?.unit ?? fallback?.unit),
    active: raw?.active ?? fallback?.active ?? true,
  };
}

function mapPlanFeatureRelation(relation: RawPlanFeatureRelation): PlanEditorFeatureValue | null {
  const feature = relation.application_billing_features;
  if (!feature) return null;

  return normalizeEntitlementFeature(
    {
      feature_id: feature.id,
      code: feature.code,
      name: feature.name,
      description: feature.description,
      value_type: feature.value_type,
      default_value: feature.default_value,
      category: feature.category,
      unit: feature.unit,
      active: feature.active,
      value: relation.value ?? feature.default_value,
    },
    normalizeCatalogFeature(feature)
  );
}

function buildEntitlements(values: PlanEditorValues) {
  return {
    features: values.plan_features.map((feature) => ({
      feature_id: feature.feature_id,
      code: normalizeFeatureCode(feature.code),
      name: normalizeFeatureName(feature.name, feature.code),
      description: normalizeFeatureDescription(feature.description),
      value: stringifyFeatureValue(feature.value, feature.value_type),
      value_type: feature.value_type,
      unit: normalizeFeatureUnit(feature.unit),
      category: normalizeFeatureCategory(feature.category),
    })),
  };
}

async function ensureFeatureCatalogEntry(input: CreateBillingFeatureInput): Promise<ApplicationBillingFeatureCatalogItem> {
  const normalizedCode = normalizeFeatureCode(input.code);
  if (!normalizedCode) {
    throw new Error('El codigo de la funcionalidad es obligatorio');
  }

  const { data: existing, error: existingError } = await supabase
    .from('application_billing_features')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return normalizeCatalogFeature(existing);

  const payload = {
    code: normalizedCode,
    name: normalizeFeatureName(input.name, normalizedCode),
    description: normalizeFeatureDescription(input.description),
    value_type: normalizeValueType(input.value_type),
    default_value: stringifyFeatureValue(input.default_value, input.value_type),
    category: normalizeFeatureCategory(input.category),
    unit: normalizeFeatureUnit(input.unit),
    active: input.active !== false,
  };

  const { data, error } = await supabase
    .from('application_billing_features')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: duplicated } = await supabase
        .from('application_billing_features')
        .select('*')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (duplicated) return normalizeCatalogFeature(duplicated);
    }

    throw error;
  }

  return normalizeCatalogFeature(data);
}

export const applicationBillingService = {
  async getApplicationBillingConfig(applicationId: string): Promise<ApplicationBillingConfig> {
    const { data, error } = await supabase
      .from('applications')
      .select('billing_config')
      .eq('id', applicationId)
      .single();

    if (error) throw error;
    return (data?.billing_config || {}) as ApplicationBillingConfig;
  },

  async saveApplicationBillingConfig(applicationId: string, config: ApplicationBillingConfig) {
    const { error } = await supabase
      .from('applications')
      .update({
        billing_config: config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) throw error;
  },

  async getFeatureCatalog(): Promise<ApplicationBillingFeatureCatalogItem[]> {
    const { data, error } = await supabase
      .from('application_billing_features')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeCatalogFeature);
  },

  async createFeatureCatalogItem(input: CreateBillingFeatureInput): Promise<ApplicationBillingFeatureCatalogItem> {
    return ensureFeatureCatalogEntry(input);
  },

  async getPlans(applicationId: string): Promise<ApplicationBillingPlan[]> {
    const { data, error } = await supabase
      .from('application_billing_plans')
      .select(`
        *,
        application_billing_plan_features(
          id,
          value,
          sort_order,
          application_billing_features(*)
        )
      `)
      .eq('application_id', applicationId)
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => {
      const relationalFeatures = Array.isArray(row.application_billing_plan_features)
        ? row.application_billing_plan_features
          .slice()
          .sort((left: RawPlanFeatureRelation, right: RawPlanFeatureRelation) => Number(left.sort_order || 0) - Number(right.sort_order || 0))
          .map(mapPlanFeatureRelation)
          .filter(Boolean)
        : [];

      const fallbackFeatures = relationalFeatures.length > 0
        ? relationalFeatures
        : (Array.isArray(row.entitlements?.features) ? row.entitlements.features : []).map((feature: any) => normalizeEntitlementFeature(feature));

      return {
        ...row,
        price: Number(row.price || 0),
        interval_count: Number(row.interval_count || 1),
        trial_days: Number(row.trial_days || 0),
        sort_order: Number(row.sort_order || 0),
        features: Array.isArray(row.features) ? row.features : [],
        entitlements: {
          ...(row.entitlements || {}),
          features: fallbackFeatures,
        },
        provider_metadata: row.provider_metadata || {},
        metadata: row.metadata || {},
      };
    }) as ApplicationBillingPlan[];
  },

  async getSubscriptions(applicationId: string): Promise<ApplicationPlanSubscription[]> {
    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .select(`
        *,
        application_billing_plans(
          id,
          name,
          slug,
          price,
          currency,
          interval,
          interval_count
        ),
        tenants(
          id,
          name,
          slug
        ),
        app_users(
          id,
          name,
          email
        )
      `)
      .eq('application_id', applicationId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ApplicationPlanSubscription[];
  },

  async getWalletBalances(applicationId: string): Promise<ApplicationWalletBalance[]> {
    const { data, error } = await supabase
      .from('wallet_balances')
      .select(`
        *,
        tenants(
          id,
          name,
          slug
        ),
        app_users(
          id,
          name,
          email
        )
      `)
      .eq('application_id', applicationId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ApplicationWalletBalance[];
  },

  async getWalletTransactions(walletBalanceId: string, limit = 20): Promise<ApplicationWalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_balance_id', walletBalanceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ApplicationWalletTransaction[];
  },

  async savePlan(plan: EditableApplicationBillingPlan, editorValues: PlanEditorValues) {
    const normalizedPlanFeatures = editorValues.plan_features.map((feature) => ({
      ...feature,
      code: normalizeFeatureCode(feature.code),
      name: normalizeFeatureName(feature.name, feature.code),
      description: normalizeFeatureDescription(feature.description),
      category: normalizeFeatureCategory(feature.category),
      value: stringifyFeatureValue(feature.value, feature.value_type),
      default_value: stringifyFeatureValue(feature.default_value, feature.value_type),
      unit: normalizeFeatureUnit(feature.unit),
    }));

    const payload = {
      application_id: plan.application_id,
      name: editorValues.name.trim(),
      slug: editorValues.slug.trim(),
      description: editorValues.description.trim(),
      price: editorValues.price,
      currency: editorValues.currency.trim().toUpperCase(),
      interval: editorValues.interval,
      interval_count: Math.max(1, Number(editorValues.interval_count || 1)),
      repetitions: editorValues.repetitions || null,
      trial_days: Math.max(0, Number(editorValues.trial_days || 0)),
      billing_day: editorValues.billing_day || null,
      is_active: editorValues.is_active,
      is_default: editorValues.is_default,
      sort_order: Number(editorValues.sort_order || 0),
      features: editorValues.features.filter(Boolean),
      entitlements: buildEntitlements({
        ...editorValues,
        plan_features: normalizedPlanFeatures,
      }),
      provider: 'mercadopago',
      updated_at: new Date().toISOString(),
    };

    if (editorValues.is_default) {
      let clearDefaultQuery = supabase
        .from('application_billing_plans')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('application_id', plan.application_id);

      if (plan.id) {
        clearDefaultQuery = clearDefaultQuery.neq('id', plan.id);
      }

      const { error: clearDefaultError } = await clearDefaultQuery;
      if (clearDefaultError) throw clearDefaultError;
    }

    let savedPlan: ApplicationBillingPlan | null = null;

    if (plan.id) {
      const { data, error } = await supabase
        .from('application_billing_plans')
        .update(payload)
        .eq('id', plan.id)
        .select('*')
        .single();

      if (error) throw error;
      savedPlan = data as ApplicationBillingPlan;
    } else {
      const { data, error } = await supabase
        .from('application_billing_plans')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;
      savedPlan = data as ApplicationBillingPlan;
    }

    if (!savedPlan?.id) {
      throw new Error('No se pudo resolver el plan guardado');
    }

    const ensuredFeatures = await Promise.all(
      normalizedPlanFeatures.map(async (feature) => {
        const catalogFeature = await ensureFeatureCatalogEntry({
          code: feature.code,
          name: feature.name,
          description: feature.description,
          value_type: feature.value_type,
          default_value: feature.default_value,
          category: feature.category,
          unit: feature.unit || null,
          active: feature.active !== false,
        });

        return {
          feature_id: catalogFeature.id,
          value: stringifyFeatureValue(feature.value, feature.value_type),
        };
      })
    );

    const { error: deleteAssignmentsError } = await supabase
      .from('application_billing_plan_features')
      .delete()
      .eq('application_plan_id', savedPlan.id);

    if (deleteAssignmentsError) throw deleteAssignmentsError;

    if (ensuredFeatures.length > 0) {
      const { error: insertAssignmentsError } = await supabase
        .from('application_billing_plan_features')
        .insert(
          ensuredFeatures.map((feature, index) => ({
            application_plan_id: savedPlan.id,
            feature_id: feature.feature_id,
            value: feature.value,
            sort_order: index,
          }))
        );

      if (insertAssignmentsError) throw insertAssignmentsError;
    }

    return savedPlan;
  },

  async deletePlan(planId: string) {
    const { error } = await supabase
      .from('application_billing_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;
  },

  async syncPlanWithMercadoPago(applicationPlanId: string, environment?: BillingEnvironmentName | null) {
    const { data, error } = await supabase.functions.invoke('mercadopago-sync-plan', {
      body: {
        application_plan_id: applicationPlanId,
        environment: environment || null,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      throw new Error(data?.error?.message || 'No se pudo sincronizar el plan con Mercado Pago');
    }

    return data.data;
  },

  async cancelManagedSubscription(input: CancelManagedSubscriptionInput) {
    const { data, error } = await supabase.functions.invoke('subscription-cancel', {
      body: input,
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      throw new Error(data?.error?.message || 'No se pudo cancelar la suscripcion');
    }

    return data.data;
  },
};
