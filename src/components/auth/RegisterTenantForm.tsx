import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { BrandingConfig } from '../../types';
import { applicationService } from '../../services/applicationService';
import { supabase } from '../../lib/supabase';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseRuntime';
import { applyFaviconToDocument } from '../../utils/favicon';
import { getTrustedCallbackUrl } from '../../utils/publicCallbackUrl';
import BrandedTenantRegistration from './BrandedTenantRegistration';

type TenantStep = 1 | 2;

interface ApplicationRecord {
  id: string;
  name: string;
  auth_mode?: string;
  metadata?: Record<string, any>;
}

interface TenantData {
  name: string;
  slug: string;
  domain: string;
}

interface PublicApplicationPlan {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle?: string;
  trial_days?: number;
  is_default?: boolean;
  sort_order?: number;
  features?: string[];
  entitlements?: {
    features?: Array<{
      code: string;
      name?: string;
      description?: string;
      value: string | boolean | number;
      value_type?: string;
      unit?: string | null;
      category?: string | null;
    }>;
  };
}

interface AdminData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function buildSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export default function RegisterTenantForm() {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('app_id');
  const apiKey = searchParams.get('api_key');
  const redirectUri = searchParams.get('redirect_uri') || searchParams.get('callback_url');
  const preferredEnvironment = (searchParams.get('env') || 'development').toLowerCase();

  const [appData, setAppData] = useState<ApplicationRecord | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingConfig>>({});
  const [loadingApp, setLoadingApp] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [resolvedApiKey, setResolvedApiKey] = useState<string | null>(apiKey);

  const [currentStep, setCurrentStep] = useState<TenantStep>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [plans, setPlans] = useState<PublicApplicationPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(searchParams.get('plan_id'));

  const [tenantData, setTenantData] = useState<TenantData>({
    name: '',
    slug: '',
    domain: ''
  });

  const [adminData, setAdminData] = useState<AdminData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const apiBaseUrl = `${supabaseUrl}/functions/v1`;

  const trustedRedirectUri = getTrustedCallbackUrl(
    appData?.metadata?.environment_urls || null,
    redirectUri,
    preferredEnvironment,
    appData?.metadata?.cors_origins || null
  );

  const loginHref = useMemo(() => {
    if (!appId) return undefined;
    const params = new URLSearchParams();
    params.set('app_id', appId);
    if (resolvedApiKey) params.set('api_key', resolvedApiKey);
    if (trustedRedirectUri) params.set('redirect_uri', trustedRedirectUri);
    return `/login?${params.toString()}`;
  }, [appId, resolvedApiKey, trustedRedirectUri]);

  useEffect(() => {
    const loadApplication = async () => {
      if (!appId) {
        setAppError('Falta el parametro app_id en la URL.');
        setLoadingApp(false);
        return;
      }

      try {
        const { data: app, error } = await supabase
          .from('applications')
          .select('*')
          .eq('application_id', appId)
          .maybeSingle();

        if (error || !app) {
          setAppError('Aplicacion no encontrada.');
          setLoadingApp(false);
          return;
        }

        if (app.auth_mode !== 'tenant') {
          setAppError('Esta aplicacion no tiene habilitado el registro por tenant.');
          setLoadingApp(false);
          return;
        }

        if (!apiKey) {
          const { data: keys } = await supabase
            .from('api_keys')
            .select('key_hash')
            .eq('application_id', app.id)
            .eq('is_active', true)
            .limit(1);

          if (keys && keys.length > 0) {
            setResolvedApiKey(keys[0].key_hash);
          }
        }

        try {
          const brandingConfig = await applicationService.getPublicBranding(app.id, {
            environmentName: preferredEnvironment,
            host: window.location.hostname
          });
          setBranding(brandingConfig || {});
          if (brandingConfig?.favicon_url) {
            applyFaviconToDocument(brandingConfig.favicon_url);
          }
        } catch {
          // Keep safe defaults if branding fails.
        }

        setAppData({
          id: app.id,
          name: app.name,
          auth_mode: app.auth_mode,
          metadata: app.metadata
        });
      } catch {
        setAppError('No pudimos cargar la aplicacion.');
      } finally {
        setLoadingApp(false);
      }
    };

    applyFaviconToDocument('/images/icon.svg');
    loadApplication();
  }, [appId, apiKey, preferredEnvironment]);

  useEffect(() => {
    const loadPlans = async () => {
      if (!appId || !resolvedApiKey) {
        setPlans([]);
        setPlansLoading(false);
        return;
      }

      try {
        setPlansLoading(true);

        const payload = {
          application_id: appId,
          api_key: resolvedApiKey
        };

        const requestAttempts = [
          {
            url: '/api/application/plans',
            headers: {
              'Content-Type': 'application/json'
            }
          },
          {
            url: `${apiBaseUrl}/application-plans`,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey
            }
          }
        ];

        let result: any = null;
        let lastError: Error | null = null;

        for (const attempt of requestAttempts) {
          try {
            const response = await fetch(attempt.url, {
              method: 'POST',
              headers: attempt.headers,
              body: JSON.stringify(payload)
            });

            const json = await response.json().catch(() => null);
            if (!response.ok || !json?.success) {
              throw new Error(json?.error?.message || 'No pudimos cargar los planes disponibles.');
            }

            result = json;
            lastError = null;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error('No pudimos cargar los planes disponibles.');
          }
        }

        if (!result) {
          throw lastError || new Error('No pudimos cargar los planes disponibles.');
        }

        const list = Array.isArray(result?.data?.available_plans)
          ? result.data.available_plans
              .map((plan: any) => ({
                ...plan,
                price: Number(plan.price || 0),
                trial_days: Number(plan.trial_days || plan.free_trial_days || 0),
                sort_order: Number(plan.sort_order || 0)
              }))
              .filter((plan: PublicApplicationPlan) => plan.active !== false)
              .sort((left: PublicApplicationPlan, right: PublicApplicationPlan) => {
                if ((left.sort_order || 0) !== (right.sort_order || 0)) {
                  return (left.sort_order || 0) - (right.sort_order || 0);
                }
                return Number(left.price || 0) - Number(right.price || 0);
              })
          : [];

        setPlans(list);

        setSelectedPlanId((current) => {
          if (current && list.some((plan: PublicApplicationPlan) => plan.id === current)) {
            return current;
          }

          const preferredPlan =
            list.find((plan: PublicApplicationPlan) => plan.is_default) ||
            list.find((plan: PublicApplicationPlan) => Number(plan.trial_days || 0) > 0) ||
            list.find((plan: PublicApplicationPlan) => Number(plan.price || 0) === 0) ||
            list[0] ||
            null;

          return preferredPlan?.id || null;
        });
      } catch (error) {
        console.error('Error loading application plans:', error);
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };

    void loadPlans();
  }, [appId, resolvedApiKey, apiBaseUrl, supabaseAnonKey]);

