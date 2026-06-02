import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveApplicationBillingAccess, syncMercadoPagoSubscriptionById } from '../_shared/application-billing.ts';
import { normalizeBillingEnvironmentName } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const input = req.method === 'GET'
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await req.json().catch(() => ({}));

    const applicationId = String(input.application_id || '').trim();
    const apiKey = String(input.api_key || '').trim();
    const checkoutSessionId = String(
      input.checkout_session_id ||
      input.session_id ||
      ''
    ).trim();

    if (!applicationId || !apiKey || !checkoutSessionId) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'application_id, api_key and checkout_session_id are required',
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
      .select('application_id, is_active, environment')
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

    const billingEnvironment = normalizeBillingEnvironmentName(apiKeyData.environment || null);

    const { data: checkoutSession, error: checkoutSessionError } = await supabase
      .from('subscription_checkout_sessions')
      .select('*')
      .eq('id', checkoutSessionId)
      .eq('application_id', application.id)
      .maybeSingle();

    if (checkoutSessionError || !checkoutSession) {
      return jsonResponse({
        success: false,
        error: {
          code: 'CHECKOUT_SESSION_NOT_FOUND',
          message: 'No encontramos la sesion de checkout solicitada',
        },
      }, 404);
    }

    if (checkoutSession.provider_subscription_id) {
      const synced = await syncMercadoPagoSubscriptionById({
        supabase,
        application,
        providerSubscriptionId: checkoutSession.provider_subscription_id,
        selectedPlanId: checkoutSession.application_plan_id,
        tenantId: checkoutSession.tenant_id,
        appUserId: checkoutSession.app_user_id,
        payerEmail: checkoutSession.payer_email,
        source: 'subscription_checkout_status',
        environmentName: billingEnvironment || checkoutSession?.metadata?.billing_environment || null,
      });

      const providerStatus = String(synced?.providerSubscription?.status || checkoutSession.provider_status || '').trim().toLowerCase();
      await supabase
        .from('subscription_checkout_sessions')
        .update({
          provider_status: providerStatus || null,
          provider_metadata: synced?.providerSubscription || checkoutSession.provider_metadata || {},
          status: ['authorized', 'active'].includes(providerStatus)
            ? 'completed'
            : ['cancelled', 'canceled'].includes(providerStatus)
              ? 'cancelled'
              : providerStatus === 'rejected'
                ? 'failed'
                : checkoutSession.status,
          last_synced_at: new Date().toISOString(),
          completed_at: ['authorized', 'active'].includes(providerStatus)
            ? new Date().toISOString()
            : checkoutSession.completed_at,
        })
        .eq('id', checkoutSession.id);
    }

    const sessionAppUser = checkoutSession.app_user_id
      ? await supabase
          .from('app_users')
          .select('id, email, metadata, tenant_id')
          .eq('id', checkoutSession.app_user_id)
          .maybeSingle()
      : { data: null };

    const fallbackAppUser = !sessionAppUser.data && checkoutSession.payer_email
      ? await supabase
          .from('app_users')
          .select('id, email, metadata, tenant_id')
          .eq('application_id', application.id)
          .eq('email', checkoutSession.payer_email)
          .maybeSingle()
      : { data: null };

    const appUser = sessionAppUser.data || fallbackAppUser.data || {
      id: checkoutSession.app_user_id || '',
      email: checkoutSession.payer_email || '',
      metadata: {},
      tenant_id: checkoutSession.tenant_id || null,
    };

    const billingState = await resolveApplicationBillingAccess({
      supabase,
      application,
      appUser,
      tenantId: checkoutSession.tenant_id || appUser.tenant_id || null,
      environmentName: billingEnvironment || checkoutSession?.metadata?.billing_environment || null,
    });

    const { data: refreshedSession } = await supabase
      .from('subscription_checkout_sessions')
      .select('*')
      .eq('id', checkoutSession.id)
      .maybeSingle();

    return jsonResponse({
      success: true,
      data: {
        application: {
          id: application.application_id,
          name: application.name,
          auth_mode: application.auth_mode,
        },
        environment: billingEnvironment || checkoutSession?.metadata?.billing_environment || null,
        checkout_session: {
          id: refreshedSession?.id || checkoutSession.id,
          status: refreshedSession?.status || checkoutSession.status,
          provider_status: refreshedSession?.provider_status || checkoutSession.provider_status || null,
          provider_subscription_id: refreshedSession?.provider_subscription_id || checkoutSession.provider_subscription_id || null,
          return_url: refreshedSession?.return_url || checkoutSession.return_url,
          completed_at: refreshedSession?.completed_at || checkoutSession.completed_at || null,
          last_synced_at: refreshedSession?.last_synced_at || checkoutSession.last_synced_at || null,
        },
        has_access: billingState.has_access,
        subscription: billingState.subscription,
        license: billingState.license,
        available_plans: billingState.available_plans,
      },
    });
  } catch (error: any) {
    console.error('subscription-checkout-status error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
