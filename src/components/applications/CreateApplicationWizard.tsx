import React, { useState } from 'react';
import { Plus, ArrowRight, ArrowLeft, Check, Globe, Settings, Palette, Users, Smartphone } from 'lucide-react';
import type { AuthChannel, EnvironmentUrlsConfig } from '../../types';

interface CreateApplicationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appData: any) => void;
  loading: boolean;
}

const TOTAL_STEPS = 4;
const ENVIRONMENTS = ['development', 'testing', 'production'] as const;

type EnvironmentName = typeof ENVIRONMENTS[number];
type MobileChallengeMethod = 'S256' | 'plain';

interface CreateApplicationWizardFormData {
  name: string;
  description: string;
  domain: string;
  environment: EnvironmentName;
  environment_urls: EnvironmentUrlsConfig;
  supported_auth_channels: AuthChannel[];
  auth_channel_config: {
    web: { enabled: boolean };
    mobile: {
      enabled: boolean;
      pkce_required: boolean;
      code_challenge_methods: MobileChallengeMethod[];
    };
  };
  cors_origins: string;
  webhook_url: string;
  enable_email_verification: boolean;
  allow_public_registration: boolean;
  auth_mode: 'classic' | 'tenant';
}

function createDefaultEnvironmentUrls(): EnvironmentUrlsConfig {
  return {
    development: { base_url: '', callback_url: '', mobile_redirect_uris: [] },
    testing: { base_url: '', callback_url: '', mobile_redirect_uris: [] },
    production: { base_url: '', callback_url: '', mobile_redirect_uris: [] }
  };
}

function createDefaultFormData(): CreateApplicationWizardFormData {
  return {
    name: '',
    description: '',
    domain: '',
    environment: 'development',
    environment_urls: createDefaultEnvironmentUrls(),
    supported_auth_channels: ['web'],
    auth_channel_config: {
      web: { enabled: true },
      mobile: { enabled: false, pkce_required: true, code_challenge_methods: ['S256'] }
    },
    cors_origins: '',
    webhook_url: '',
    enable_email_verification: true,
    allow_public_registration: true,
    auth_mode: 'classic'
  };
}

