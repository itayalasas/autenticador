import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApplicationBillingConfig,
  ApplicationBillingFeatureCatalogItem,
  ApplicationBillingPlan,
  BillingFeatureValueType,
} from '../../types';
import {
  applicationBillingService,
  CreateBillingFeatureInput,
  EditableApplicationBillingPlan,
  PlanEditorFeatureValue,
  PlanEditorValues,
} from '../../services/applicationBillingService';

interface ApplicationPlansManagerProps {
  applicationId: string;
  onSuccess: (title: string, message: string) => void;
  onError: (title: string, message: string) => void;
}

const EMPTY_EDITOR: PlanEditorValues = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  currency: 'UYU',
  interval: 'month',
  interval_count: 1,
  repetitions: null,
  trial_days: 0,
  billing_day: null,
  is_active: true,
  is_default: false,
  sort_order: 0,
  features: [],
  plan_features: [],
};

const EMPTY_FEATURE_DRAFT: PlanEditorFeatureValue = {
  code: '',
  name: '',
  description: '',
  value_type: 'boolean',
  default_value: 'false',
  value: 'false',
  category: 'features',
  unit: '',
  active: true,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function normalizeFeatureValue(value: unknown, valueType: BillingFeatureValueType) {
  if (value === null || value === undefined || value === '') {
    return valueType === 'boolean' ? 'false' : '';
  }

  if (valueType === 'boolean') {
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on', 'habilitado'].includes(normalized) ? 'true' : 'false';
  }

  return String(value);
}

function buildFeatureDraftFromCatalog(
  feature: ApplicationBillingFeatureCatalogItem,
  currentValue?: string,
): PlanEditorFeatureValue {
  const value = normalizeFeatureValue(
    currentValue ?? feature.default_value ?? '',
    feature.value_type,
  );

  return {
    feature_id: feature.id,
    code: feature.code,
    name: feature.name,
    description: feature.description,
    value_type: feature.value_type,
    default_value: normalizeFeatureValue(feature.default_value ?? '', feature.value_type),
    value,
    category: feature.category || 'features',
    unit: feature.unit || '',
    active: feature.active !== false,
  };
}

function toEditorValues(plan?: ApplicationBillingPlan | null): PlanEditorValues {
  if (!plan) return EMPTY_EDITOR;

  const planFeatures = Array.isArray(plan.entitlements?.features)
    ? plan.entitlements!.features!
      .map((feature) => ({
        feature_id: feature.feature_id,
        code: String(feature.code || '').trim(),
        name: String(feature.name || feature.code || '').trim(),
        description: String(feature.description || '').trim(),
        value_type: (feature.value_type === 'boolean' || feature.value_type === 'number' || feature.value_type === 'text')
          ? feature.value_type
          : 'text',
        default_value: normalizeFeatureValue(feature.value, (feature.value_type as BillingFeatureValueType) || 'text'),
        value: normalizeFeatureValue(feature.value, (feature.value_type as BillingFeatureValueType) || 'text'),
        category: String(feature.category || 'features').trim() || 'features',
        unit: feature.unit || '',
        active: true,
      }))
      .filter((feature) => feature.code)
    : [];

  return {
    name: plan.name || '',
    slug: plan.slug || '',
    description: plan.description || '',
    price: Number(plan.price || 0),
    currency: plan.currency || 'UYU',
    interval: plan.interval || 'month',
    interval_count: Number(plan.interval_count || 1),
    repetitions: plan.repetitions || null,
    trial_days: Number(plan.trial_days || 0),
    billing_day: plan.billing_day || null,
    is_active: plan.is_active !== false,
    is_default: plan.is_default === true,
    sort_order: Number(plan.sort_order || 0),
    features: Array.isArray(plan.features) ? plan.features : [],
    plan_features: planFeatures,
  };
}

function formatFeatureValue(feature: PlanEditorFeatureValue) {
  if (feature.value_type === 'boolean') {
    return String(feature.value).toLowerCase() === 'true' ? 'Habilitado' : 'Deshabilitado';
  }

  if (feature.unit) {
    return `${feature.value} ${feature.unit}`;
  }

  return feature.value;
}

function getCategoryTone(category: string) {
  switch ((category || '').toLowerCase()) {
    case 'security':
      return 'bg-violet-100 text-violet-800';
    case 'limits':
      return 'bg-blue-100 text-blue-800';
    case 'support':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-emerald-100 text-emerald-800';
  }
}

export default function ApplicationPlansManager({
  applicationId,
  onSuccess,
  onError,
}: ApplicationPlansManagerProps) {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);
  const [config, setConfig] = useState<ApplicationBillingConfig>({
    enabled: false,
    provider: 'mercadopago',
    mercado_pago_access_token: '',
    mercado_pago_public_key: '',
    mercado_pago_back_url: '',
    mercado_pago_webhook_secret: '',
    auto_sync_on_login: true,
    auto_assign_default_plan: true,
    require_plan_for_access: true,
  });
  const [plans, setPlans] = useState<ApplicationBillingPlan[]>([]);
  const [featureCatalog, setFeatureCatalog] = useState<ApplicationBillingFeatureCatalogItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EditableApplicationBillingPlan | null>(null);
  const [editorValues, setEditorValues] = useState<PlanEditorValues>(EMPTY_EDITOR);
  const [featureInput, setFeatureInput] = useState('');

  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [featureSearch, setFeatureSearch] = useState('');
  const [selectedCatalogFeatureId, setSelectedCatalogFeatureId] = useState<string | null>(null);
  const [creatingCustomFeature, setCreatingCustomFeature] = useState(false);
  const [featureDraft, setFeatureDraft] = useState<PlanEditorFeatureValue>(EMPTY_FEATURE_DRAFT);

  const hasMercadoPagoConfig = useMemo(() => {
    return Boolean(config.mercado_pago_access_token?.trim());
  }, [config.mercado_pago_access_token]);

  const catalogByCode = useMemo(() => {
    return featureCatalog.reduce<Record<string, ApplicationBillingFeatureCatalogItem>>((accumulator, feature) => {
      accumulator[feature.code] = feature;
      return accumulator;
    }, {});
  }, [featureCatalog]);

  const assignedFeatureCodes = useMemo(() => {
    return new Set(
      editorValues.plan_features
        .map((feature, index) => (index === editingFeatureIndex ? null : feature.code))
        .filter(Boolean) as string[],
    );
  }, [editorValues.plan_features, editingFeatureIndex]);

  const filteredCatalogFeatures = useMemo(() => {
    const search = featureSearch.trim().toLowerCase();
    return featureCatalog.filter((feature) => {
      if (assignedFeatureCodes.has(feature.code)) return false;
      if (!search) return true;

      return [
        feature.name,
        feature.code,
        feature.description,
        feature.category,
      ].some((value) => String(value || '').toLowerCase().includes(search));
    });
  }, [featureCatalog, featureSearch, assignedFeatureCodes]);

  const selectedCatalogFeature = useMemo(() => {
    if (!selectedCatalogFeatureId) return null;
    return featureCatalog.find((feature) => feature.id === selectedCatalogFeatureId) || null;
  }, [featureCatalog, selectedCatalogFeatureId]);

  const loadData = async (preferredPlanId?: string | null) => {
    try {
      setLoading(true);
      const [billingConfig, billingPlans, billingFeatures] = await Promise.all([
        applicationBillingService.getApplicationBillingConfig(applicationId),
        applicationBillingService.getPlans(applicationId),
        applicationBillingService.getFeatureCatalog(),
      ]);

      setConfig({
        enabled: billingConfig.enabled ?? false,
        provider: 'mercadopago',
        mercado_pago_access_token: billingConfig.mercado_pago_access_token || '',
        mercado_pago_public_key: billingConfig.mercado_pago_public_key || '',
        mercado_pago_back_url: billingConfig.mercado_pago_back_url || '',
        mercado_pago_webhook_secret: billingConfig.mercado_pago_webhook_secret || '',
        auto_sync_on_login: billingConfig.auto_sync_on_login ?? true,
        auto_assign_default_plan: billingConfig.auto_assign_default_plan ?? true,
        require_plan_for_access: billingConfig.require_plan_for_access ?? true,
      });
      setPlans(billingPlans);
      setFeatureCatalog(billingFeatures);

      const preferredPlan = preferredPlanId
        ? billingPlans.find((plan) => plan.id === preferredPlanId) || null
        : null;
      const initialPlan = preferredPlan || billingPlans[0] || null;

      if (initialPlan) {
        setSelectedPlan(initialPlan);
        setEditorValues(toEditorValues(initialPlan));
      } else {
        setSelectedPlan(null);
        setEditorValues(EMPTY_EDITOR);
      }
    } catch (error: any) {
      console.error('Error loading billing plans:', error);
      onError('Error al cargar planes', error?.message || 'No se pudo cargar la configuracion de planes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) {
      void loadData();
    }
  }, [applicationId]);

  useEffect(() => {
    setFeatureInput(editorValues.features.join('\n'));
  }, [editorValues]);

  const handleConfigChange = (key: keyof ApplicationBillingConfig, value: any) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      await applicationBillingService.saveApplicationBillingConfig(applicationId, config);
      onSuccess(
        'Facturacion guardada',
        'La configuracion interna de planes y Mercado Pago quedo guardada para esta aplicacion.',
      );
    } catch (error: any) {
      onError('No se pudo guardar la facturacion', error?.message || 'Ocurrio un error inesperado');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSelectPlan = (plan: ApplicationBillingPlan) => {
    setSelectedPlan(plan);
    setEditorValues(toEditorValues(plan));
  };

  const handleNewPlan = () => {
    setSelectedPlan({ application_id: applicationId });
    setEditorValues(EMPTY_EDITOR);
  };

  const handleEditorChange = (key: keyof PlanEditorValues, value: any) => {
    setEditorValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !current.slug) {
        next.slug = slugify(String(value || ''));
      }
      return next;
    });
  };

  const closeFeatureModal = () => {
    setFeatureModalOpen(false);
    setEditingFeatureIndex(null);
    setFeatureSearch('');
    setSelectedCatalogFeatureId(null);
    setCreatingCustomFeature(false);
    setFeatureDraft(EMPTY_FEATURE_DRAFT);
  };

  const openFeatureModalForNew = () => {
    setEditingFeatureIndex(null);
    setFeatureSearch('');
    setSelectedCatalogFeatureId(null);
    setCreatingCustomFeature(false);
    setFeatureDraft(EMPTY_FEATURE_DRAFT);
    setFeatureModalOpen(true);
  };

  const openFeatureModalForEdit = (feature: PlanEditorFeatureValue, index: number) => {
    const catalogFeature = feature.feature_id
      ? featureCatalog.find((item) => item.id === feature.feature_id)
      : catalogByCode[feature.code];

    setEditingFeatureIndex(index);
    setFeatureSearch(feature.name || feature.code);
    setSelectedCatalogFeatureId(catalogFeature?.id || null);
    setCreatingCustomFeature(!catalogFeature);
    setFeatureDraft({
      ...feature,
      value: normalizeFeatureValue(feature.value, feature.value_type),
      default_value: normalizeFeatureValue(feature.default_value, feature.value_type),
      unit: feature.unit || '',
    });
    setFeatureModalOpen(true);
  };

  const handleCatalogFeatureSelect = (feature: ApplicationBillingFeatureCatalogItem) => {
    setSelectedCatalogFeatureId(feature.id);
    setCreatingCustomFeature(false);
    setFeatureDraft(buildFeatureDraftFromCatalog(feature));
  };

  const handleFeatureDraftChange = (key: keyof PlanEditorFeatureValue, value: string) => {
    setFeatureDraft((current) => {
      const next: PlanEditorFeatureValue = { ...current, [key]: value };

      if (key === 'value_type') {
        const nextType = value as BillingFeatureValueType;
        next.value_type = nextType;
        next.default_value = normalizeFeatureValue(current.default_value, nextType);
        next.value = normalizeFeatureValue(current.value, nextType);
      }

      if (key === 'name' && !current.code && creatingCustomFeature) {
        next.code = slugify(value).replace(/-/g, '_');
      }

      if (key === 'code') {
        next.code = value.trim();
      }

      return next;
    });
  };

  const handleAddCustomFeature = () => {
    setSelectedCatalogFeatureId(null);
    setCreatingCustomFeature(true);
    setFeatureDraft({
      ...EMPTY_FEATURE_DRAFT,
      code: featureSearch ? featureSearch.trim().replace(/\s+/g, '_') : '',
      name: featureSearch || '',
    });
  };

  const handleConfirmFeatureAssignment = () => {
    const normalizedCode = featureDraft.code.trim();
    const normalizedName = featureDraft.name.trim();

    if (!normalizedCode) {
      onError('Codigo requerido', 'La funcionalidad necesita un codigo unico.');
      return;
    }

    if (!normalizedName) {
      onError('Nombre requerido', 'La funcionalidad necesita un nombre visible.');
      return;
    }

    if (featureDraft.value_type === 'number' && featureDraft.value.trim() !== '' && Number.isNaN(Number(featureDraft.value))) {
      onError('Valor invalido', 'Ingresa un numero valido para esta funcionalidad.');
      return;
    }

    if (assignedFeatureCodes.has(normalizedCode)) {
      onError('Funcionalidad duplicada', 'Ese code ya fue agregado en este plan.');
      return;
    }

    const normalizedFeature: PlanEditorFeatureValue = {
      ...featureDraft,
      code: normalizedCode,
      name: normalizedName,
      description: featureDraft.description.trim(),
      category: featureDraft.category.trim() || 'features',
      default_value: normalizeFeatureValue(featureDraft.default_value, featureDraft.value_type),
      value: normalizeFeatureValue(featureDraft.value, featureDraft.value_type),
      unit: featureDraft.unit ? featureDraft.unit.trim() : '',
    };

    setEditorValues((current) => {
      const nextFeatures = [...current.plan_features];
      if (editingFeatureIndex !== null) {
        nextFeatures[editingFeatureIndex] = normalizedFeature;
      } else {
        nextFeatures.push(normalizedFeature);
      }

      return {
        ...current,
        plan_features: nextFeatures,
      };
    });

    closeFeatureModal();
  };

  const handleRemoveAssignedFeature = (index: number) => {
    setEditorValues((current) => ({
      ...current,
      plan_features: current.plan_features.filter((_, featureIndex) => featureIndex !== index),
    }));
  };

  const handleSavePlan = async () => {
    if (!editorValues.name.trim()) {
      onError('Nombre requerido', 'Ingresa un nombre para el plan.');
      return;
    }

    if (!editorValues.slug.trim()) {
      onError('Slug requerido', 'Ingresa un slug para el plan.');
      return;
    }

    try {
      setSavingPlan(true);

      const hydratedPlanFeatures = editorValues.plan_features.map((feature) => {
        const catalogFeature = feature.feature_id
          ? featureCatalog.find((item) => item.id === feature.feature_id)
          : catalogByCode[feature.code];

        return catalogFeature
          ? {
              ...buildFeatureDraftFromCatalog(catalogFeature, feature.value),
              value: normalizeFeatureValue(feature.value, catalogFeature.value_type),
            }
          : feature;
      });

      const savedPlan = await applicationBillingService.savePlan(
        {
          ...(selectedPlan || {}),
          application_id: applicationId,
        },
        {
          ...editorValues,
          features: featureInput.split('\n').map((item) => item.trim()).filter(Boolean),
          plan_features: hydratedPlanFeatures,
        },
      );

      await loadData(savedPlan.id);

      onSuccess(
        'Plan guardado',
        'El plan comercial quedo guardado con sus funcionalidades, limites y compatibilidad legacy.',
      );
    } catch (error: any) {
      onError('No se pudo guardar el plan', error?.message || 'Ocurrio un error inesperado');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan?.id) return;

    try {
      await applicationBillingService.deletePlan(selectedPlan.id);
      await loadData();
      onSuccess('Plan eliminado', 'El plan fue eliminado de esta aplicacion.');
    } catch (error: any) {
      onError('No se pudo eliminar el plan', error?.message || 'Ocurrio un error inesperado');
    }
  };

  const handleSyncPlan = async (planId: string) => {
    try {
      setSyncingPlanId(planId);
      await applicationBillingService.syncPlanWithMercadoPago(planId);
      await loadData(planId);
      onSuccess(
        'Plan sincronizado',
        'El plan ya fue creado o actualizado en Mercado Pago.',
      );
    } catch (error: any) {
      onError('No se pudo sincronizar con Mercado Pago', error?.message || 'Revisa la configuracion del access token.');
    } finally {
      setSyncingPlanId(null);
    }
  };

  const handleSaveCustomCatalogFeature = async () => {
    const input: CreateBillingFeatureInput = {
      code: featureDraft.code.trim(),
      name: featureDraft.name.trim(),
      description: featureDraft.description.trim(),
      value_type: featureDraft.value_type,
      default_value: normalizeFeatureValue(featureDraft.default_value, featureDraft.value_type),
      category: featureDraft.category.trim() || 'features',
      unit: featureDraft.unit ? featureDraft.unit.trim() : null,
      active: featureDraft.active !== false,
    };

    if (!input.code || !input.name) {
      onError('Datos incompletos', 'Para registrar la funcionalidad necesitamos codigo y nombre.');
      return;
    }

    try {
      const createdFeature = await applicationBillingService.createFeatureCatalogItem(input);
      setFeatureCatalog((current) => {
        const next = current.filter((item) => item.code !== createdFeature.code);
        next.push(createdFeature);
        return next.sort((left, right) => `${left.category}-${left.name}`.localeCompare(`${right.category}-${right.name}`, 'es'));
      });
      setSelectedCatalogFeatureId(createdFeature.id);
      setCreatingCustomFeature(false);
      setFeatureDraft(buildFeatureDraftFromCatalog(createdFeature, featureDraft.value));
      onSuccess('Funcionalidad registrada', 'Quedo guardada en el catalogo y ya puedes asignarla al plan.');
    } catch (error: any) {
      onError('No se pudo registrar la funcionalidad', error?.message || 'Revisa el codigo y vuelve a intentarlo.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Cargando configuracion de planes, catalogo y Mercado Pago...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                <CreditCard className="h-3.5 w-3.5" />
                Monetizacion interna
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Planes por aplicacion y sincronizacion con Mercado Pago</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Mantiene la misma forma legacy de <code>available_plans</code>, pero ahora con un catalogo real
                de funcionalidades, limites y valores por plan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingConfig ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Facturacion interna</p>
                  <p className="mt-1 text-xs text-slate-500">Activa la logica propia de planes en login y APIs.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled === true}
                  onChange={(event) => handleConfigChange('enabled', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Sync en login</p>
                  <p className="mt-1 text-xs text-slate-500">Busca suscripciones activas en Mercado Pago por email.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.auto_sync_on_login !== false}
                  onChange={(event) => handleConfigChange('auto_sync_on_login', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Autoasignar plan gratis/trial</p>
                  <p className="mt-1 text-xs text-slate-500">Provisiona planes sin costo o trial al registrar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.auto_assign_default_plan !== false}
                  onChange={(event) => handleConfigChange('auto_assign_default_plan', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Exigir plan activo</p>
                  <p className="mt-1 text-xs text-slate-500">Si no hay suscripcion valida, login devolvera has_access=false.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.require_plan_for_access !== false}
                  onChange={(event) => handleConfigChange('require_plan_for_access', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Access token de Mercado Pago</label>
              <input
                type="password"
                value={config.mercado_pago_access_token || ''}
                onChange={(event) => handleConfigChange('mercado_pago_access_token', event.target.value)}
                placeholder="APP_USR-..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Public key de Mercado Pago</label>
              <input
                type="text"
                value={config.mercado_pago_public_key || ''}
                onChange={(event) => handleConfigChange('mercado_pago_public_key', event.target.value)}
                placeholder="APP_USR-..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">URL final de retorno del frontend</label>
              <input
                type="url"
                value={config.mercado_pago_back_url || ''}
                onChange={(event) => handleConfigChange('mercado_pago_back_url', event.target.value)}
                placeholder="https://tuapp.com/subscription/result"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-xs text-slate-500">
                AuthSystem la usara como retorno final hacia tu app. El back_url real de Mercado Pago se resuelve internamente por la Edge Function.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Webhook secret de Mercado Pago</label>
              <input
                type="password"
                value={config.mercado_pago_webhook_secret || ''}
                onChange={(event) => handleConfigChange('mercado_pago_webhook_secret', event.target.value)}
                placeholder="Pega aqui la firma secreta de Webhooks"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-xs text-slate-500">
                Se usa para validar eventos <code>subscription_preapproval</code> y reforzar la seguridad del webhook.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Planes de esta app</h4>
                <p className="mt-1 text-sm text-slate-500">Cada plan conserva catalogo, valores y sync propio.</p>
              </div>
              <button
                type="button"
                onClick={handleNewPlan}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Nuevo
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {plans.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Todavia no hay planes creados para esta aplicacion.
                </div>
              )}

              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                const entitlementsCount = Array.isArray(plan.entitlements?.features) ? plan.entitlements!.features!.length : 0;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                          {plan.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              <Star className="h-3 w-3" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{plan.slug}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          {plan.currency} {Number(plan.price || 0).toFixed(2)} / {plan.interval_count} {plan.interval}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">{entitlementsCount} funcionalidades tecnicas</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          plan.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {plan.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        <p className="mt-2 text-[11px] text-slate-500">{plan.provider_status || 'No sincronizado'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">
                  {selectedPlan?.id ? 'Editar plan' : 'Crear plan'}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Define precio, trial, beneficios visibles y funcionalidades tipadas por plan.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPlan?.id && (
                  <button
                    type="button"
                    onClick={() => handleSyncPlan(selectedPlan.id!)}
                    disabled={!hasMercadoPagoConfig || syncingPlanId === selectedPlan.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingPlanId === selectedPlan.id ? 'animate-spin' : ''}`} />
                    {syncingPlanId === selectedPlan.id ? 'Sincronizando...' : 'Sync Mercado Pago'}
                  </button>
                )}
                {selectedPlan?.id && (
                  <button
                    type="button"
                    onClick={handleDeletePlan}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSavePlan}
                  disabled={savingPlan}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingPlan ? 'Guardando...' : 'Guardar plan'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Nombre del plan</label>
                <input
                  type="text"
                  value={editorValues.name}
                  onChange={(event) => handleEditorChange('name', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Plan Profesional"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Slug tecnico</label>
                <input
                  type="text"
                  value={editorValues.slug}
                  onChange={(event) => handleEditorChange('slug', slugify(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="plan-profesional"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Descripcion</label>
              <textarea
                rows={3}
                value={editorValues.description}
                onChange={(event) => handleEditorChange('description', event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Ideal para equipos que necesitan MFA, branding y soporte prioritario."
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Precio</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editorValues.price}
                  onChange={(event) => handleEditorChange('price', Number(event.target.value || 0))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Moneda</label>
                <input
                  type="text"
                  value={editorValues.currency}
                  onChange={(event) => handleEditorChange('currency', event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Intervalo</label>
                <select
                  value={editorValues.interval}
                  onChange={(event) => handleEditorChange('interval', event.target.value as PlanEditorValues['interval'])}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="year">Ano</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Cada cuanto</label>
                <input
                  type="number"
                  min="1"
                  value={editorValues.interval_count}
                  onChange={(event) => handleEditorChange('interval_count', Number(event.target.value || 1))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Trial (dias)</label>
                <input
                  type="number"
                  min="0"
                  value={editorValues.trial_days}
                  onChange={(event) => handleEditorChange('trial_days', Number(event.target.value || 0))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={editorValues.sort_order}
                  onChange={(event) => handleEditorChange('sort_order', Number(event.target.value || 0))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Beneficios visibles del plan
                </div>
                <textarea
                  rows={7}
                  value={featureInput}
                  onChange={(event) => setFeatureInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder={'MFA movil\nBranding avanzado\nSoporte prioritario'}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Un beneficio por linea. Esto se mantiene como lista visible del plan.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Funcionalidades y limites
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Cada item sale en <code>entitlements.features</code> con <code>code</code>, <code>name</code>,
                      <code>description</code>, <code>value</code>, <code>value_type</code>, <code>unit</code> y <code>category</code>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openFeatureModalForNew}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar funcionalidad
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {editorValues.plan_features.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      Este plan todavia no tiene funcionalidades tecnicas asignadas.
                    </div>
                  ) : (
                    editorValues.plan_features.map((feature, index) => (
                      <div
                        key={`${feature.code}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{feature.name}</p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {feature.code}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getCategoryTone(feature.category)}`}>
                                {feature.category}
                              </span>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                                {feature.value_type}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {feature.description || 'Sin descripcion'}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                                Valor: {formatFeatureValue(feature)}
                              </span>
                              {feature.unit && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                                  Unidad: {feature.unit}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openFeatureModalForEdit(feature, index)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignedFeature(index)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-900">Plan activo</span>
                <input
                  type="checkbox"
                  checked={editorValues.is_active}
                  onChange={(event) => handleEditorChange('is_active', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-900">Plan default</span>
                <input
                  type="checkbox"
                  checked={editorValues.is_default}
                  onChange={(event) => handleEditorChange('is_default', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {hasMercadoPagoConfig
                  ? 'La app ya tiene access token de Mercado Pago para sincronizar planes.'
                  : 'Falta guardar el access token de Mercado Pago antes de sincronizar.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {featureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
                  <Layers3 className="h-3.5 w-3.5" />
                  Catalogo de funcionalidades
                </div>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">
                  {editingFeatureIndex !== null ? 'Editar funcionalidad del plan' : 'Agregar funcionalidad'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Busca una funcionalidad existente o registra una nueva si todavia no existe en la base.
                </p>
              </div>

              <button
                type="button"
                onClick={closeFeatureModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Buscar funcionalidad</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={featureSearch}
                      onChange={(event) => setFeatureSearch(event.target.value)}
                      placeholder="Ej: max_users, auditoria, soporte..."
                      className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Catalogo disponible</p>
                      <p className="mt-1 text-xs text-slate-500">Selecciona un item existente para heredar su metadata.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomFeature}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Nueva funcionalidad
                    </button>
                  </div>

                  <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {filteredCatalogFeatures.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                        No encontramos coincidencias en el catalogo.
                      </div>
                    ) : (
                      filteredCatalogFeatures.map((feature) => {
                        const isSelected = selectedCatalogFeatureId === feature.id && !creatingCustomFeature;
                        return (
                          <button
                            key={feature.id}
                            type="button"
                            onClick={() => handleCatalogFeatureSelect(feature)}
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{feature.name}</p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {feature.code}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getCategoryTone(feature.category)}`}>
                                {feature.category}
                              </span>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                                {feature.value_type}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{feature.description || 'Sin descripcion'}</p>
                            <p className="mt-3 text-xs text-slate-500">
                              Default: {formatFeatureValue(buildFeatureDraftFromCatalog(feature))}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Configuracion del entitlement
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Esto es exactamente lo que luego devolvemos en <code>available_plans.entitlements.features</code>.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Codigo</label>
                      <input
                        type="text"
                        value={featureDraft.code}
                        onChange={(event) => handleFeatureDraftChange('code', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="max_users"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
                      <input
                        type="text"
                        value={featureDraft.name}
                        onChange={(event) => handleFeatureDraftChange('name', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="Maximo de Usuarios"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Descripcion</label>
                      <textarea
                        rows={3}
                        value={featureDraft.description}
                        onChange={(event) => handleFeatureDraftChange('description', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="Numero maximo de usuarios que pueden registrarse"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Tipo</label>
                      <select
                        value={featureDraft.value_type}
                        onChange={(event) => handleFeatureDraftChange('value_type', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="boolean">boolean</option>
                        <option value="number">number</option>
                        <option value="text">text</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Categoria</label>
                      <input
                        type="text"
                        value={featureDraft.category}
                        onChange={(event) => handleFeatureDraftChange('category', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="limits"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Unidad</label>
                      <input
                        type="text"
                        value={featureDraft.unit || ''}
                        onChange={(event) => handleFeatureDraftChange('unit', event.target.value)}
                        disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder="usuarios, GB, req/min..."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Valor default</label>
                      {featureDraft.value_type === 'boolean' ? (
                        <select
                          value={featureDraft.default_value}
                          onChange={(event) => handleFeatureDraftChange('default_value', event.target.value)}
                          disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          <option value="true">Habilitado</option>
                          <option value="false">Deshabilitado</option>
                        </select>
                      ) : (
                        <input
                          type={featureDraft.value_type === 'number' ? 'number' : 'text'}
                          value={featureDraft.default_value}
                          onChange={(event) => handleFeatureDraftChange('default_value', event.target.value)}
                          disabled={!creatingCustomFeature && Boolean(selectedCatalogFeature)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="Valor sugerido para nuevos planes"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Valor / limite para este plan</label>
                      {featureDraft.value_type === 'boolean' ? (
                        <select
                          value={featureDraft.value}
                          onChange={(event) => handleFeatureDraftChange('value', event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="true">Habilitado</option>
                          <option value="false">Deshabilitado</option>
                        </select>
                      ) : (
                        <input
                          type={featureDraft.value_type === 'number' ? 'number' : 'text'}
                          value={featureDraft.value}
                          onChange={(event) => handleFeatureDraftChange('value', event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder={featureDraft.value_type === 'number' ? '10' : 'email, chat, phone'}
                        />
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Este valor es el que enviaremos en el login como parte del plan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                    <span className="rounded-full bg-white px-3 py-1 shadow-sm">Code: {featureDraft.code || 'sin definir'}</span>
                    <span className="rounded-full bg-white px-3 py-1 shadow-sm">Tipo: {featureDraft.value_type}</span>
                    <span className="rounded-full bg-white px-3 py-1 shadow-sm">Valor: {formatFeatureValue(featureDraft)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  {creatingCustomFeature && (
                    <button
                      type="button"
                      onClick={handleSaveCustomCatalogFeature}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Sparkles className="h-4 w-4" />
                      Registrar en catalogo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeFeatureModal}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmFeatureAssignment}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    {editingFeatureIndex !== null ? 'Guardar funcionalidad' : 'Agregar al plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
