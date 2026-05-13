import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { syncMercadoPagoSubscriptionById } from '../_shared/application-billing.ts';
import { normalizeMercadoPagoConfig } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseSignature(rawHeader: string | null) {
  const result: Record<string, string> = {};
  for (const part of String(rawHeader || '').split(',')) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    result[key.trim()] = value.trim();
  }
  return {
    ts: result.ts || '',
    v1: result.v1 || '',
  };
}

async function computeHmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyWebhookSignature(params: {
  secret: string;
  request: Request;
  dataId: string;
}) {
  const { secret, request, dataId } = params;
  if (!secret) return true;

  const { ts, v1 } = parseSignature(request.headers.get('x-signature'));
  const requestId = request.headers.get('x-request-id') || '';
  if (!ts || !v1 || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = await computeHmacSha256Hex(secret, manifest);
  return expected === v1;
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

    const topic = String(
      url.searchParams.get('topic') ||
      (body as any).topic ||
      (body as any).type ||
      ''
    ).trim().toLowerCase();

    const dataId = String(
      url.searchParams.get('data.id') ||
      (body as any)?.data?.id ||
      (body as any)?.id ||
      ''
    ).trim();

    if (!dataId) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_DATA_ID',
          message: 'No se encontro data.id en la notificacion',
        },
      }, 400);
    }

    const { data: checkoutSession } = await supabase
      .from('subscription_checkout_sessions')
      .select('id, application_id, application_plan_id, tenant_id, app_user_id, payer_email, provider_subscription_id')
      .eq('provider_subscription_id', dataId)
      .maybeSingle();

    const { data: storedSubscription } = await supabase
      .from('application_plan_subscriptions')
      .select('id, application_id, application_plan_id, tenant_id, app_user_id, payer_email')
      .eq('provider', 'mercadopago')
      .eq('provider_subscription_id', dataId)
      .maybeSingle();

    const applicationInternalId = checkoutSession?.application_id || storedSubscription?.application_id || null;
    if (!applicationInternalId) {
      return jsonResponse({
        success: true,
        data: {
          ignored: true,
          reason: 'No encontramos una sesion o suscripcion local asociada a ese preapproval',
          topic,
          data_id: dataId,
        },
      }, 202);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, billing_config')
      .eq('id', applicationInternalId)
      .maybeSingle();

    if (applicationError || !application) {
      return jsonResponse({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'No encontramos la aplicacion de la notificacion',
        },
      }, 404);
    }

    const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {});
    const signatureValid = await verifyWebhookSignature({
      secret: billingConfig.webhookSecret,
      request: req,
      dataId,
    });

    if (billingConfig.webhookSecret && !signatureValid) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'La firma del webhook de Mercado Pago no es valida',
        },
      }, 401);
    }

    const synced = await syncMercadoPagoSubscriptionById({
      supabase,
      application,
      providerSubscriptionId: dataId,
      selectedPlanId: checkoutSession?.application_plan_id || storedSubscription?.application_plan_id || null,
      tenantId: checkoutSession?.tenant_id || storedSubscription?.tenant_id || null,
      appUserId: checkoutSession?.app_user_id || storedSubscription?.app_user_id || null,
      payerEmail: checkoutSession?.payer_email || storedSubscription?.payer_email || null,
      source: 'mercadopago_webhook',
    });

    if (checkoutSession?.id) {
      const providerStatus = String(synced?.providerSubscription?.status || '').trim().toLowerCase();
      await supabase
        .from('subscription_checkout_sessions')
        .update({
          provider_status: providerStatus || null,
          provider_subscription_id: dataId,
          provider_metadata: synced?.providerSubscription || {},
          status: ['authorized', 'active'].includes(providerStatus)
            ? 'completed'
            : ['cancelled', 'canceled'].includes(providerStatus)
              ? 'cancelled'
              : providerStatus === 'rejected'
                ? 'failed'
                : 'returned',
          last_synced_at: new Date().toISOString(),
          completed_at: ['authorized', 'active'].includes(providerStatus)
            ? new Date().toISOString()
            : null,
        })
        .eq('id', checkoutSession.id);
    }

    return jsonResponse({
      success: true,
      data: {
        topic,
        data_id: dataId,
        signature_valid: billingConfig.webhookSecret ? signatureValid : null,
        subscription_status: synced?.providerSubscription?.status || null,
      },
    });
  } catch (error: any) {
    console.error('mercadopago-webhook error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
