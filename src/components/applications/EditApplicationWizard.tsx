import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Save, Globe, Settings, Palette } from 'lucide-react';
import { Application } from '../../types';

interface EditApplicationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appData: any) => void;
  loading: boolean;
  application: Application | null;
}

export default function EditApplicationWizard({ 
  isOpen, 
  onClose, 
  onSubmit, 
  loading,
  application 
}: EditApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Paso 1: Información básica
    name: '',
    description: '',
    domain: '',
    
    // Paso 2: URLs por ambiente
    environment_urls: {
      development: {
        base_url: '',
        callback_url: ''
      },
      testing: {
        base_url: '',
        callback_url: ''
      },
      production: {
        base_url: '',
        callback_url: ''
      }
    },
    
    // Paso 3: Configuración adicional
    cors_origins: '',
    webhook_url: '',
    enable_email_verification: true,
    allow_public_registration: true
  });

  const steps = [
    {
      id: 1,
      title: 'Información Básica',
      description: 'Datos principales de la aplicación',
      icon: Globe
    },
    {
      id: 2,
      title: 'URLs por Ambiente',
      description: 'Configuración de endpoints',
      icon: Settings
    },
    {
      id: 3,
      title: 'Configuración Avanzada',
      description: 'Opciones adicionales',
      icon: Palette
    }
  ];

  // Cargar datos de la aplicación cuando se abre el modal
  useEffect(() => {
    if (isOpen && application) {
      console.log('Loading application data:', application);
      
      const envUrls = application.metadata?.environment_urls || application.environment_urls || {
        development: { base_url: '', callback_url: '' },
        testing: { base_url: '', callback_url: '' },
        production: { base_url: '', callback_url: '' }
      };

      setFormData({
        name: application.name,
        description: application.description || '',
        domain: application.domain,
        environment_urls: envUrls,
        cors_origins: application.metadata?.cors_origins || '',
        webhook_url: application.metadata?.webhook_url || '',
        enable_email_verification: application.metadata?.enable_email_verification ?? true,
        allow_public_registration: application.metadata?.allow_public_registration ?? true
      });
      setCurrentStep(1);
      
      console.log('Form data loaded:', {
        name: application.name,
        description: application.description || '',
        domain: application.domain,
        environment_urls: envUrls,
        cors_origins: application.metadata?.cors_origins || '',
        webhook_url: application.metadata?.webhook_url || '',
        enable_email_verification: application.metadata?.enable_email_verification ?? true,
        allow_public_registration: application.metadata?.allow_public_registration ?? true
      });
    }
  }, [isOpen, application]);

  if (!isOpen || !application) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnvironmentUrlChange = (env: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      environment_urls: {
        ...prev.environment_urls,
        [env]: {
          ...(prev.environment_urls?.[env] || {}),
          [field]: value
        }
      }
    }));
  };

  const generatePlaceholderUrls = (domain: string) => {
    if (!domain) return {};
    return {
      development: {
        base_url: `https://auth-dev.${domain}`,
        callback_url: `https://${domain}/auth/callback`
      },
      testing: {
        base_url: `https://auth-test.${domain}`,
        callback_url: `https://${domain}/auth/callback`
      },
      production: {
        base_url: `https://auth.${domain}`,
        callback_url: `https://${domain}/auth/callback`
      }
    };
  };

  const handleNext = () => {
    console.log('🔄 handleNext called, currentStep:', currentStep);
    console.log('📋 isStepValid:', isStepValid(currentStep));
    console.log('📝 formData:', formData);

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      console.log('✅ Moving to step:', currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('💾 handleSubmit called');
    console.log('📋 currentStep:', currentStep);
    console.log('📝 formData:', formData);

    // Solo enviar si estamos en el paso 3
    if (currentStep === 3) {
      console.log('✅ Submitting form data');
      onSubmit(formData);
    } else {
      console.warn('⚠️ Submit called but not on step 3');
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.name && formData.domain;
      case 2:
        return formData.environment_urls?.development?.base_url &&
               formData.environment_urls?.development?.callback_url;
      case 3:
        return true; // Paso opcional
      default:
        return false;
    }
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
                required
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
                  handleInputChange('domain', e.target.value);
                  // Auto-generar URLs cuando se cambia el dominio
                  if (e.target.value) {
                    const placeholders = generatePlaceholderUrls(e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      environment_urls: {
                        development: {
                          base_url: prev.environment_urls?.development?.base_url || placeholders.development.base_url,
                          callback_url: prev.environment_urls?.development?.callback_url || placeholders.development.callback_url
                        },
                        testing: {
                          base_url: prev.environment_urls?.testing?.base_url || placeholders.testing.base_url,
                          callback_url: prev.environment_urls?.testing?.callback_url || placeholders.testing.callback_url
                        },
                        production: {
                          base_url: prev.environment_urls?.production?.base_url || placeholders.production.base_url,
                          callback_url: prev.environment_urls?.production?.callback_url || placeholders.production.callback_url
                        }
                      }
                    }));
                  }
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="miapp.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se usará para actualizar automáticamente las URLs de los ambientes
              </p>
            </div>
          </div>
        );

      case 2:
        const placeholders = generatePlaceholderUrls(formData.domain);
        return (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h4 className="text-lg font-medium text-gray-900 mb-2">URLs por Ambiente</h4>
              <p className="text-sm text-gray-600">
                Actualiza las URLs base que se usan para generar los endpoints de autenticación
              </p>
            </div>

            {(['development', 'testing', 'production'] as const).map((env) => (
              <div key={env} className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-800 mb-3 capitalize flex items-center space-x-2">
                  <span>{env === 'development' ? '⚡' : env === 'testing' ? '🧪' : '🚀'}</span>
                  <span>{env === 'development' ? 'Desarrollo' : env === 'testing' ? 'Testing' : 'Producción'}</span>
                  {env === 'development' && <span className="text-red-500">*</span>}
                </h5>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      URL Base {env === 'development' && '*'}
                    </label>
                    <input
                      type="url"
                      value={formData.environment_urls[env].base_url}
                      onChange={(e) => handleEnvironmentUrlChange(env, 'base_url', e.target.value)}
                      required={env === 'development'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={placeholders[env]?.base_url || `https://auth-${env}.${formData.domain || 'midominio.com'}`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se generarán: /login, /register, /reset-password
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Callback URL {env === 'development' && '*'}
                    </label>
                    <input
                      type="url"
                      value={formData.environment_urls[env].callback_url}
                      onChange={(e) => handleEnvironmentUrlChange(env, 'callback_url', e.target.value)}
                      required={env === 'development'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={placeholders[env]?.callback_url || `https://${formData.domain || 'midominio.com'}/auth/callback`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h4 className="text-lg font-medium text-gray-900 mb-2">Configuración de Seguridad y Webhooks</h4>
              <p className="text-sm text-gray-600">
                Configura CORS, webhooks y políticas de autenticación
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orígenes Permitidos para CORS
              </label>
              <textarea
                value={formData.cors_origins}
                onChange={(e) => handleInputChange('cors_origins', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`https://${formData.domain || 'midominio.com'}\nhttps://www.${formData.domain || 'midominio.com'}`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Una URL por línea. Dominios permitidos para hacer requests CORS.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL de Webhooks (Opcional)
              </label>
              <input
                type="url"
                value={formData.webhook_url}
                onChange={(e) => handleInputChange('webhook_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`https://${formData.domain || 'midominio.com'}/webhooks/auth`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Recibe notificaciones de login, registro, logout, etc.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-gray-800 mb-3">Políticas de Autenticación</h5>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.enable_email_verification}
                    onChange={(e) => handleInputChange('enable_email_verification', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Requerir verificación de email</span>
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-800 mb-2">💡 Información</h5>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Las URLs de callback ya están configuradas en el paso anterior</li>
                <li>• Los webhooks son opcionales pero recomendados para auditoría</li>
                <li>• La verificación de email mejora la seguridad</li>
                <li>• Puedes cambiar estas configuraciones después</li>
              </ul>
            </div>
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
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Editar Aplicación</h3>
              <p className="text-blue-100 mt-1">Paso {currentStep} de {steps.length}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl"
            >
              ✕
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
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : isActive 
                          ? 'bg-blue-500 border-blue-500 text-white' 
                          : 'border-gray-300 text-gray-400'
                    }`}>
                      {isCompleted ? '✓' : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
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
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isStepValid(currentStep)}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <span>Siguiente</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    <span>{loading ? 'Actualizando...' : 'Actualizar Aplicación'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}