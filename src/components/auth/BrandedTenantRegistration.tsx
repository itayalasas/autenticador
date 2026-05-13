import React from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle, CreditCard, Lock, Mail, User } from 'lucide-react';
import { BrandingConfig } from '../../types';
import { getDefaultBrandingConfig } from '../../utils/themePresets';
import {
  BrandedButton,
  BrandedCard,
  BrandedContainer,
  BrandedHeader,
  BrandedInput,
  BrandedMessage
} from '../ui/BrandedComponents';

type TenantStep = 1 | 2;

interface TenantData {
  name: string;
  slug: string;
  domain: string;
}

interface TenantPlanFeature {
  code: string;
  name?: string;
  value: string | boolean | number;
  value_type?: string;
}

interface TenantPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle?: string;
  trial_days?: number;
  is_default?: boolean;
  features?: string[];
  entitlements?: {
    features?: TenantPlanFeature[];
  };
}

interface AdminData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface TenantMessage {
  type: 'success' | 'error';
  text: string;
}

interface BrandedTenantRegistrationProps {
  applicationName: string;
  branding?: Partial<BrandingConfig>;
  currentStep: TenantStep;
  tenantData: TenantData;
  plans?: TenantPlan[];
  plansLoading?: boolean;
  selectedPlanId?: string | null;
  adminData: AdminData;
  showPassword: boolean;
  message?: TenantMessage | null;
  loading?: boolean;
  success?: boolean;
  mode?: 'live' | 'preview';
  loginHref?: string;
  onTenantFieldChange?: (field: keyof TenantData, value: string) => void;
  onPlanChange?: (planId: string) => void;
  onAdminFieldChange?: (field: keyof AdminData, value: string) => void;
  onTogglePassword?: () => void;
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onSubmit?: (event: React.FormEvent) => void;
}

function withAlpha(color: string | undefined, alpha: number) {
  if (!color) return `rgba(15, 23, 42, ${alpha})`;

  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((char) => `${char}${char}`).join('');
    }
    if (hex.length === 6) {
      const value = Number.parseInt(hex, 16);
      if (!Number.isNaN(value)) {
        const r = (value >> 16) & 255;
        const g = (value >> 8) & 255;
        const b = value & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
  }

  return color;
}

function getText(branding: BrandingConfig, key: string, fallback: string) {
  return branding.custom_texts?.[key] || fallback;
}

