import React, { useState, useEffect } from 'react';
import { Crown, Lock, ArrowRight, Star, Check } from 'lucide-react';
import { subscriptionService } from '../../services/subscriptionService';

interface SubscriptionGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export default function SubscriptionGuard({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: SubscriptionGuardProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, [feature]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      const [canAccess, subscription] = await Promise.all([
        subscriptionService.canAccessFeature(feature),
        subscriptionService.getCurrentSubscription()
      ]);
      
      setHasAccess(canAccess);
      setCurrentPlan(subscription?.subscription_plans);
    } catch (error) {
      console.error('Error checking subscription access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    const event = new CustomEvent('changeSectionWithApp', { 
      detail: { section: 'subscription' } 
    });
    window.dispatchEvent(event);
  };

  const getFeatureDisplayName = (feature: string) => {
    switch (feature) {
      case 'production_api_keys': return 'API Keys de Producción';
      case 'custom_branding': return 'Branding Personalizado';
      case 'webhooks': return 'Webhooks';
      case 'analytics': return 'Analytics Avanzados';
      case 'priority_support': return 'Soporte Prioritario';
      default: return feature;
    }
  };

  const getRequiredPlan = (feature: string) => {
    switch (feature) {
      case 'production_api_keys': return 'Profesional';
      case 'custom_branding': return 'Profesional';
      case 'webhooks': return 'Profesional';
      case 'analytics': return 'Profesional';
      case 'priority_support': return 'Empresarial';
      default: return 'Profesional';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border-2 border-dashed border-purple-300 p-8 text-center">
      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Crown className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Función Premium Requerida
      </h3>
      
      <p className="text-gray-600 mb-4">
        <strong>{getFeatureDisplayName(feature)}</strong> está disponible en el plan {getRequiredPlan(feature)} y superiores.
      </p>

      <div className="bg-white rounded-lg p-4 mb-6 border border-purple-200">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Star className="w-5 h-5 text-purple-500" />
          <span className="font-medium text-purple-900">Plan Actual: {currentPlan?.name || 'Básico'}</span>
        </div>
        <p className="text-sm text-gray-600">
          Actualiza tu plan para desbloquear esta funcionalidad y muchas más
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center space-x-3 text-sm text-gray-700">
          <Check className="w-4 h-4 text-green-500" />
          <span>Acceso inmediato después del pago</span>
        </div>
        <div className="flex items-center space-x-3 text-sm text-gray-700">
          <Check className="w-4 h-4 text-green-500" />
          <span>14 días de prueba gratis</span>
        </div>
        <div className="flex items-center space-x-3 text-sm text-gray-700">
          <Check className="w-4 h-4 text-green-500" />
          <span>Cancela en cualquier momento</span>
        </div>
      </div>

      <button
        onClick={handleUpgrade}
        className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition-all flex items-center space-x-2 mx-auto"
      >
        <Crown className="w-5 h-5" />
        <span>Actualizar Plan</span>
        <ArrowRight className="w-5 h-5" />
      </button>

      <p className="text-xs text-gray-500 mt-4">
        Procesado de forma segura por DLocal
      </p>
    </div>
  );
}