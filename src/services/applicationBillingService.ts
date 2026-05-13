import { supabase } from '../lib/supabase';
import {
  ApplicationBillingConfig,
  ApplicationBillingFeatureCatalogItem,
  ApplicationBillingPlan,
  ApplicationPlanSubscription,
  BillingFeatureValueType,
} from '../types';

export interface EditableApplicationBillingPlan extends Partial<ApplicationBillingPlan> {
  application_id: string;
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

type RawPlanFeatureRelation = {
  id?: string;
  value?: string | number | boolean | null;
  sort_order?: number | null;
  application_billing_features?: Record<string, any> | null;
};

function normalizeValueType(value: unknown): BillingFeatureValueType {
  if (value === 'boolean' || value === 'number' || value === 'text') {
    return value;
  }
  return 'text';
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
    code: String(row.code || '').trim(),
    name: String(row.name || '').trim(),
    description: String(row.description || '').trim(),
    value_type: normalizeValueType(row.value_type),
    default_value: stringifyFeatureValue(row.default_value, row.value_type),
    category: String(row.category || 'features').trim() || 'features',
    unit: row.unit ? String(row.unit).trim() : null,
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

  return {
    feature_id: raw?.feature_id || fallback?.id,
    code: String(raw?.code || fallback?.code || '').trim(),
    name: String(raw?.name || fallback?.name || raw?.code || '').trim(),
    description: String(raw?.description || fallback?.description || '').trim(),
    value_type: valueType,
    default_value: defaultValue,
    value,
    category: String(raw?.category || fallback?.category || 'features').trim() || 'features',
    unit: raw?.unit ?? fallback?.unit ?? null,
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
      code: feature.code.trim(),
      name: feature.name.trim(),
      description: feature.description.trim(),
      value: stringifyFeatureValue(feature.value, feature.value_type),
      value_type: feature.value_type,
      unit: feature.unit || null,
      category: feature.category.trim() || 'features',
    })),
  };
}

async function ensureFeatureCatalogEntry(input: CreateBillingFeatureInput): Promise<ApplicationBillingFeatureCatalogItem> {
  const normalizedCode = String(input.code || '').trim();
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
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    value_type: normalizeValueType(input.value_type),
    default_value: stringifyFeatureValue(input.default_value, input.value_type),
    category: String(input.category || 'features').trim() || 'features',
    unit: input.unit ? String(input.unit).trim() : null,
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

  async savePlan(plan: EditableApplicationBillingPlan, editorValues: PlanEditorValues) {
    const normalizedPlanFeatures = editorValues.plan_features.map((feature) => ({
      ...feature,
      code: feature.code.trim(),
      name: feature.name.trim(),
      description: feature.description.trim(),
      category: feature.category.trim() || 'features',
      value: stringifyFeatureValue(feature.value, feature.value_type),
      default_value: stringifyFeatureValue(feature.default_value, feature.value_type),
      unit: feature.unit ? String(feature.unit).trim() : null,
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

  async syncPlanWithMercadoPago(applicationPlanId: string) {
    const { data, error } = await supabase.functions.invoke('mercadopago-sync-plan', {
      body: {
        application_plan_id: applicationPlanId,
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
};
