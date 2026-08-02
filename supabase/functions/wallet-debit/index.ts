import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { resolveScopedPlanEntitlements } from '../_shared/application-billing.ts';
import { normalizeBillingEnvironmentName } from '../_shared/mercadopago.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEBITABLE_FEATURE_CODES = new Set(['email_overage_price', 'pdf_overage_price']);

interface WalletDebitRequest {
  application_id: string;
  api_key: string;
  tenant_id?: string;
  app_user_id?: string;
  feature_code: string;
  quantity?: number;
  idempotency_key: string;
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

    const body = await req.json().catch(() => ({})) as WalletDebitRequest;
    const applicationId = String(body.application_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const tenantId = String(body.tenant_id || '').trim() || null;
    const appUserId = String(body.app_user_id || '').trim() || null;
    const featureCode = String(body.feature_code || '').trim();
    const quantity = Number(body.quantity ?? 1);
    const idempotencyKey = String(body.idempotency_key || '').trim();

    if (!applicationId || !apiKey || !featureCode || !idempotencyKey) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'application_id, api_key, feature_code e idempotency_key son requeridos',
        },
      }, 400);
    }

    if (!tenantId && !appUserId) {
      return jsonResponse({
        success: false,
        error: { code: 'MISSING_SCOPE', message: 'Debes enviar tenant_id o app_user_id' },
      }, 400);
    }

    if (!DEBITABLE_FEATURE_CODES.has(featureCode)) {
      return jsonResponse({
        success: false,
        error: { code: 'INVALID_FEATURE_CODE', message: `feature_code invalido: ${featureCode}` },
      }, 400);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return jsonResponse({
        success: false,
        error: { code: 'INVALID_QUANTITY', message: 'quantity debe ser mayor a 0' },
      }, 400);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, application_id, name')
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

    const { plan, entitlements } = await resolveScopedPlanEntitlements({
      supabase,
      application,
      tenantId,
      appUserId,
      environmentName: billingEnvironment,
    });

    const priceFeature = (entitlements.features || []).find((item) => item?.code === featureCode);
    const unitPrice = priceFeature ? Number(priceFeature.value) : 0;

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return jsonResponse({
        success: false,
        error: {
          code: 'OVERAGE_PRICING_NOT_CONFIGURED',
          message: `El plan no tiene configurado un precio de excedente para ${featureCode}`,
        },
      }, 422);
    }

    const amount = Math.round(unitPrice * quantity * 100) / 100;
    const currency = plan?.currency || 'UYU';

    const { data: transaction, error: rpcError } = await supabase.rpc('apply_wallet_transaction', {
      p_application_id: application.id,
      p_tenant_id: tenantId,
      p_app_user_id: appUserId,
      p_type: 'debit',
      p_amount: amount,
      p_currency: currency,
      p_reference: `wallet_debit:${featureCode}:${idempotencyKey}`,
      p_feature_code: featureCode,
      p_provider: 'internal_debit',
      p_provider_payment_id: idempotencyKey,
      p_metadata: {
        quantity,
        unit_price: unitPrice,
        plan_id: plan?.id || null,
        ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      },
    });

    if (rpcError) {
      if (String(rpcError.message || '').includes('insufficient_wallet_balance')) {
        const { data: wallet } = await supabase
          .from('wallet_balances')
          .select('balance, currency')
          .eq('application_id', application.id)
          .eq(tenantId ? 'tenant_id' : 'app_user_id', tenantId || appUserId)
          .maybeSingle();

        return jsonResponse({
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Saldo insuficiente en la billetera para cubrir el excedente',
          },
          data: {
            balance: wallet ? Number(wallet.balance) : 0,
            currency: wallet?.currency || currency,
            required_amount: amount,
          },
        }, 402);
      }

      throw rpcError;
    }

    return jsonResponse({
      success: true,
      data: {
        transaction_id: transaction?.id || null,
        amount,
        currency,
        quantity,
        unit_price: unitPrice,
        new_balance: transaction?.balance_after != null ? Number(transaction.balance_after) : null,
      },
    });
  } catch (error: any) {
    console.error('wallet-debit error:', error);
    return jsonResponse({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error interno del servidor' },
    }, 500);
  }
});
