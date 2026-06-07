import React, { useState } from 'react';
import { Plus, ArrowRight, ArrowLeft, Check, Globe, Settings, Palette, Users } from 'lucide-react';
import { subscriptionService } from '../../services/subscriptionService';

interface CreateApplicationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appData: any) => void;
  loading: boolean;
}

const TOTAL_STEPS = 4;

export default function CreateApplicationWizard({
  isOpen,
  onClose,
  onSubmit,
  loading
}: CreateApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [subscriptionLimits, setSubscriptionLimits] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: '',
    environment: 'development' as 'development' | 'testing' | 'production',
    environment_urls: {
      development: { base_url: '', callback_url: '' },
      testing: { base_url: '', callback_url: '' },
      production: { base_url: '', callback_url: '' }
    },
    cors_origins: '',
    webhook_url: '',
    enable_email_verification: true,
    allow_public_registration: true,
    auth_mode: 'classic' as 'classic' | 'tenant'
  });

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
      loadSubscriptionLimits();
      setCurrentStep(1);
      setFormData({
        name: '',
        description: '',
        domain: '',
        environment: 'development',
        environment_urls: {
          development: { base_url: '', callback_url: '' },
          testing: { base_url: '', callback_url: '' },
          production: { base_url: '', callback_url: '' }
        },
        cors_origins: '',
        webhook_url: '',
        enable_email_verification: true,
        allow_public_registration: true,
        auth_mode: 'classic'
      });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadSubscriptionLimits = async () => {
    try {
      const limits = await subscriptionService.canCreateApplication();
      setSubscriptionLimits(limits);
    } catch (error) {
      console.error('Error loading subscription limits:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnvironmentUrlChange = (env: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      environment_urls: {
        ...prev.environment_urls,
        [env]: { ...prev.environment_urls[env], [field]: value }
      }
    }));
  };

  const generatePlaceholderUrls = (domain: string) => {
    if (!domain) return {} as any;
    return {
      development: {
        base_url: `https://auth-dev.${domain}`,
        callback_url: `https://${domain}/callback`
      },
      testing: {
        base_url: `https://auth-test.${domain}`,
        callback_url: `https://${domain}/callback`
      },
      production: {
        base_url: `https://auth.${domain}`,
        callback_url: `https://${domain}/callback`
      }
    };
  };

  const isStepValid = (step: number) => {
    if (step === 1) return !!(formData.name && formData.domain);
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
                          callback_url: prev.environment_urls.development.callback_url || ph.development.callback_url
                        },
                        testing: {
                          base_url: prev.environment_urls.testing.base_url || ph.testing.base_url,
                          callback_url: prev.environment_urls.testing.callback_url || ph.testing.callback_url
                        },
                        production: {
                          base_url: prev.environment_urls.production.base_url || ph.production.base_url,
                          callback_url: prev.environment_urls.production.callback_url || ph.production.callback_url
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

            {(['development', 'testing', 'production'] as const).map((env) => (
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

            {subscriptionLimits && !subscriptionLimits.allowed && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  No puedes crear la aplicación todavía
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  {subscriptionLimits.reason || 'Tu plan actual no permite crear más aplicaciones.'}
                </p>
                <p className="mt-2 text-xs text-amber-700">
                  Uso actual: {subscriptionLimits.current} / {subscriptionLimits.limit === -1 ? 'ilimitado' : subscriptionLimits.limit}
                </p>
              </div>
            )}
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