export default function CreateApplicationWizard({
  isOpen,
  onClose,
  onSubmit,
  loading
}: CreateApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateApplicationWizardFormData>(createDefaultFormData());

  const steps = [
    { id: 1, title: 'Información Básica', icon: Globe },
    { id: 2, title: 'URLs por Ambiente', icon: Settings },
    { id: 3, title: 'Config. Avanzada', icon: Palette },
    { id: 4, title: 'Autenticación', icon: Users }
  ];

  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setCurrentStep(1);
      setFormData(createDefaultFormData());
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnvironmentUrlChange = (env: EnvironmentName, field: 'base_url' | 'callback_url', value: string) => {
    setFormData(prev => ({
      ...prev,
      environment_urls: {
        ...prev.environment_urls,
        [env]: { ...prev.environment_urls[env], [field]: value }
      }
    }));
  };

  const handleMobileRedirectUrisChange = (env: EnvironmentName, value: string) => {
    setFormData(prev => ({
      ...prev,
      environment_urls: {
        ...prev.environment_urls,
        [env]: {
          ...prev.environment_urls[env],
          mobile_redirect_uris: value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)
        }
      }
    }));
  };

  const toggleAuthChannel = (channel: 'web' | 'mobile') => {
    setFormData((prev) => {
      const current = prev.supported_auth_channels;
      const next = current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel];

      const normalized: AuthChannel[] = next.length > 0 ? next : ['web'];

      return {
        ...prev,
        supported_auth_channels: normalized,
        auth_channel_config: {
          ...prev.auth_channel_config,
          mobile: {
            ...prev.auth_channel_config.mobile,
            enabled: normalized.includes('mobile'),
          }
        }
      };
    });
  };

  const generatePlaceholderUrls = (domain: string): EnvironmentUrlsConfig => {
    if (!domain) return createDefaultEnvironmentUrls();
    return {
      development: {
        base_url: `https://auth-dev.${domain}`,
        callback_url: `https://${domain}/callback`,
        mobile_redirect_uris: []
      },
      testing: {
        base_url: `https://auth-test.${domain}`,
        callback_url: `https://${domain}/callback`,
        mobile_redirect_uris: []
      },
      production: {
        base_url: `https://auth.${domain}`,
        callback_url: `https://${domain}/callback`,
        mobile_redirect_uris: []
      }
    };
  };

  const isStepValid = (step: number) => {
    if (step === 1) return !!(formData.name && formData.domain);
    if (step === 4) return formData.supported_auth_channels.length > 0;
    return true;
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && isStepValid(currentStep)) {
      setCurrentStep(s => s + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const handleCreate = () => {
    if (loading) return;
    onSubmit(formData);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de la Aplicación *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mi Aplicación Web"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Descripción de la aplicación..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dominio Principal *
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const ph = generatePlaceholderUrls(val);
                    setFormData(prev => ({
                      ...prev,
                      domain: val,
                      environment_urls: {
                        development: {
                          base_url: prev.environment_urls.development.base_url || ph.development.base_url,
                          callback_url: prev.environment_urls.development.callback_url || ph.development.callback_url,
                          mobile_redirect_uris: prev.environment_urls.development.mobile_redirect_uris || []
                        },
                        testing: {
                          base_url: prev.environment_urls.testing.base_url || ph.testing.base_url,
                          callback_url: prev.environment_urls.testing.callback_url || ph.testing.callback_url,
                          mobile_redirect_uris: prev.environment_urls.testing.mobile_redirect_uris || []
                        },
                        production: {
                          base_url: prev.environment_urls.production.base_url || ph.production.base_url,
                          callback_url: prev.environment_urls.production.callback_url || ph.production.callback_url,
                          mobile_redirect_uris: prev.environment_urls.production.mobile_redirect_uris || []
                        }
                      }
                    }));
                  } else {
                    handleInputChange('domain', val);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="miapp.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se usará para generar automáticamente las URLs de los ambientes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ambiente Inicial
              </label>
              <select
                value={formData.environment}
                onChange={(e) => handleInputChange('environment', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="development">Desarrollo</option>
                <option value="testing">Testing</option>
                <option value="production">Producción</option>
              </select>
            </div>
          </div>
        );

      case 2: {
        const ph = generatePlaceholderUrls(formData.domain);
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h4 className="text-lg font-medium text-gray-900 mb-2">URLs por Ambiente</h4>
              <p className="text-sm text-gray-600">
                Configura las URLs base que se usarán para generar los endpoints de autenticación
              </p>
            </div>

            {ENVIRONMENTS.map((env) => (
              <div key={env} className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-800 mb-3 flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${env === 'development' ? 'bg-blue-500' : env === 'testing' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <span>{env === 'development' ? 'Desarrollo' : env === 'testing' ? 'Testing' : 'Producción'}</span>
                </h5>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL Base</label>
                    <input
                      type="text"
                      value={formData.environment_urls[env].base_url}
                      onChange={(e) => handleEnvironmentUrlChange(env, 'base_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={ph[env]?.base_url || `https://auth-${env}.${formData.domain || 'midominio.com'}`}
                    />
                    <p className="text-xs text-gray-500 mt-1">Se generarán: /login, /register, /reset-password</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Callback URL</label>
                    <input
                      type="text"
                      value={formData.environment_urls[env].callback_url}
                      onChange={(e) => handleEnvironmentUrlChange(env, 'callback_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={ph[env]?.callback_url || `https://${formData.domain || 'midominio.com'}/callback`}
                    />
                  </div>
                  {formData.supported_auth_channels.includes('mobile') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Redirect URIs mobile</label>
                      <textarea
                        value={(formData.environment_urls[env].mobile_redirect_uris || []).join('\n')}
                        onChange={(e) => handleMobileRedirectUrisChange(env, e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder={`sendcraft://${env}/callback\ncom.sendcraft.${env}://auth/callback`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Una URI por línea. Para mobile se validan por coincidencia exacta.</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h4 className="text-lg font-medium text-gray-900 mb-2">Configuración Avanzada</h4>
              <p className="text-sm text-gray-600">Opciones adicionales para personalizar el comportamiento</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orígenes Permitidos (CORS)
              </label>
              <textarea
                value={formData.cors_origins}
                onChange={(e) => handleInputChange('cors_origins', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`https://${formData.domain || 'midominio.com'}\nhttps://www.${formData.domain || 'midominio.com'}`}
              />
              <p className="text-xs text-gray-500 mt-1">Una URL por línea.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
              <input
                type="text"
                value={formData.webhook_url}
                onChange={(e) => handleInputChange('webhook_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`https://${formData.domain || 'midominio.com'}/webhooks/auth`}
              />
              <p className="text-xs text-gray-500 mt-1">URL para recibir notificaciones de eventos de autenticación</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.enable_email_verification}
                  onChange={(e) => handleInputChange('enable_email_verification', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Habilitar verificación de email</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.allow_public_registration}
                  onChange={(e) => handleInputChange('allow_public_registration', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Permitir registro público</span>
              </label>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h4 className="text-lg font-medium text-gray-900 mb-2">Modo de Autenticación</h4>
              <p className="text-sm text-gray-600">
                Elige cómo se registrarán e identificarán los usuarios en esta aplicación
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div>
                <h5 className="text-sm font-semibold text-slate-900">Canales soportados</h5>
                <p className="text-sm text-slate-600 mt-1">
                  Web mantiene los formularios actuales. Mobile agrega `authorization code + PKCE` sobre AuthSystem.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toggleAuthChannel('web')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    formData.supported_auth_channels.includes('web')
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Canal Web</span>
                    {formData.supported_auth_channels.includes('web') && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">Usa `/login`, `/register`, `/reset-password` y `callback_url` web.</p>
                </button>

                <button
                  type="button"
                  onClick={() => toggleAuthChannel('mobile')}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    formData.supported_auth_channels.includes('mobile')
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Canal Mobile
                    </span>
                    {formData.supported_auth_channels.includes('mobile') && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">Habilita `/authorize` y `/oauth/authorize` con `redirect_uri`, `state` y PKCE.</p>
                </button>
              </div>

              {formData.supported_auth_channels.includes('mobile') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center rounded-lg border border-emerald-200 bg-white px-3 py-3">
                    <input
                      type="checkbox"
                      checked={formData.auth_channel_config.mobile.pkce_required}
                      onChange={(e) => handleInputChange('auth_channel_config', {
                        ...formData.auth_channel_config,
                        mobile: {
                          ...formData.auth_channel_config.mobile,
                          pkce_required: e.target.checked,
                        }
                      })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Requerir PKCE en mobile</span>
                  </label>

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Métodos habilitados</p>
                    <p className="text-sm text-slate-700 mt-1">S256</p>
                  </div>
                </div>
              )}
            </div>

            {/* Opción Clásica */}
            <div
              onClick={() => handleInputChange('auth_mode', 'classic')}
              className={`w-full text-left rounded-xl border-2 p-5 cursor-pointer transition-all ${
                formData.auth_mode === 'classic'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  formData.auth_mode === 'classic' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${formData.auth_mode === 'classic' ? 'text-blue-700' : 'text-gray-800'}`}>
                      Autenticación Clásica
                    </p>
                    {formData.auth_mode === 'classic' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Seleccionado</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Cada usuario se registra de forma individual. Comportamiento estándar sin agrupación por empresa.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">POST /auth/register</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">POST /auth/login</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Opción Tenant */}
            <div
              onClick={() => handleInputChange('auth_mode', 'tenant')}
              className={`w-full text-left rounded-xl border-2 p-5 cursor-pointer transition-all ${
                formData.auth_mode === 'tenant'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  formData.auth_mode === 'tenant' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${formData.auth_mode === 'tenant' ? 'text-emerald-700' : 'text-gray-800'}`}>
                      Autenticación por Tenant (Empresa)
                    </p>
                    {formData.auth_mode === 'tenant' && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Seleccionado</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Los usuarios se agrupan bajo una empresa/organización. Primero se registra la empresa y sus usuarios quedan asociados automáticamente.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-medium">POST /register-tenant</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">POST /auth/register</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">POST /auth/login</span>
                  </div>
                </div>
              </div>
            </div>

            {formData.auth_mode === 'tenant' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">Flujo de integración con tenants:</p>
                <ol className="text-sm text-amber-700 space-y-1.5 list-decimal list-inside">
                  <li>Tu cliente llama <code className="bg-amber-100 px-1 rounded text-xs">POST /register-tenant</code> → recibe un <strong>tenant_id</strong></li>
                  <li>Los usuarios se registran con <code className="bg-amber-100 px-1 rounded text-xs">POST /auth/register</code> — se asignan automáticamente al tenant</li>
                  <li>Al hacer login, la respuesta incluye el <strong>tenant_id</strong> en el token</li>
                </ol>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Nueva Aplicación</h3>
              <p className="text-blue-100 mt-1">Paso {currentStep} de {TOTAL_STEPS}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-gray-400'
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <div className="mt-1.5 text-center hidden sm:block">
                      <p className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content — sin form tag, sin riesgo de submit involuntario */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 p-6 overflow-y-auto min-h-0">
            {renderStepContent()}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>

                {currentStep < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isStepValid(currentStep)}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Siguiente</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                    <span>{loading ? 'Creando...' : 'Crear Aplicación'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
