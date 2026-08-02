import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { creditWalletFromPayment } from '../_shared/wallet.ts';
import {
  mercadoPagoRequest,
  normalizeBillingEnvironmentName,
  normalizeMercadoPagoConfig,
} from '../_shared/mercadopago.ts';

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
    const checkoutSessionId = String(input.checkout_session_id || input.session_id || '').trim();

    if (!applicationId || !apiKey || !checkoutSessionId) {
      return jsonResponse({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'application_id, api_key y checkout_session_id son requeridos' },
      }, 400);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name, domain, billing_config')
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

    const { data: session, error: sessionError } = await supabase
      .from('wallet_topup_sessions')
      .select('*')
      .eq('id', checkoutSessionId)
      .eq('application_id', application.id)
      .maybeSingle();

    if (sessionError || !session) {
      return jsonResponse({
        success: false,
        error: { code: 'TOPUP_SESSION_NOT_FOUND', message: 'No encontramos la sesion de recarga solicitada' },
      }, 404);
    }

    let currentSession = session;

    if (!['completed', 'failed', 'cancelled'].includes(session.status)) {
      const billingEnvironment = normalizeBillingEnvironmentName(
        apiKeyData.environment || (session.metadata as Record<string, any>)?.billing_environment || null,
      );
      const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {}, billingEnvironment);

      if (billingConfig.accessToken) {
        try {
          const searchResult = await mercadoPagoRequest(
            billingConfig,
            'GET',
            '/v1/payments/search',
            { query: { external_reference: session.external_reference, sort: 'date_created', criteria: 'desc' } },
          );

          const payment = Array.isArray(searchResult?.results) ? searchResult.results[0] : null;

          if (payment) {
            const { session: syncedSession } = await creditWalletFromPayment({
              supabase,
              session,
              payment,
              applicationName: application.name,
              applicationDomain: application.domain,
            });
            currentSession = syncedSession as typeof session;
          }
        } catch (syncError) {
          console.error('wallet-topup-status sync error:', syncError);
        }
      }
    }

    const { data: wallet } = await supabase
      .from('wallet_balances')
      .select('balance, currency, updated_at')
      .eq('application_id', application.id)
      .eq(session.tenant_id ? 'tenant_id' : 'app_user_id', session.tenant_id || session.app_user_id)
      .maybeSingle();

    return jsonResponse({
      success: true,
      data: {
        checkout_session: {
          id: currentSession.id,
          status: currentSession.status,
          provider_status: currentSession.provider_status,
          amount: Number(currentSession.amount),
          currency: currentSession.currency,
          return_url: currentSession.return_url,
          completed_at: currentSession.completed_at,
          last_synced_at: currentSession.last_synced_at,
        },
        wallet: wallet
          ? { balance: Number(wallet.balance), currency: wallet.currency, updated_at: wallet.updated_at }
          : { balance: 0, currency: currentSession.currency, updated_at: null },
      },
    });
  } catch (error: any) {
    console.error('wallet-topup-status error:', error);
    return jsonResponse({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error interno del servidor' },
    }, 500);
  }
});
