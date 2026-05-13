import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { createLocalPlanSubscription, getActivePlans } from '../_shared/application-billing.ts';
import { buildRedirectUrl } from '../_shared/application-auth-url.ts';
import { resolveTrustedBillingReturnUrl } from '../_shared/billing-return-url.ts';
import { mercadoPagoRequest, normalizeMercadoPagoConfig } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface StartCheckoutRequest {
  application_id: string;
  api_key: string;
  plan_id: string;
  return_url: string;
  email?: string;
  tenant_id?: string;
  app_user_id?: string;
  metadata?: Record<string, any>;
}

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

    const body = await req.json().catch(() => ({})) as StartCheckoutRequest;
    const applicationId = String(body.application_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const planId = String(body.plan_id || '').trim();
    const returnUrl = String(body.return_url || '').trim();
    const payerEmail = String(body.email || '').trim().toLowerCase() || null;
    const tenantId = String(body.tenant_id || '').trim() || null;
    const appUserId = String(body.app_user_id || '').trim() || null;

    if (!applicationId || !apiKey || !planId || !returnUrl) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'application_id, api_key, plan_id and return_url are required',
        },
      }, 400);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, domain, auth_mode, metadata, billing_config')
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

    const trustedReturnUrl = await resolveTrustedBillingReturnUrl(supabase, application, returnUrl);
    if (!trustedReturnUrl) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_RETURN_URL',
          message: 'La URL de retorno no esta autorizada para esta aplicacion',
        },
      }, 422);
    }

    const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {});
    if (!billingConfig.enabled) {
      return jsonResponse({
        success: false,
        error: {
          code: 'BILLING_DISABLED',
          message: 'La facturacion interna no esta habilitada para esta aplicacion',
        },
      }, 422);
    }

    const activePlans = await getActivePlans(supabase, application.id);
    const plan = activePlans.find((item) => item.id === planId) || null;

    if (!plan) {
      return jsonResponse({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'No encontramos ese plan activo dentro de la aplicacion',
        },
      }, 404);
    }

    const price = Number(plan.price || 0);
    const trialDays = Number(plan.trial_days || 0);
    const canProvisionWithoutCheckout = price === 0 || trialDays > 0;

    if (!canProvisionWithoutCheckout) {
      if (!billingConfig.accessToken) {
        return jsonResponse({
          success: false,
          error: {
            code: 'MERCADOPAGO_CONFIG_MISSING',
            message: 'Falta configurar el access token de Mercado Pago',
          },
        }, 422);
      }

      if (!billingConfig.backUrl) {
        return jsonResponse({
          success: false,
          error: {
            code: 'MERCADOPAGO_BACK_URL_MISSING',
            message: 'Debes configurar la URL de retorno de Mercado Pago en Planes y Suscripciones',
          },
        }, 422);
      }

      if (!plan.provider_plan_id) {
        return jsonResponse({
          success: false,
          error: {
            code: 'PLAN_NOT_SYNCED',
            message: 'El plan aun no esta sincronizado con Mercado Pago',
          },
        }, 422);
      }
    }

    const sessionId = crypto.randomUUID();
    const externalReference = `checkout:${sessionId}`;
    const sessionMetadata = {
      source: 'authsystem_checkout',
      requested_return_url: trustedReturnUrl,
      ...((body.metadata && typeof body.metadata === 'object') ? body.metadata : {}),
    };

    const { data: checkoutSession, error: checkoutSessionError } = await supabase
      .from('subscription_checkout_sessions')
      .insert({
        id: sessionId,
        application_id: application.id,
        application_plan_id: plan.id,
        tenant_id: tenantId,
        app_user_id: appUserId,
        payer_email: payerEmail,
        provider: 'mercadopago',
        external_reference: externalReference,
        return_url: trustedReturnUrl,
        provider_plan_id: plan.provider_plan_id || null,
        status: 'pending',
        metadata: sessionMetadata,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (checkoutSessionError || !checkoutSession) {
      console.error('subscription-start-checkout session error:', checkoutSessionError);
      return jsonResponse({
        success: false,
        error: {
          code: 'CHECKOUT_SESSION_ERROR',
          message: 'No se pudo crear la sesion de checkout',
        },
      }, 500);
    }

    if (canProvisionWithoutCheckout) {
      const localSubscription = await createLocalPlanSubscription({
        supabase,
        applicationId: application.id,
        plan,
        tenantId,
        appUserId,
        payerEmail,
        source: 'subscription_checkout_session',
      });

      await supabase
        .from('subscription_checkout_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          metadata: {
            ...sessionMetadata,
            local_subscription_id: localSubscription?.id || null,
            completed_without_provider: true,
          },
        })
        .eq('id', sessionId);

      return jsonResponse({
        success: true,
        data: {
          checkout_session_id: sessionId,
          provider: 'internal',
          requires_redirect: false,
          redirect_url: buildRedirectUrl(trustedReturnUrl, {
            subscription_state: 'active',
            checkout_session_id: sessionId,
            plan_id: plan.id,
            provider: 'internal',
          }),
          subscription: localSubscription,
        },
      });
    }

    const providerResponse = await mercadoPagoRequest(
      billingConfig,
      'POST',
      '/preapproval',
      {
        body: {
          preapproval_plan_id: plan.provider_plan_id,
          reason: plan.name,
          external_reference: externalReference,
          payer_email: payerEmail || undefined,
          back_url: billingConfig.backUrl,
          status: 'pending',
        },
      },
    );

    await supabase
      .from('subscription_checkout_sessions')
      .update({
        provider_plan_id: plan.provider_plan_id || null,
        provider_subscription_id: providerResponse?.id || null,
        provider_checkout_url: providerResponse?.init_point || null,
        provider_status: providerResponse?.status || 'pending',
        provider_metadata: providerResponse || {},
        status: 'checkout_created',
      })
      .eq('id', sessionId);

    return jsonResponse({
      success: true,
      data: {
        checkout_session_id: sessionId,
        provider: 'mercadopago',
        requires_redirect: true,
        checkout_url: providerResponse?.init_point || null,
        provider_subscription_id: providerResponse?.id || null,
        plan: {
          id: plan.id,
          name: plan.name,
          price: Number(plan.price || 0),
          currency: plan.currency,
        },
      },
    });
  } catch (error: any) {
    console.error('subscription-start-checkout error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
