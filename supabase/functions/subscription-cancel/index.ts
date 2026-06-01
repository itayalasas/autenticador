import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import {
  isBillableSubscriptionCancellable,
  resolveApplicationBillingAccess,
  syncMercadoPagoSubscriptionById,
} from '../_shared/application-billing.ts';
import { mercadoPagoRequest, normalizeMercadoPagoConfig } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface CancelSubscriptionRequest {
  application_id: string;
  api_key: string;
  subscription_id?: string;
  provider_subscription_id?: string;
  tenant_id?: string;
  app_user_id?: string;
  cancel_reason?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

async function resolveTargetSubscription(params: {
  supabase: any;
  applicationInternalId: string;
  subscriptionId?: string | null;
  providerSubscriptionId?: string | null;
  tenantId?: string | null;
  appUserId?: string | null;
}) {
  const {
    supabase,
    applicationInternalId,
    subscriptionId,
    providerSubscriptionId,
    tenantId,
    appUserId,
  } = params;

  if (subscriptionId) {
    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('application_id', applicationInternalId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
  }

  if (providerSubscriptionId) {
    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .select('*')
      .eq('provider_subscription_id', providerSubscriptionId)
      .eq('application_id', applicationInternalId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
  }

  if (tenantId) {
    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .select('*')
      .eq('application_id', applicationInternalId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'authorized', 'active', 'trialing', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
  }

  if (appUserId) {
    const { data, error } = await supabase
      .from('application_plan_subscriptions')
      .select('*')
      .eq('application_id', applicationInternalId)
      .eq('app_user_id', appUserId)
      .in('status', ['pending', 'authorized', 'active', 'trialing', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST method is allowed',
        },
      }, 405);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json().catch(() => ({})) as CancelSubscriptionRequest;
    const applicationId = String(body.application_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const subscriptionId = String(body.subscription_id || '').trim() || null;
    const providerSubscriptionId = String(body.provider_subscription_id || '').trim() || null;
    const tenantId = String(body.tenant_id || '').trim() || null;
    const appUserId = String(body.app_user_id || '').trim() || null;
    const cancelReason = String(body.cancel_reason || '').trim() || null;

    if (!applicationId || !apiKey) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'application_id y api_key son requeridos',
        },
      }, 400);
    }

    if (!subscriptionId && !providerSubscriptionId && !tenantId && !appUserId) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_SUBSCRIPTION_IDENTIFIER',
          message: 'Debes enviar subscription_id, provider_subscription_id, tenant_id o app_user_id',
        },
      }, 400);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, auth_mode, billing_config')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      return jsonResponse({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicacion no encontrada',
        },
      }, 404);
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('application_id, is_active')
      .eq('key_hash', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (!apiKeyData) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API Key invalida o inactiva',
        },
      }, 401);
    }

    if (apiKeyData.application_id !== application.id) {
      return jsonResponse({
        success: false,
        error: {
          code: 'API_KEY_MISMATCH',
          message: 'API Key no pertenece a esta aplicacion',
        },
      }, 403);
    }

    const subscription = await resolveTargetSubscription({
      supabase,
      applicationInternalId: application.id,
      subscriptionId,
      providerSubscriptionId,
      tenantId,
      appUserId,
    });

    if (!subscription) {
      return jsonResponse({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'No encontramos una suscripcion activa o pendiente para cancelar',
        },
      }, 404);
    }

    console.log('subscription-cancel request', {
      applicationId: application.application_id,
      subscriptionId: subscription.id,
      provider: subscription.provider,
      providerSubscriptionId: subscription.provider_subscription_id,
      tenantId: subscription.tenant_id,
      appUserId: subscription.app_user_id,
      currentStatus: subscription.status,
    });

    const currentStatus = String(subscription.status || '').trim().toLowerCase();
    if (!isBillableSubscriptionCancellable(currentStatus)) {
      const alreadyFinal = ['cancelled', 'expired', 'payment_failed'].includes(currentStatus);
      const currentMetadata = normalizeMetadata(subscription.metadata);
      const sessionAppUser = subscription.app_user_id
        ? await supabase
            .from('app_users')
            .select('id, email, metadata, tenant_id')
            .eq('id', subscription.app_user_id)
            .maybeSingle()
        : { data: null };

      const fallbackAppUser = !sessionAppUser.data && subscription.payer_email
        ? await supabase
            .from('app_users')
            .select('id, email, metadata, tenant_id')
            .eq('application_id', application.id)
            .eq('email', subscription.payer_email)
            .maybeSingle()
        : { data: null };

      const appUser = sessionAppUser.data || fallbackAppUser.data || {
        id: subscription.app_user_id || '',
        email: subscription.payer_email || '',
        metadata: {},
        tenant_id: subscription.tenant_id || null,
      };

      const billingState = await resolveApplicationBillingAccess({
        supabase,
        application,
        appUser,
        tenantId: subscription.tenant_id || appUser.tenant_id || null,
      });

      return jsonResponse({
        success: true,
        data: {
          cancelled: currentStatus === 'cancelled',
          already_finalized: alreadyFinal,
          subscription: {
            ...billingState.subscription,
            id: subscription.id,
            status: subscription.status,
            metadata: currentMetadata,
          },
          has_access: billingState.has_access,
          license: billingState.license,
          available_plans: billingState.available_plans,
        },
      });
    }

    const now = new Date().toISOString();
    const currentMetadata = normalizeMetadata(subscription.metadata);
    const baseMetadata = {
      ...currentMetadata,
      cancel_requested_at: now,
      cancelled_at: now,
      cancel_reason: cancelReason,
      cancelled_via: subscription.provider === 'mercadopago'
        ? 'mercadopago_api'
        : 'internal_api',
      last_synced_at: now,
    };

    let updatedSubscription = subscription;
    let providerStatus = currentStatus;

    if (String(subscription.provider || '').toLowerCase() === 'mercadopago' && subscription.provider_subscription_id) {
      const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {});
      if (!billingConfig.enabled || !billingConfig.accessToken) {
        return jsonResponse({
          success: false,
          error: {
            code: 'MERCADOPAGO_CONFIG_MISSING',
            message: 'Falta configurar el access token de Mercado Pago',
          },
        }, 422);
      }

      const providerResponse = await mercadoPagoRequest(
        billingConfig,
        'PUT',
        `/preapproval/${subscription.provider_subscription_id}`,
        {
          body: {
            status: 'cancelled',
          },
        },
      );

      providerStatus = String(providerResponse?.status || 'cancelled').trim().toLowerCase();

      await supabase
        .from('application_plan_subscriptions')
        .update({
          metadata: {
            ...baseMetadata,
            provider_cancel_response: providerResponse || {},
          },
          provider_metadata: providerResponse || subscription.provider_metadata || {},
        })
        .eq('id', subscription.id);

      console.log('subscription-cancel Mercado Pago response', {
        subscriptionId: subscription.id,
        providerSubscriptionId: subscription.provider_subscription_id,
        providerStatus,
      });

      const synced = await syncMercadoPagoSubscriptionById({
        supabase,
        application,
        providerSubscriptionId: subscription.provider_subscription_id,
        selectedPlanId: subscription.application_plan_id,
        tenantId: subscription.tenant_id,
        appUserId: subscription.app_user_id,
        payerEmail: subscription.payer_email,
        source: 'subscription_cancel',
      });

      if (synced?.subscription) {
        updatedSubscription = synced.subscription;
      } else {
        const { data: fallbackCancelled } = await supabase
          .from('application_plan_subscriptions')
          .update({
            status: 'cancelled',
            next_payment_date: null,
            metadata: baseMetadata,
            provider_metadata: providerResponse || subscription.provider_metadata || {},
          })
          .eq('id', subscription.id)
          .select('*')
          .single();

        if (fallbackCancelled) {
          updatedSubscription = fallbackCancelled;
        }
      }
    } else {
      const { data: localCancelled, error: localCancelError } = await supabase
        .from('application_plan_subscriptions')
        .update({
          status: 'cancelled',
          next_payment_date: null,
          metadata: {
            ...baseMetadata,
            cancelled_at: now,
          },
        })
        .eq('id', subscription.id)
        .select('*')
        .single();

      if (localCancelError || !localCancelled) {
        console.error('subscription-cancel local error:', localCancelError);
        return jsonResponse({
          success: false,
          error: {
            code: 'SUBSCRIPTION_CANCEL_FAILED',
            message: 'No se pudo cancelar la suscripcion local',
          },
        }, 500);
      }

      updatedSubscription = localCancelled;
      providerStatus = 'cancelled';
    }

    const { data: refreshedSubscription } = await supabase
      .from('application_plan_subscriptions')
      .select('*')
      .eq('id', updatedSubscription.id)
      .maybeSingle();

    updatedSubscription = refreshedSubscription || updatedSubscription;

    const sessionAppUser = updatedSubscription.app_user_id
      ? await supabase
          .from('app_users')
          .select('id, email, metadata, tenant_id')
          .eq('id', updatedSubscription.app_user_id)
          .maybeSingle()
      : { data: null };

    const fallbackAppUser = !sessionAppUser.data && updatedSubscription.payer_email
      ? await supabase
          .from('app_users')
          .select('id, email, metadata, tenant_id')
          .eq('application_id', application.id)
          .eq('email', updatedSubscription.payer_email)
          .maybeSingle()
      : { data: null };

    const appUser = sessionAppUser.data || fallbackAppUser.data || {
      id: updatedSubscription.app_user_id || '',
      email: updatedSubscription.payer_email || '',
      metadata: {},
      tenant_id: updatedSubscription.tenant_id || null,
    };

    const billingState = await resolveApplicationBillingAccess({
      supabase,
      application,
      appUser,
      tenantId: updatedSubscription.tenant_id || appUser.tenant_id || null,
    });

    return jsonResponse({
      success: true,
      data: {
        cancelled: true,
        provider_status: providerStatus || 'cancelled',
        subscription: billingState.subscription,
        has_access: billingState.has_access,
        license: billingState.license,
        available_plans: billingState.available_plans,
      },
    });
  } catch (error: any) {
    console.error('subscription-cancel error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
