import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { normalizeUrl } from '../_shared/application-auth-url.ts';
import { resolveTrustedBillingReturnUrl } from '../_shared/billing-return-url.ts';
import {
  mercadoPagoRequest,
  normalizeBillingEnvironmentName,
  normalizeMercadoPagoConfig,
} from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface TopupCheckoutRequest {
  application_id: string;
  api_key: string;
  amount: number;
  currency?: string;
  return_url?: string;
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
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' },
      }, 405);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json().catch(() => ({})) as TopupCheckoutRequest;
    const applicationId = String(body.application_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const amount = Number(body.amount);
    const currency = String(body.currency || '').trim();
    const returnUrl = String(body.return_url || '').trim();
    const payerEmail = String(body.email || '').trim().toLowerCase() || null;
    const tenantId = String(body.tenant_id || '').trim() || null;
    const appUserId = String(body.app_user_id || '').trim() || null;

    if (!applicationId || !apiKey || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'application_id, api_key y amount (mayor a 0) son requeridos' },
      }, 400);
    }

    if (!tenantId && !appUserId) {
      return jsonResponse({
        success: false,
        error: { code: 'MISSING_SCOPE', message: 'Debes enviar tenant_id o app_user_id' },
      }, 400);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, metadata, billing_config')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      return jsonResponse({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicacion no encontrada' },
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
        error: { code: 'INVALID_API_KEY', message: 'API Key invalida o inactiva' },
      }, 401);
    }

    if (apiKeyData.application_id !== application.id) {
      return jsonResponse({
        success: false,
        error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicacion' },
      }, 403);
    }

    const billingEnvironment = normalizeBillingEnvironmentName(apiKeyData.environment || null);
    const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {}, billingEnvironment);

    if (!billingConfig.enabled) {
      return jsonResponse({
        success: false,
        error: { code: 'BILLING_DISABLED', message: 'La facturacion interna no esta habilitada para esta aplicacion' },
      }, 422);
    }

    if (!billingConfig.accessToken) {
      return jsonResponse({
        success: false,
        error: { code: 'MERCADOPAGO_CONFIG_MISSING', message: 'Falta configurar el access token de Mercado Pago' },
      }, 422);
    }

    const requestedReturnUrl = returnUrl || billingConfig.backUrl || '';
    const trustedReturnUrl = await resolveTrustedBillingReturnUrl(supabase, application, requestedReturnUrl);
    if (!trustedReturnUrl) {
      return jsonResponse({
        success: false,
        error: { code: 'INVALID_RETURN_URL', message: 'La URL de retorno no esta autorizada para esta aplicacion' },
      }, 422);
    }

    const resolvedCurrency = currency || 'UYU';

    const sessionId = crypto.randomUUID();
    const externalReference = `wallet_topup:${sessionId}`;
    const sessionMetadata = {
      source: 'authsystem_wallet_topup',
      requested_return_url: trustedReturnUrl,
      billing_environment: billingEnvironment,
      ...((body.metadata && typeof body.metadata === 'object') ? body.metadata : {}),
    };

    const { data: topupSession, error: topupSessionError } = await supabase
      .from('wallet_topup_sessions')
      .insert({
        id: sessionId,
        application_id: application.id,
        tenant_id: tenantId,
        app_user_id: appUserId,
        payer_email: payerEmail,
        amount,
        currency: resolvedCurrency,
        provider: 'mercadopago',
        external_reference: externalReference,
        return_url: trustedReturnUrl,
        status: 'pending',
        metadata: sessionMetadata,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (topupSessionError || !topupSession) {
      console.error('wallet-topup-checkout session error:', topupSessionError);
      return jsonResponse({
        success: false,
        error: { code: 'TOPUP_SESSION_ERROR', message: 'No se pudo crear la sesion de recarga' },
      }, 500);
    }

    const supabaseUrl = normalizeUrl(Deno.env.get('SUPABASE_URL') || '');
    // El topic "payment" solo trae el id del pago, no alcanza para saber que
    // credenciales de Mercado Pago usar para consultarlo (cada aplicacion
    // tiene su propia cuenta). Identificamos la app por query param aca
    // mismo para que el webhook pueda resolverla antes de llamar a MP.
    const notificationUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/mercadopago-webhook?app=${encodeURIComponent(application.application_id)}&env=${encodeURIComponent(billingEnvironment || '')}`
      : undefined;

    // Mercado Pago exige que back_urls.success sea una URL https publica
    // cuando se manda auto_return; si el retorno es http (por ej. desarrollo
    // local contra la API productiva) rechaza la creacion de la preferencia
    // entera con "auto_return invalid. back_url.success must be defined".
    // Omitimos auto_return en ese caso: el checkout igual funciona, solo que
    // el usuario tiene que volver con el boton en vez de la redireccion automatica.
    const canAutoReturn = trustedReturnUrl.toLowerCase().startsWith('https://');

    const preferencePayload = {
      items: [
        {
          title: `Recarga de saldo - ${application.name}`,
          quantity: 1,
          unit_price: amount,
          currency_id: resolvedCurrency,
        },
      ],
      external_reference: externalReference,
      back_urls: {
        success: trustedReturnUrl,
        failure: trustedReturnUrl,
        pending: trustedReturnUrl,
      },
      ...(canAutoReturn ? { auto_return: 'approved' } : {}),
      notification_url: notificationUrl,
      // Solo precargamos el email del comprador en produccion. En sandbox,
      // mandar el email real de una cuenta real dentro de una preferencia
      // creada con credenciales TEST- puede confundir a Mercado Pago sobre
      // si el pago es "real" o "de prueba" y dispara el rechazo generico
      // "una de las partes con la que intentas hacer el pago es de prueba".
      // Dejamos que el checkout lo pida directamente cuando no es produccion.
      payer: payerEmail && billingEnvironment === 'production' ? { email: payerEmail } : undefined,
      metadata: {
        wallet_topup_session_id: sessionId,
        application_id: application.id,
        tenant_id: tenantId,
        app_user_id: appUserId,
      },
    };

    const providerResponse = await mercadoPagoRequest(
      billingConfig,
      'POST',
      '/checkout/preferences',
      { body: preferencePayload },
    );

    console.log('💰 Wallet topup checkout created:', {
      topup_session_id: sessionId,
      environment: billingEnvironment,
      amount,
      currency: resolvedCurrency,
      preference_id: providerResponse?.id || null,
    });

    await supabase
      .from('wallet_topup_sessions')
      .update({
        provider_preference_id: providerResponse?.id || null,
        provider_checkout_url: providerResponse?.init_point || null,
        provider_status: 'created',
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
        amount,
        currency: resolvedCurrency,
        environment: billingEnvironment,
      },
    });
  } catch (error: any) {
    console.error('wallet-topup-checkout error:', error);
    return jsonResponse({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error interno del servidor' },
    }, 500);
  }
});