  useEffect(() => {
    if (!slugManuallyEdited && tenantData.name) {
      setTenantData((current) => ({
        ...current,
        slug: buildSlug(tenantData.name)
      }));
    }
  }, [tenantData.name, slugManuallyEdited]);

  const validateStepOne = () => {
    if (!tenantData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la empresa es obligatorio.' });
      return false;
    }

    if (!tenantData.slug.trim()) {
      setMessage({ type: 'error', text: 'El identificador es obligatorio.' });
      return false;
    }

    if (!/^[a-z0-9-]+$/.test(tenantData.slug)) {
      setMessage({ type: 'error', text: 'El identificador solo admite letras minusculas, numeros y guiones.' });
      return false;
    }

    return true;
  };

  const validateStepTwo = () => {
    if (!adminData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del administrador es obligatorio.' });
      return false;
    }

    if (!adminData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
      setMessage({ type: 'error', text: 'Ingresa un correo valido.' });
      return false;
    }

    if (adminData.password.length < 8) {
      setMessage({ type: 'error', text: 'La contrasena debe tener al menos 8 caracteres.' });
      return false;
    }

    if (adminData.password !== adminData.confirmPassword) {
      setMessage({ type: 'error', text: 'Las contrasenas no coinciden.' });
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    setMessage(null);
    if (validateStepOne()) {
      setCurrentStep(2);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!validateStepTwo()) return;

    if (!resolvedApiKey) {
      setMessage({ type: 'error', text: 'No encontramos una API key activa para esta aplicacion.' });
      return;
    }

    setLoading(true);
    try {
      const tenantResponse = await fetch(`${apiBaseUrl}/register-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey
        },
        body: JSON.stringify({
          application_id: appId,
          api_key: resolvedApiKey,
          name: tenantData.name,
          slug: tenantData.slug,
          domain: tenantData.domain || undefined,
          plan_id: selectedPlanId || undefined
        })
      });

      const tenantResult = await tenantResponse.json();
      if (!tenantResponse.ok || !tenantResult.success) {
        throw new Error(tenantResult?.error?.message || 'No pudimos registrar la empresa.');
      }

      const tenantId = tenantResult.data.tenant_id;

      const registerResponse = await fetch(`${apiBaseUrl}/auth-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey
        },
        body: JSON.stringify({
          application_id: appId,
          api_key: resolvedApiKey,
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
          tenant_id: tenantId,
          redirect_uri: trustedRedirectUri || undefined
        })
      });

      const registerResult = await registerResponse.json();
      if (!registerResponse.ok || !registerResult.success) {
        throw new Error(registerResult?.error?.message || 'No pudimos crear la cuenta administradora.');
      }

      setSuccess(true);
      setMessage({ type: 'success', text: 'Empresa registrada correctamente. Redirigiendo al login...' });

      if (loginHref) {
        window.setTimeout(() => {
          window.location.href = loginHref;
        }, 1800);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Ocurrio un error inesperado.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTenantFieldChange = (field: keyof TenantData, value: string) => {
    setMessage(null);
    if (field === 'slug') {
      setSlugManuallyEdited(true);
      setTenantData((current) => ({
        ...current,
        slug: value.toLowerCase().replace(/[^a-z0-9-]/g, '')
      }));
      return;
    }

    setTenantData((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleAdminFieldChange = (field: keyof AdminData, value: string) => {
    setMessage(null);
    setAdminData((current) => ({
      ...current,
      [field]: value
    }));
  };

  if (loadingApp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Cargando configuracion del tenant...
        </div>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)]">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
          <h2 className="text-2xl font-semibold text-slate-900">No pudimos abrir este formulario</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{appError}</p>
        </div>
      </div>
    );
  }

  return (
    <BrandedTenantRegistration
      applicationName={appData?.name || 'Aplicacion'}
      branding={branding}
      currentStep={currentStep}
      tenantData={tenantData}
      plans={plans}
      plansLoading={plansLoading}
      selectedPlanId={selectedPlanId}
      adminData={adminData}
      showPassword={showPassword}
      message={message}
      loading={loading}
      success={success}
      loginHref={loginHref}
      onTenantFieldChange={handleTenantFieldChange}
      onPlanChange={setSelectedPlanId}
      onAdminFieldChange={handleAdminFieldChange}
      onTogglePassword={() => setShowPassword((current) => !current)}
      onNextStep={handleNextStep}
      onPreviousStep={() => {
        setCurrentStep(1);
        setMessage(null);
      }}
      onSubmit={handleSubmit}
    />
  );
}
