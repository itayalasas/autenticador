import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { applicationService } from '../../services/applicationService';
import { applicationBillingService } from '../../services/applicationBillingService';
import { ApplicationPlanSubscription } from '../../types';
import { useNotification } from '../../hooks/useNotification';
import NotificationModal from '../ui/NotificationModal';
import ApplicationPlansManager from '../authentication/ApplicationPlansManager';

type BillingTab = 'plans' | 'subscriptions';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  trialing: 'bg-sky-100 text-sky-800',
  authorized: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  paused: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-800',
  expired: 'bg-slate-100 text-slate-700',
  payment_failed: 'bg-rose-100 text-rose-800',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';

  try {
    return new Intl.DateTimeFormat('es-UY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getSubscriptionOwner(subscription: ApplicationPlanSubscription) {
  if (subscription.tenants?.name) {
    return {
      title: subscription.tenants.name,
      subtitle: subscription.payer_email || subscription.app_users?.email || 'Tenant',
      scope: subscription.app_users?.name ? `Tenant + admin ${subscription.app_users.name}` : 'Tenant',
    };
  }

  if (subscription.app_users?.name || subscription.app_users?.email) {
    return {
      title: subscription.app_users?.name || subscription.app_users?.email || 'Usuario final',
      subtitle: subscription.app_users?.email || subscription.payer_email || 'Usuario final',
      scope: 'Usuario final',
    };
  }

  return {
    title: subscription.payer_email || 'Suscripción sin identificar',
    subtitle: subscription.external_reference || 'Referencia interna',
    scope: 'Sin scope asociado',
  };
}

export default function PlansSubscriptionsManager() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<ApplicationPlanSubscription[]>([]);
  const [activeTab, setActiveTab] = useState<BillingTab>('plans');

  const {
    notification,
    showSuccess,
    showError,
    closeNotification,
  } = useNotification();

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedApp) || null,
    [applications, selectedApp]
  );

  const subscriptionSummary = useMemo(() => {
    return subscriptions.reduce(
      (accumulator, subscription) => {
        accumulator.total += 1;

        if (['active', 'authorized'].includes(subscription.status)) {
          accumulator.active += 1;
        }

        if (subscription.status === 'trialing') {
          accumulator.trialing += 1;
        }

        if (['pending', 'payment_failed'].includes(subscription.status)) {
          accumulator.attention += 1;
        }

        return accumulator;
      },
      { total: 0, active: 0, trialing: 0, attention: 0 }
    );
  }, [subscriptions]);

  const loadApplications = async () => {
    try {
      setApplicationsLoading(true);
      const loadedApplications = await applicationService.getApplications();
      setApplications(loadedApplications);

      if (loadedApplications.length > 0) {
        const stored = sessionStorage.getItem('selectedAppId');
        const preferred = stored && loadedApplications.some((application: any) => application.id === stored)
          ? stored
          : loadedApplications[0].id;

        setSelectedApp(preferred);
      }
    } catch (error) {
      console.error('Error loading applications for billing manager:', error);
      showError('No pudimos cargar las aplicaciones', 'Revisa tu sesión e inténtalo nuevamente.');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const loadSubscriptions = async (applicationId: string) => {
    try {
      setSubscriptionsLoading(true);
      const loadedSubscriptions = await applicationBillingService.getSubscriptions(applicationId);
      setSubscriptions(loadedSubscriptions);
    } catch (error: any) {
      console.error('Error loading application subscriptions:', error);
      showError(
        'No pudimos cargar las suscripciones',
        error?.message || 'Ocurrió un error al consultar las suscripciones de la aplicación.'
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    sessionStorage.setItem('selectedAppId', selectedApp);
    void loadSubscriptions(selectedApp);
  }, [selectedApp]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              <CreditCard className="h-3.5 w-3.5" />
              Monetización por aplicación
            </div>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Planes y Suscripciones</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Gestiona el catálogo comercial de cada aplicación, su configuración con Mercado Pago y el
              estado real de las suscripciones que usa el login público para habilitar acceso.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Suscripciones</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{subscriptionSummary.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Activas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{subscriptionSummary.active}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">En atención</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">{subscriptionSummary.attention}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Aplicación</label>
            <select
              value={selectedApp}
              onChange={(event) => setSelectedApp(event.target.value)}
              disabled={applicationsLoading}
              className="w-full max-w-2xl rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Selecciona una aplicación</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.name} ({application.domain})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'plans'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <Settings className="h-4 w-4" />
              Planes y configuración
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'subscriptions'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Suscripciones
            </button>
          </div>
        </div>

        {selectedApplication && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedApplication.name}</p>
                <p className="text-sm text-slate-600">{selectedApplication.domain}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                  Auth mode: {selectedApplication.auth_mode || 'classic'}
                </span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                  Plans sync: {(selectedApplication.billing_config?.enabled ||
                    Object.values(selectedApplication.billing_config?.environments || {}).some((entry: any) => entry?.enabled === true))
                    ? 'interno activo'
                    : 'pendiente'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!selectedApp ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Selecciona una aplicación para continuar</h3>
          <p className="mt-2 text-sm text-slate-600">
            Cada aplicación tiene su propia configuración de planes, suscripciones y sincronización con Mercado Pago.
          </p>
        </div>
      ) : activeTab === 'plans' ? (
        <ApplicationPlansManager
          applicationId={selectedApp}
          onSuccess={(title, message) => {
            showSuccess(title, message);
            void loadSubscriptions(selectedApp);
          }}
          onError={showError}
        />
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-xl font-semibold text-slate-900">Suscripciones registradas</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Aquí vemos los tenants o usuarios que ya tienen un plan asociado. Esta tabla mezcla lo
                  que se provisiona automáticamente con lo que luego se sincroniza desde Mercado Pago.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadSubscriptions(selectedApp)}
                disabled={subscriptionsLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${subscriptionsLoading ? 'animate-spin' : ''}`} />
                {subscriptionsLoading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-slate-700" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{subscriptionSummary.total}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Activas</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-900">{subscriptionSummary.active}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-sky-700" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Trial</p>
                    <p className="mt-1 text-2xl font-bold text-sky-900">{subscriptionSummary.trialing}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Atención</p>
                    <p className="mt-1 text-2xl font-bold text-amber-900">{subscriptionSummary.attention}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {subscriptionsLoading ? (
              <div className="flex items-center gap-3 px-6 py-8 text-sm text-slate-600">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Cargando suscripciones de la aplicación...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <h4 className="mt-4 text-lg font-semibold text-slate-900">Todavía no hay suscripciones registradas</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Cuando un tenant o usuario tome un plan, o cuando Mercado Pago sincronice una suscripción,
                  aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scope</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Próximo ciclo</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {subscriptions.map((subscription) => {
                      const owner = getSubscriptionOwner(subscription);
                      const statusClassName = STATUS_STYLES[subscription.status] || 'bg-slate-100 text-slate-700';

                      return (
                        <tr key={subscription.id} className="align-top">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">{owner.title}</p>
                            <p className="mt-1 text-sm text-slate-500">{owner.subtitle}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {owner.scope}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {subscription.application_billing_plans?.name || 'Plan sin resolver'}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {subscription.application_billing_plans
                                ? `${subscription.application_billing_plans.currency} ${Number(subscription.application_billing_plans.price || 0).toFixed(2)} / ${subscription.application_billing_plans.interval_count} ${subscription.application_billing_plans.interval}`
                                : subscription.provider_plan_id || 'Sin plan asociado'}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName}`}>
                              {subscription.status}
                            </span>
                            <p className="mt-2 text-xs text-slate-500">{subscription.provider}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDate(subscription.next_payment_date || subscription.current_period_end || subscription.trial_end)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {formatDate(subscription.updated_at || subscription.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <NotificationModal
        notification={notification}
        onClose={closeNotification}
      />
    </div>
  );
}
