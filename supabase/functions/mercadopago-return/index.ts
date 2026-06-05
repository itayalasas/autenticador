import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { buildRedirectUrl, normalizeUrl } from '../_shared/application-auth-url.ts';
import { syncMercadoPagoSubscriptionById } from '../_shared/application-billing.ts';
import { normalizeBillingEnvironmentName } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function redirectResponse(targetUrl: string, status = 302) {
  return new Response(null, {
    status,
    headers: {
      ...corsHeaders,
      Location: targetUrl,
      'Cache-Control': 'no-store',
    },
  });
}

function htmlResponse(message: string, status = 400) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>AuthSystem</title></head><body style="font-family:system-ui;padding:32px;background:#0f172a;color:#e2e8f0"><h1 style="margin:0 0 12px">AuthSystem</h1><p style="margin:0">${message}</p></body></html>`,
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
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

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    const providerSubscriptionId = String(
      url.searchParams.get('preapproval_id') ||
      url.searchParams.get('preapprovalId') ||
      (body as any).preapproval_id ||
      ''
    ).trim();

    const checkoutSessionId = String(
      url.searchParams.get('checkout_session_id') ||
      url.searchParams.get('checkoutSessionId') ||
      (body as any).checkout_session_id ||
      ''
    ).trim();

    const externalReference = String(
      url.searchParams.get('external_reference') ||
      url.searchParams.get('externalReference') ||
      (body as any).external_reference ||
      ''
    ).trim();

    let checkoutSession: any = null;

    if (checkoutSessionId) {
      const { data } = await supabase
        .from('subscription_checkout_sessions')
        .select('*')
        .eq('id', checkoutSessionId)
        .maybeSingle();
      checkoutSession = data || null;
    }

    if (!checkoutSession && externalReference) {
      const { data } = await supabase
        .from('subscription_checkout_sessions')
        .select('*')
        .eq('external_reference', externalReference)
        .maybeSingle();
      checkoutSession = data || null;
    }

    if (!checkoutSession && providerSubscriptionId) {
      const { data } = await supabase
        .from('subscription_checkout_sessions')
        .select('*')
        .eq('provider_subscription_id', providerSubscriptionId)
        .maybeSingle();
      checkoutSession = data || null;
    }

    if (!checkoutSession) {
      return htmlResponse('No pudimos resolver la sesion de suscripcion asociada a este retorno.', 404);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, billing_config, metadata, domain')
      .eq('id', checkoutSession.application_id)
      .maybeSingle();

    if (applicationError || !application) {
      return htmlResponse('La aplicacion asociada al checkout ya no esta disponible.', 404);
    }

    const finalProviderSubscriptionId = providerSubscriptionId || String(checkoutSession.provider_subscription_id || '').trim();
    const billingEnvironment = normalizeBillingEnvironmentName(
      (typeof checkoutSession?.metadata === 'object' ? (checkoutSession.metadata as Record<string, any>)?.billing_environment : null) ||
      null
    );

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

    const resolvedAppUser = sessionAppUser.data || fallbackAppUser.data || null;
    const resolvedAppUserId = resolvedAppUser?.id || checkoutSession.app_user_id || null;
    const resolvedTenantId = checkoutSession.tenant_id || resolvedAppUser?.tenant_id || null;

    if ((resolvedAppUserId && resolvedAppUserId !== checkoutSession.app_user_id) || (resolvedTenantId && resolvedTenantId !== checkoutSession.tenant_id)) {
      await supabase
        .from('subscription_checkout_sessions')
        .update({
          app_user_id: resolvedAppUserId || checkoutSession.app_user_id || null,
          tenant_id: resolvedTenantId || checkoutSession.tenant_id || null,
        })
        .eq('id', checkoutSession.id);
    }

    let synced: Awaited<ReturnType<typeof syncMercadoPagoSubscriptionById>> | null = null;
    let subscriptionState = String(url.searchParams.get('status') || checkoutSession.provider_status || 'pending').trim().toLowerCase();

    if (finalProviderSubscriptionId) {
      synced = await syncMercadoPagoSubscriptionById({
        supabase,
        application,
        providerSubscriptionId: finalProviderSubscriptionId,
        selectedPlanId: checkoutSession.application_plan_id,
        tenantId: resolvedTenantId,
        appUserId: resolvedAppUserId,
        payerEmail: checkoutSession.payer_email,
        source: 'mercadopago_return',
        environmentName: billingEnvironment,
      });

      if (synced?.providerSubscription?.status) {
        subscriptionState = String(synced.providerSubscription.status).trim().toLowerCase();
      }
    }

    const syncedSubscriptionState = String(synced?.subscription?.status || '').trim().toLowerCase();
    const completed = ['authorized', 'active'].includes(subscriptionState)
      || ['authorized', 'active', 'trialing'].includes(syncedSubscriptionState);
    const cancelled = ['cancelled', 'canceled'].includes(subscriptionState);
    const failed = ['rejected', 'failed'].includes(subscriptionState);

    console.log('↩️ Mercado Pago return processed:', {
      checkout_session_id: checkoutSession.id,
      environment: billingEnvironment,
      provider_subscription_id: finalProviderSubscriptionId || null,
      provider_status: subscriptionState,
      local_subscription_status: syncedSubscriptionState || null,
      completed,
      cancelled,
      failed,
    });

    await supabase
      .from('subscription_checkout_sessions')
      .update({
        provider_subscription_id: finalProviderSubscriptionId || checkoutSession.provider_subscription_id || null,
        provider_status: subscriptionState || checkoutSession.provider_status || null,
        provider_metadata: synced?.providerSubscription || checkoutSession.provider_metadata || {},
        status: completed
          ? 'completed'
          : cancelled
            ? 'cancelled'
            : failed
              ? 'failed'
              : 'returned',
        last_synced_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : checkoutSession.completed_at,
      })
      .eq('id', checkoutSession.id);

    const fallbackReturnUrl = normalizeUrl(application.domain) || normalizeUrl((application.metadata || {}).callback_url) || '';
    const redirectTarget = normalizeUrl(checkoutSession.return_url) || fallbackReturnUrl;

    if (!redirectTarget) {
      return htmlResponse('La suscripcion fue procesada, pero no encontramos una URL valida para redirigirte.', 200);
    }

    const redirectUrl = buildRedirectUrl(redirectTarget, {
      subscription_state: syncedSubscriptionState || (completed ? 'active' : subscriptionState || 'pending'),
      checkout_session_id: checkoutSession.id,
      plan_id: checkoutSession.application_plan_id,
      provider: 'mercadopago',
      provider_subscription_id: finalProviderSubscriptionId || undefined,
    });

    return redirectResponse(redirectUrl);
  } catch (error: any) {
    console.error('mercadopago-return error:', error);
    return htmlResponse(error?.message || 'Ocurrio un error procesando el retorno de Mercado Pago.', 500);
  }
});
