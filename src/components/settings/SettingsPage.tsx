import React, { useState, useEffect } from 'react';
import { User, Crown, CreditCard, Shield, Bell, Globe, Save, Check, Star, ArrowRight, AlertTriangle } from 'lucide-react';
import { subscriptionService } from '../../services/subscriptionService';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import ConfirmationModal from '../ui/ConfirmationModal';
import { supabase } from '../../lib/supabase';
import { notificationService } from '../../services/notificationService';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [specificPlanLoading, setSpecificPlanLoading] = useState<string | null>(null);

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

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    avatar_url: '',
    notifications: {
      email_updates: true,
      security_alerts: true,
      billing_notifications: true,
      product_updates: false,
      email_frequency: 'immediate' as 'immediate' | 'daily' | 'weekly'
    }
  });

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'subscription', label: 'Suscripción', icon: Crown },
    { id: 'billing', label: 'Facturación', icon: CreditCard },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'notifications', label: 'Notificaciones', icon: Bell }
  ];

  useEffect(() => {
    loadUserData();
    loadSubscriptionData();
    loadNotificationPreferences();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      setCurrentUser(user);

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!profileError && profile) {
          setUserProfile(profile);
          setProfileData(prev => ({
            ...prev,
            name: profile.name || '',
            email: profile.email || user.email || '',
            avatar_url: profile.avatar_url || ''
          }));
        } else {
          setProfileData(prev => ({
            ...prev,
            email: user.email || ''
          }));
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadNotificationPreferences = async () => {
    try {
      const preferences = await notificationService.getPreferences();
      if (preferences) {
        setProfileData(prev => ({
          ...prev,
          notifications: {
            email_updates: preferences.email_updates,
            security_alerts: preferences.security_alerts,
            billing_notifications: preferences.billing_notifications,
            product_updates: preferences.product_updates,
            email_frequency: preferences.email_frequency
          }
        }));
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const [subscription, allPlans, currentUsage] = await Promise.all([
        subscriptionService.getCurrentSubscription(),
        subscriptionService.getSubscriptionPlans(),
        subscriptionService.getCurrentUsage()
      ]);
      
      setCurrentSubscription(subscription);
      setPlans(allPlans);
      setUsage(currentUsage);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for completed payments when component mounts or becomes visible
  const checkForCompletedPayments = async () => {
    try {
      const pendingSubscription = localStorage.getItem('pending_dlocal_subscription');
      const pendingSubscription2 = localStorage.getItem('pending_subscription');
      
      if (pendingSubscription || pendingSubscription2) {
        const data = JSON.parse(pendingSubscription || pendingSubscription2 || '{}');
        
        // If more than 30 seconds have passed, check for payment completion
        const timePassed = Date.now() - (data.timestamp || 0);
        if (timePassed > 30 * 1000) { // 30 seconds
          console.log('🔄 Checking for completed DLocal payment...');
          
          // Simulate payment completion check
          const paymentCompleted = await dLocalService.checkPaymentStatus(data.plan_token);
          
          if (paymentCompleted) {
            console.log('✅ Payment completed, activating subscription...');
            
            // Create subscription in our system
            await subscriptionService.activateSubscription(data.plan_token, data);
            
            // Reload subscription data
            await loadSubscriptionData();
            
            // Clean up
            localStorage.removeItem('pending_dlocal_subscription');
            localStorage.removeItem('pending_subscription');
            
            // Show success message
            showSuccess(
              'Suscripción activada',
              `¡Bienvenido al ${data.plan_name}! Tu suscripción está activa.`
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking for completed payments:', error);
    }
  };

  // Listen for window focus to check for completed payments
  useEffect(() => {
    const handleWindowFocus = () => {
      checkForCompletedPayments();
    };

    window.addEventListener('focus', handleWindowFocus);
    
    // Also check on component mount
    checkForCompletedPayments();
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const handleSaveProfile = async () => {
    try {
      setSaveLoading(true);

      if (userProfile) {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: profileData.name,
            avatar_url: profileData.avatar_url
          })
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: currentUser.id,
            name: profileData.name,
            email: profileData.email,
            avatar_url: profileData.avatar_url
          });

        if (error) throw error;
      }

      showSuccess(
        'Perfil actualizado',
        'Tu perfil ha sido actualizado exitosamente.'
      );

      await loadUserData();
    } catch (error) {
      console.error('Error saving profile:', error);
      showError(
        'Error al guardar',
        'Ha ocurrido un error al guardar tu perfil.'
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveNotificationPreferences = async () => {
    try {
      setSaveLoading(true);

      await notificationService.updatePreferences({
        email_updates: profileData.notifications.email_updates,
        security_alerts: profileData.notifications.security_alerts,
        billing_notifications: profileData.notifications.billing_notifications,
        product_updates: profileData.notifications.product_updates,
        email_frequency: profileData.notifications.email_frequency
      });

      showSuccess(
        'Preferencias guardadas',
        'Tus preferencias de notificaciones han sido actualizadas.'
      );
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showError(
        'Error al guardar',
        'Ha ocurrido un error al guardar tus preferencias.'
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUpgradePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    // Si es plan gratuito (precio 0), crear directamente
    if (plan.price === 0) {
      try {
        setSpecificPlanLoading(planId);
        await subscriptionService.createSubscription(planId);
        await loadSubscriptionData();
        showSuccess(
          'Plan actualizado',
          `Has cambiado al plan ${plan.name} exitosamente.`
        );
      } catch (error: any) {
        console.error('Error upgrading to free plan:', error);
        showError(
          'Error al actualizar plan',
          error?.message || 'Ha ocurrido un error al cambiar al plan gratuito.'
        );
      } finally {
        setSpecificPlanLoading(null);
      }
      return;
    }

    // Para planes de pago, usar el subscribe_url del plan
    if (plan.subscribe_url) {
      // Guardar información del plan en localStorage para cuando regrese
      localStorage.setItem('pending_subscription', JSON.stringify({
        plan_id: planId,
        plan_name: plan.name,
        plan_token: plan.plan_token,
        user_id: currentUser?.id,
        timestamp: Date.now()
      }));
      
      // Abrir DLocal checkout en popup
      const popup = window.open(
        plan.subscribe_url, 
        'dlocal-checkout',
        'width=800,height=600,scrollbars=yes,resizable=yes,location=yes'
      );
      
      // Detectar cuando se cierra el popup
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          console.log('🔄 DLocal popup closed, checking payment status...');
          // Verificar si el pago se completó
          setTimeout(async () => {
            try {
              console.log('🔍 Checking payment completion for plan:', plan.plan_token);
              const paymentCompleted = await dLocalService.checkPaymentStatus(plan.plan_token);
              if (paymentCompleted) {
                console.log('✅ Payment completed successfully');
                // Crear suscripción en nuestro sistema
                await subscriptionService.activateSubscription(plan.plan_token, {
                  plan_id: planId,
                  plan_name: plan.name,
                  plan_token: plan.plan_token,
                  user_id: currentUser?.id,
                  timestamp: Date.now()
                });
                await loadSubscriptionData();
                
                // Limpiar localStorage
                localStorage.removeItem('pending_subscription');
                localStorage.removeItem('pending_dlocal_subscription');
                
                showSuccess(
                  'Suscripción activada',
                  `¡Bienvenido al ${plan.name}! Tu suscripción está activa.`
                );
              } else {
                console.log('❌ Payment not completed or cancelled');
              }
            } catch (error) {
              console.error('Error checking payment status:', error);
            }
          }, 2000); // Wait 2 seconds before checking
        }
      }, 500); // Check every 500ms if popup is closed
    } else {
      showError(
        'Plan no disponible',
        'Este plan no tiene configurado un URL de suscripción.'
      );
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
          await loadSubscriptionData();
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
      case 'básico': return <Shield className="w-6 h-6" />;
      case 'profesional': return <Crown className="w-6 h-6" />;
      case 'empresarial': return <Star className="w-6 h-6" />;
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

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tu nombre completo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                El email no se puede cambiar desde aquí
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL del Avatar
            </label>
            <input
              type="url"
              value={profileData.avatar_url}
              onChange={(e) => setProfileData(prev => ({ ...prev, avatar_url: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://ejemplo.com/avatar.jpg"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={saveLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {saveLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{saveLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderSubscriptionTab = () => (
    <div className="space-y-6">
      {/* Current Subscription */}
      {currentSubscription ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
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

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Usuarios</span>
                <User className="w-4 h-4 text-gray-500" />
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

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">API Requests</span>
                <Shield className="w-4 h-4 text-gray-500" />
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                onClick={() => setActiveTab('subscription')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors text-sm"
              >
                <Crown className="w-4 h-4" />
                <span>Ver Todos los Planes</span>
              </button>

              {currentSubscription.subscription_plans?.price > 0 && (
                <button
                  onClick={handleCancelSubscription}
                  className="text-red-600 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm text-center"
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
      ) : (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-8 text-center">
          <Crown className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Activando tu plan gratuito...</h3>
          <p className="text-gray-600 mb-6">
            Estamos configurando tu plan Básico gratuito. Puedes actualizar a un plan superior en cualquier momento.
          </p>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto">
          </div>
        </div>
      )}
    </div>
  );

  const renderSubscriptionPlansTab = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Planes de Suscripción</h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Elige el plan perfecto para tus necesidades. Cambia o cancela en cualquier momento.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`relative bg-white rounded-2xl border-2 p-4 sm:p-6 transition-all hover:shadow-lg ${
              plan.is_popular 
                ? 'border-purple-500 shadow-lg' 
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
              <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              <div className="text-center">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-gray-600">
                  /{plan.interval === 'year' ? 'año' : 'mes'}
                </span>
                {plan.original_currency && plan.original_amount && (
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.original_amount} {plan.original_currency}
                  </p>
                )}
              </div>
              {plan.trial_days > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  {plan.trial_days} días de prueba gratis
                </p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-3 mb-6">
              {plan.features.map((feature: string, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            {/* Limits */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h5 className="font-medium text-gray-900 mb-3">Límites del Plan</h5>
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
              onClick={() => handleUpgradePlan(plan.id)}
              disabled={isCurrentPlan(plan.id) || specificPlanLoading === plan.id}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                isCurrentPlan(plan.id)
                  ? 'bg-green-100 text-green-800 cursor-not-allowed'
                  : plan.is_popular
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {specificPlanLoading === plan.id ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isCurrentPlan(plan.id) ? (
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

      {/* Feature Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Comparación de Funcionalidades</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 font-medium text-gray-900">Funcionalidad</th>
                <th className="text-center py-3 font-medium text-gray-900">Básico</th>
                <th className="text-center py-3 font-medium text-gray-900">Profesional</th>
                <th className="text-center py-3 font-medium text-gray-900">Empresarial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-3 text-gray-700">Ambiente Development</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-700">Ambiente Testing</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-700">Ambiente Production</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-700">Branding Personalizado</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-700">Webhooks</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="py-3 text-gray-700">Soporte Prioritario</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center text-gray-400">—</td>
                <td className="py-3 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillingTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Facturación</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Procesado por DLocal</h4>
              <p className="text-sm text-blue-800">
                Todos los pagos son procesados de forma segura por DLocal, líder en pagos para América Latina
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración de Seguridad</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-900">Configuración de Seguridad</h4>
              <p className="text-sm text-yellow-800">
                Las opciones de seguridad avanzadas estarán disponibles próximamente
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferencias de Notificaciones</h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Actualizaciones por Email</span>
              <p className="text-xs text-gray-500">Recibe noticias sobre nuevas funcionalidades</p>
            </div>
            <input
              type="checkbox"
              checked={profileData.notifications.email_updates}
              onChange={(e) => setProfileData(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  email_updates: e.target.checked
                }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Alertas de Seguridad</span>
              <p className="text-xs text-gray-500">Notificaciones sobre actividad sospechosa</p>
            </div>
            <input
              type="checkbox"
              checked={profileData.notifications.security_alerts}
              onChange={(e) => setProfileData(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  security_alerts: e.target.checked
                }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">Notificaciones de Facturación</span>
              <p className="text-xs text-gray-500">Recordatorios de pago y facturas</p>
            </div>
            <input
              type="checkbox"
              checked={profileData.notifications.billing_notifications}
              onChange={(e) => setProfileData(prev => ({
                ...prev,
                notifications: {
                  ...prev.notifications,
                  billing_notifications: e.target.checked
                }
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Frecuencia de Emails</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={profileData.notifications.email_frequency === 'immediate'}
                  onChange={() => setProfileData(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      email_frequency: 'immediate'
                    }
                  }))}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Inmediato</span>
                  <p className="text-xs text-gray-500">Recibe emails al instante</p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={profileData.notifications.email_frequency === 'daily'}
                  onChange={() => setProfileData(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      email_frequency: 'daily'
                    }
                  }))}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Diario</span>
                  <p className="text-xs text-gray-500">Resumen diario de notificaciones</p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="email_frequency"
                  checked={profileData.notifications.email_frequency === 'weekly'}
                  onChange={() => setProfileData(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      email_frequency: 'weekly'
                    }
                  }))}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Semanal</span>
                  <p className="text-xs text-gray-500">Resumen semanal de notificaciones</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveNotificationPreferences}
            disabled={saveLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {saveLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{saveLoading ? 'Guardando...' : 'Guardar Preferencias'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
        <p className="text-gray-600">Gestiona tu perfil, suscripción y preferencias</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto space-x-4 sm:space-x-8 px-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-3 sm:py-4 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{tab.label}</span>
                  {tab.id === 'subscription' && !currentSubscription && (
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      Sin plan
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'subscription' && renderSubscriptionPlansTab()}
              {activeTab === 'billing' && renderBillingTab()}
              {activeTab === 'security' && renderSecurityTab()}
              {activeTab === 'notifications' && renderNotificationsTab()}
            </>
          )}
        </div>
      </div>

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