export default function BrandedTenantRegistration({
  applicationName,
  branding: partialBranding,
  currentStep,
  tenantData,
  plans = [],
  plansLoading = false,
  selectedPlanId = null,
  adminData,
  showPassword,
  message,
  loading = false,
  success = false,
  mode = 'live',
  loginHref,
  onTenantFieldChange,
  onPlanChange,
  onAdminFieldChange,
  onTogglePassword,
  onNextStep,
  onPreviousStep,
  onSubmit
}: BrandedTenantRegistrationProps) {
  const branding: BrandingConfig = {
    ...getDefaultBrandingConfig(),
    ...partialBranding
  };

  const steps = [
    {
      id: 1 as const,
      title: getText(branding, 'register_tenant_step1_title', 'Datos de la empresa'),
      subtitle: getText(branding, 'register_tenant_step1_subtitle', 'Cuentanos como se llama tu organizacion')
    },
    {
      id: 2 as const,
      title: getText(branding, 'register_tenant_step2_title', 'Cuenta administradora'),
      subtitle: getText(branding, 'register_tenant_step2_subtitle', 'Crea el acceso principal para gestionar la empresa')
    }
  ];

  const step = steps[currentStep - 1];
  const progressWidth = currentStep === 1 ? '50%' : '100%';
  const hintColor = withAlpha(branding.text_color || '#0F172A', 0.66);
  const panelStyle: React.CSSProperties = {
    borderRadius: `${branding.border_radius || 18}px`,
    border: `1px solid ${withAlpha(branding.primary_color, 0.14)}`,
    background: withAlpha(branding.card_background || '#FFFFFF', 0.42)
  };

  const messageStatus = message
    ? message.type === 'success' ? 'success' : 'error'
    : 'idle';

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;

  const handleTenantChange = (field: keyof TenantData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onTenantFieldChange?.(field, event.target.value);
  };

  const handleAdminChange = (field: keyof AdminData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onAdminFieldChange?.(field, event.target.value);
  };

  const formatPriceLabel = (plan: TenantPlan) => {
    const price = Number(plan.price || 0);
    const cycle = String(plan.billing_cycle || 'monthly').toLowerCase();
    const cycleLabel = cycle === 'yearly'
      ? 'año'
      : cycle === 'weekly'
        ? 'semana'
        : cycle === 'daily'
          ? 'día'
          : 'mes';

    if (price === 0) {
      if (Number(plan.trial_days || 0) > 0) {
        return `Gratis ${plan.trial_days} días`;
      }
      return 'Gratis';
    }

    return `${plan.currency} ${price.toLocaleString('es-UY')} / ${cycleLabel}`;
  };

  const summarizePlanHighlights = (plan: TenantPlan) => {
    const namedFeatures = Array.isArray(plan.entitlements?.features)
      ? plan.entitlements!.features!
          .slice(0, 4)
          .map((feature) => {
            const label = feature.name || feature.code;
            if (feature.value_type === 'boolean') {
              return `${label}: ${String(feature.value).toLowerCase() === 'true' ? 'Sí' : 'No'}`;
            }
            return `${label}: ${feature.value}`;
          })
      : [];

    if (namedFeatures.length > 0) {
      return namedFeatures;
    }

    return (plan.features || []).slice(0, 4);
  };

  return (
    <BrandedContainer branding={branding} viewport={mode === 'preview' ? 'full' : 'screen'}>
      <BrandedHeader
        branding={branding}
        logoUrl={branding.logo_url}
        title={applicationName}
        subtitle={getText(
          branding,
          'register_tenant_header_subtitle',
          'Registra una nueva empresa y crea el acceso administrador.'
        )}
      />

      <div className="space-y-5">
        <div className="overflow-hidden p-5" style={panelStyle}>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((item) => {
              const isActive = currentStep === item.id;
              const isCompleted = currentStep > item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-[20px] border px-4 py-4"
                  style={{
                    borderColor: isActive || isCompleted
                      ? withAlpha(branding.primary_color, 0.18)
                      : withAlpha(branding.text_color || '#0F172A', 0.08),
                    background: isActive
                      ? withAlpha(branding.primary_color, 0.08)
                      : isCompleted
                        ? withAlpha(branding.success_color || '#10B981', 0.08)
                        : 'rgba(255,255,255,0.36)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
                      style={{
                        background: isCompleted
                          ? branding.success_color || '#10B981'
                          : isActive
                            ? branding.primary_color || '#2563EB'
                            : withAlpha(branding.text_color || '#0F172A', 0.08),
                        color: isActive || isCompleted ? '#FFFFFF' : branding.text_color || '#0F172A'
                      }}
                    >
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : item.id}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: branding.text_color || '#0F172A' }}>
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs leading-5" style={{ color: hintColor }}>
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 h-1.5 rounded-full bg-white/60">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: progressWidth,
                background: `linear-gradient(135deg, ${branding.primary_color || '#2563EB'}, ${branding.secondary_color || '#1D4ED8'})`
              }}
            />
          </div>
        </div>

        <BrandedCard branding={branding}>
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: hintColor }}>
              Paso {currentStep}
            </div>
            <h2
              className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
              style={{
                color: branding.text_color || '#0F172A',
                fontFamily: branding.heading_font_family || branding.font_family
              }}
            >
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: hintColor }}>
              {step.subtitle}
            </p>
          </div>

          <BrandedMessage
            status={messageStatus}
            branding={branding}
            successText={message?.type === 'success' ? message.text : undefined}
            errorText={message?.type === 'error' ? message.text : undefined}
          />

          {currentStep === 1 ? (
            <div className="space-y-5">
              <BrandedInput
                type="text"
                id="tenant-name"
                label="Nombre de la empresa"
                placeholder="Acme Corp"
                value={tenantData.name}
                onChange={handleTenantChange('name')}
                branding={branding}
                icon={<Building2 className="h-5 w-5" />}
              />

              <div>
                <BrandedInput
                  type="text"
                  id="tenant-slug"
                  label="Identificador"
                  placeholder="acme-corp"
                  value={tenantData.slug}
                  onChange={handleTenantChange('slug')}
                  branding={branding}
                  icon={<ArrowRight className="h-5 w-5" />}
                />
                <p className="mt-2 text-xs" style={{ color: hintColor }}>
                  Solo usa letras minusculas, numeros y guiones.
                </p>
              </div>

              <BrandedInput
                type="text"
                id="tenant-domain"
                label="Dominio opcional"
                placeholder="empresa.com"
                value={tenantData.domain}
                onChange={handleTenantChange('domain')}
                branding={branding}
                icon={<Mail className="h-5 w-5" />}
              />

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium" style={{ color: branding.text_color || '#0F172A' }}>
                    Plan de suscripción
                  </label>
                  <p className="mt-1 text-xs leading-5" style={{ color: hintColor }}>
                    Selecciona el plan que quieres activar para esta empresa.
                  </p>
                </div>

                {plansLoading ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm"
                    style={{
                      borderColor: withAlpha(branding.primary_color, 0.12),
                      background: withAlpha(branding.card_background || '#FFFFFF', 0.56),
                      color: hintColor
                    }}
                  >
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                      style={{ borderColor: branding.primary_color || '#2563EB' }}
                    />
                    Cargando planes disponibles...
                  </div>
                ) : plans.length === 0 ? (
                  <div
                    className="rounded-2xl border px-4 py-4 text-sm italic"
                    style={{
                      borderColor: withAlpha(branding.primary_color, 0.12),
                      background: withAlpha(branding.card_background || '#FFFFFF', 0.56),
                      color: hintColor
                    }}
                  >
                    No hay planes disponibles. Se usará el plan por defecto.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      const highlights = summarizePlanHighlights(plan);

                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => onPlanChange?.(plan.id)}
                          className="w-full rounded-[22px] border p-4 text-left transition"
                          style={{
                            borderColor: isSelected
                              ? withAlpha(branding.primary_color, 0.5)
                              : withAlpha(branding.primary_color, 0.14),
                            background: isSelected
                              ? withAlpha(branding.primary_color, 0.08)
                              : withAlpha(branding.card_background || '#FFFFFF', 0.42),
                            boxShadow: isSelected
                              ? `0 18px 34px -28px ${withAlpha(branding.primary_color, 0.45)}`
                              : 'none'
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-2xl"
                                  style={{
                                    background: isSelected
                                      ? branding.primary_color || '#2563EB'
                                      : withAlpha(branding.primary_color, 0.12),
                                    color: isSelected
                                      ? '#FFFFFF'
                                      : branding.primary_color || '#2563EB'
                                  }}
                                >
                                  <CreditCard className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold" style={{ color: branding.text_color || '#0F172A' }}>
                                      {plan.name}
                                    </p>
                                    {plan.is_default && (
                                      <span
                                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                                        style={{
                                          background: withAlpha(branding.secondary_color || branding.primary_color, 0.14),
                                          color: branding.secondary_color || branding.primary_color || '#2563EB'
                                        }}
                                      >
                                        Recomendado
                                      </span>
                                    )}
                                  </div>
                                  {plan.description && (
                                    <p className="mt-1 text-xs leading-5" style={{ color: hintColor }}>
                                      {plan.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-semibold" style={{ color: branding.primary_color || '#2563EB' }}>
                                {formatPriceLabel(plan)}
                              </p>
                              <div
                                className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full border"
                                style={{
                                  borderColor: isSelected
                                    ? branding.primary_color || '#2563EB'
                                    : withAlpha(branding.text_color || '#0F172A', 0.18),
                                  background: isSelected
                                    ? branding.primary_color || '#2563EB'
                                    : 'transparent',
                                  color: isSelected ? '#FFFFFF' : 'transparent'
                                }}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </div>

                          {highlights.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {highlights.map((highlight, index) => (
                                <span
                                  key={`${plan.id}-highlight-${index}`}
                                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                                  style={{
                                    background: withAlpha(branding.text_color || '#0F172A', 0.06),
                                    color: hintColor
                                  }}
                                >
                                  {highlight}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedPlan && plans.length > 0 && (
                  <p className="text-xs leading-5" style={{ color: hintColor }}>
                    Plan seleccionado: <span style={{ color: branding.text_color || '#0F172A', fontWeight: 600 }}>{selectedPlan.name}</span>
                  </p>
                )}
              </div>

              <BrandedButton
                type="button"
                onClick={() => onNextStep?.()}
                branding={branding}
              >
                <span className="flex items-center justify-center gap-2">
                  {getText(branding, 'register_tenant_continue_button', 'Continuar')}
                  <ArrowRight className="h-5 w-5" />
                </span>
              </BrandedButton>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <BrandedInput
                type="text"
                id="admin-name"
                label="Nombre completo"
                placeholder="Pedro Ayala"
                value={adminData.name}
                onChange={handleAdminChange('name')}
                branding={branding}
                icon={<User className="h-5 w-5" />}
              />

              <BrandedInput
                type="email"
                id="admin-email"
                label="Correo electronico"
                placeholder="admin@empresa.com"
                value={adminData.email}
                onChange={handleAdminChange('email')}
                branding={branding}
                icon={<Mail className="h-5 w-5" />}
              />

              <BrandedInput
                type={showPassword ? 'text' : 'password'}
                id="admin-password"
                label="Contrasena"
                placeholder="Minimo 8 caracteres"
                value={adminData.password}
                onChange={handleAdminChange('password')}
                branding={branding}
                icon={<Lock className="h-5 w-5" />}
                showPasswordToggle
                onPasswordToggle={onTogglePassword}
                showPassword={showPassword}
              />

              <BrandedInput
                type={showPassword ? 'text' : 'password'}
                id="admin-confirm-password"
                label="Confirmar contrasena"
                placeholder="Repite la contrasena"
                value={adminData.confirmPassword}
                onChange={handleAdminChange('confirmPassword')}
                branding={branding}
                icon={<Lock className="h-5 w-5" />}
              />

              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <BrandedButton
                  type="button"
                  onClick={() => onPreviousStep?.()}
                  branding={branding}
                  variant="secondary"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Volver
                  </span>
                </BrandedButton>

                <BrandedButton
                  type="submit"
                  branding={branding}
                  disabled={success}
                  loading={loading}
                  loadingText="Registrando empresa..."
                >
                  {success ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Empresa registrada
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {getText(branding, 'register_tenant_submit_button', 'Registrar empresa')}
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </BrandedButton>
              </div>
            </form>
          )}
        </BrandedCard>

        {!success && loginHref && (
          <div className="text-center text-sm" style={{ color: hintColor }}>
            <a href={loginHref} className="font-medium transition-opacity hover:opacity-80" style={{ color: branding.primary_color || '#2563EB' }}>
              {getText(branding, 'register_tenant_login_link', 'Ya tienes cuenta? Inicia sesion')}
            </a>
          </div>
        )}
      </div>
    </BrandedContainer>
  );
}
