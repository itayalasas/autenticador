import React, { useState, useEffect } from 'react';
import { Crown, CreditCard, Check, X, Star, Zap, Shield, Users, Globe, Sparkles, ArrowRight, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { subscriptionService } from '../../services/subscriptionService';
import { dLocalService } from '../../services/dLocalService';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import ConfirmationModal from '../ui/ConfirmationModal';

export default function SubscriptionManager() {
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const {
    notification,
    confirmation,
    showSuccess,
    showError,
    showConfirmation,
    closeNotification,
    closeConfirmation,
    setConfirmationLoading
  } = useNotification();

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentSubscription(),
        loadPlans(),
        loadUsage(),
        loadPaymentMethods(),
        loadInvoices()
      ]);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const subscription = await subscriptionService.getCurrentSubscription();
      setCurrentSubscription(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadPlans = async () => {
    try {
      const plans = await subscriptionService.getSubscriptionPlans();
      setPlans(plans);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const loadUsage = async () => {
    try {
      const usage = await subscriptionService.getCurrentUsage();
      setUsage(usage);
    } catch (error) {
      console.error('Error loading usage:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const methods = await subscriptionService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      const invoices = await subscriptionService.getInvoices();
      setInvoices(invoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const handleUpgradePlan = (plan: any) => {
    setSelectedPlan(plan);
    if (plan.price === 0) {
      // Free plan, no payment needed
      handleConfirmUpgrade();
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;

    try {
      setUpgradeLoading(true);

      // Si es plan gratuito, upgrade directo sin pago
      if (selectedPlan.price === 0) {
        await subscriptionService.createSubscription(selectedPlan.id);
        await loadSubscriptionData();
        setShowUpgradeModal(false);
        setSelectedPlan(null);
        showSuccess(
          'Suscripción actualizada',
          `Has cambiado exitosamente al plan ${selectedPlan.name}.`
        );
        return;
      }

      // Para planes pagos con dLocal
      const { data: { user } } = await subscriptionService.getCurrentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Crear suscripción en dLocal (abre popup)
      await dLocalService.createSubscription(selectedPlan.plan_token, {
        id: user.id,
        email: user.email
      });

      setShowUpgradeModal(false);

      // Mostrar mensaje de que estamos esperando el pago
      showSuccess(
        'Procesando pago',
        'Por favor completa el pago en la ventana de dLocal. Tu suscripción se activará automáticamente cuando el pago sea confirmado.'
      );

      // Iniciar polling para verificar activación de suscripción
      console.log('🔄 Iniciando polling para activación de suscripción...');

      const activatedSubscription = await subscriptionService.pollForSubscriptionActivation({
        maxAttempts: 24,
        intervalMs: 5000,
        onProgress: (attempt, maxAttempts) => {
          console.log(`⏳ Verificando activación... (${attempt}/${maxAttempts})`);
        }
      });

      if (activatedSubscription) {
        // Recargar datos
        await loadSubscriptionData();
        setSelectedPlan(null);

        showSuccess(
          '¡Suscripción activada!',
          `Tu plan ${selectedPlan.name} ha sido activado exitosamente. Ya puedes disfrutar de todas las funcionalidades.`
        );
      } else {
        // Timeout alcanzado, pero el webhook lo activará eventualmente
        showSuccess(
          'Procesando activación',
          'Tu pago está siendo procesado. La suscripción se activará automáticamente en unos momentos. Puedes refrescar la página para ver el estado actualizado.'
        );
      }

    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      showError(
        'Error al actualizar suscripción',
        error.message || 'Ha ocurrido un error al procesar tu suscripción. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!currentSubscription) return;

    showConfirmation(
      'Cancelar suscripción',
      '¿Estás seguro de que deseas cancelar tu suscripción? Mantendrás acceso hasta el final del período actual.',
      async () => {
        try {
          setConfirmationLoading(true);
          await subscriptionService.cancelSubscription(currentSubscription.id, true);
          await loadCurrentSubscription();
          closeConfirmation();
          showSuccess(
            'Suscripción cancelada',
            'Tu suscripción se cancelará al final del período actual.'
          );
        } catch (error) {
          console.error('Error cancelling subscription:', error);
          closeConfirmation();
          showError(
            'Error al cancelar',
            'Ha ocurrido un error al cancelar tu suscripción.'
          );
        }
      },
      { type: 'warning', confirmText: 'Cancelar Suscripción' }
    );
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'básico': return <Zap className="w-6 h-6" />;
      case 'profesional': return <Crown className="w-6 h-6" />;
      case 'empresarial': return <Sparkles className="w-6 h-6" />;
      default: return <Shield className="w-6 h-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'básico': return 'from-blue-500 to-blue-600';
      case 'profesional': return 'from-purple-500 to-purple-600';
      case 'empresarial': return 'from-yellow-500 to-yellow-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getUsagePercentage = (metric: string, limit: number) => {
    const currentUsage = usage[metric] || 0;
    if (limit === -1) return 0; // Unlimited
    return Math.min((currentUsage / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatNumber = (num: number) => {
    if (num === -1) return 'Ilimitado';
    return num.toLocaleString();
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan_id === planId;
  };

  const canUpgrade = (plan: any) => {
    if (!currentSubscription) return true;
    const currentPlan = currentSubscription.subscription_plans;
    return currentPlan && plan.price > currentPlan.price;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Gestión de Suscripción</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Elige el plan perfecto para tus necesidades. Cambia o cancela en cualquier momento.
        </p>
      </div>

      {/* Current Subscription Status */}
      {currentSubscription && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tu Suscripción Actual</h3>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentSubscription.status === 'active' ? 'bg-green-100 text-green-800' :
                  currentSubscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentSubscription.status === 'active' ? 'Activa' :
                   currentSubscription.status === 'trialing' ? 'Período de prueba' :
                   'Inactiva'}
                </span>
                <span className="text-gray-600">
                  Plan {currentSubscription.subscription_plans?.name}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                ${currentSubscription.subscription_plans?.price || 0}
                <span className="text-sm font-normal text-gray-600">
                  /{currentSubscription.subscription_plans?.interval === 'year' ? 'año' : 'mes'}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Renovación: {new Date(currentSubscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Aplicaciones</span>
                <Globe className="w-4 h-4 text-gray-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {usage.applications || 0}
                  </span>
                  <span className="text-sm text-gray-600">
                    de {formatNumber(currentSubscription.subscription_plans?.limits?.applications || 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${getUsageColor(getUsagePercentage('applications', currentSubscription.subscription_plans?.limits?.applications || 0))}`}
                    style={{ width: `${getUsagePercentage('applications', currentSubscription.subscription_plans?.limits?.applications || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Usuarios</span>
                <Users className="w-4 h-4 text-gray-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {usage.total_users || 0}
                  </span>
                  <span className="text-sm text-gray-600">
                    de {formatNumber(currentSubscription.subscription_plans?.limits?.users_per_app || 0)} por app
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${getUsageColor(getUsagePercentage('total_users', currentSubscription.subscription_plans?.limits?.users_per_app || 0))}`}
                    style={{ width: `${getUsagePercentage('total_users', currentSubscription.subscription_plans?.limits?.users_per_app || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">API Requests</span>
                <Zap className="w-4 h-4 text-gray-500" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {(usage.api_requests || 0).toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-600">
                    de {formatNumber(currentSubscription.subscription_plans?.limits?.api_requests_per_month || 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${getUsageColor(getUsagePercentage('api_requests', currentSubscription.subscription_plans?.limits?.api_requests_per_month || 0))}`}
                    style={{ width: `${getUsagePercentage('api_requests', currentSubscription.subscription_plans?.limits?.api_requests_per_month || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span>Cambiar Plan</span>
              </button>
              
              {currentSubscription.subscription_plans?.price > 0 && (
                <button
                  onClick={handleCancelSubscription}
                  className="text-red-600 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Cancelar Suscripción
                </button>
              )}
            </div>
            
            <div className="text-right">
              {currentSubscription.cancel_at_period_end && (
                <div className="flex items-center space-x-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Se cancelará el {new Date(currentSubscription.current_period_end).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl border-2 p-8 transition-all hover:shadow-lg ${
              plan.is_popular
                ? 'border-purple-500 shadow-xl bg-gradient-to-b from-purple-50 to-white'
                : isCurrentPlan(plan.id)
                  ? 'border-green-500'
                  : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Popular Badge */}
            {plan.is_popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                  <Star className="w-4 h-4" />
                  <span>Más Popular</span>
                </span>
              </div>
            )}

            {/* Current Plan Badge */}
            {isCurrentPlan(plan.id) && (
              <div className="absolute -top-4 right-4">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Plan Actual
                </span>
              </div>
            )}

            {/* Plan Header */}
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${getPlanColor(plan.name)} flex items-center justify-center text-white`}>
                {getPlanIcon(plan.name)}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              <div className="text-center">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-gray-600">/{plan.interval === 'year' ? 'año' : 'mes'}</span>
              </div>
              {plan.trial_days > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  {plan.trial_days} días de prueba gratis
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {plan.features.map((feature: string, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            {/* Limits */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Límites del Plan</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Aplicaciones:</span>
                  <span className="font-medium">{formatNumber(plan.limits.applications)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Usuarios por app:</span>
                  <span className="font-medium">{formatNumber(plan.limits.users_per_app)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">API requests/mes:</span>
                  <span className="font-medium">{formatNumber(plan.limits.api_requests_per_month)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ambientes:</span>
                  <span className="font-medium">{plan.limits.environments.join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Soporte:</span>
                  <span className="font-medium capitalize">{plan.limits.support_level}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleUpgradePlan(plan)}
              disabled={isCurrentPlan(plan.id) || (!canUpgrade(plan) && currentSubscription)}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                isCurrentPlan(plan.id)
                  ? 'bg-green-100 text-green-800 cursor-not-allowed'
                  : plan.is_popular
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg'
                    : plan.price === 0
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isCurrentPlan(plan.id) ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Plan Actual</span>
                </>
              ) : (
                <>
                  <span>{plan.price === 0 ? 'Comenzar Gratis' : 'Actualizar Plan'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      {currentSubscription && currentSubscription.subscription_plans?.price > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Métodos de Pago</h3>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span>Agregar Método</span>
            </button>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No hay métodos de pago</h4>
              <p className="text-gray-600">Agrega un método de pago para continuar con tu suscripción</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {method.brand} •••• {method.last_four}
                      </p>
                      <p className="text-sm text-gray-600">
                        Expira {method.exp_month}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {method.is_default && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        Por defecto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Billing History */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Historial de Facturación</h3>
          <div className="space-y-4">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    invoice.status === 'paid' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {invoice.status === 'paid' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      ${invoice.amount} {invoice.currency}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${getPlanColor(selectedPlan.name)} flex items-center justify-center text-white`}>
                  {getPlanIcon(selectedPlan.name)}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Actualizar a {selectedPlan.name}
                </h3>
                <p className="text-gray-600">{selectedPlan.description}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Plan {selectedPlan.name}</span>
                  <span className="font-bold text-gray-900">
                    ${selectedPlan.price}/{selectedPlan.interval === 'year' ? 'año' : 'mes'}
                  </span>
                </div>
                {selectedPlan.trial_days > 0 && (
                  <p className="text-sm text-green-600">
                    Incluye {selectedPlan.trial_days} días de prueba gratis
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Lo que obtienes:</h4>
                {selectedPlan.features.slice(0, 4).map((feature: string, index: number) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  disabled={upgradeLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {upgradeLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{selectedPlan.price === 0 ? 'Comenzar Gratis' : 'Proceder al Pago'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
                Agregar Método de Pago
              </h3>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900">Pagos Seguros con DLocal</h4>
                      <p className="text-sm text-blue-800">
                        Procesamos pagos de forma segura en toda América Latina
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                    <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Tarjeta</p>
                    <p className="text-xs text-gray-600">Visa, Mastercard</p>
                  </button>
                  
                  <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                    <DollarSign className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Transferencia</p>
                    <p className="text-xs text-gray-600">Bancaria</p>
                  </button>
                </div>

                <div className="text-center text-sm text-gray-600">
                  <p>Serás redirigido a DLocal para completar el pago de forma segura</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 mt-6">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    // Simulate DLocal redirect
                    window.open('https://checkout.dlocal.com/demo', '_blank');
                    setShowPaymentModal(false);
                  }}
                  className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmation.onConfirm || (() => {})}
        title={confirmation.title}
        message={confirmation.message}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
        type={confirmation.type}
        loading={confirmation.loading}
      />
    </div>
  );
}