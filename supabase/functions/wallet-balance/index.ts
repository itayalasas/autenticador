import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface WalletBalanceRequest {
  application_id: string;
  api_key: string;
  tenant_id?: string;
  app_user_id?: string;
  transactions_limit?: number;
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

    const body = await req.json().catch(() => ({})) as WalletBalanceRequest;
    const applicationId = String(body.application_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const tenantId = String(body.tenant_id || '').trim() || null;
    const appUserId = String(body.app_user_id || '').trim() || null;
    const transactionsLimit = Math.min(Math.max(Number(body.transactions_limit) || 20, 1), 100);

    if (!applicationId || !apiKey) {
      return jsonResponse({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'application_id y api_key son requeridos' },
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

    let walletQuery = supabase
      .from('wallet_balances')
      .select('*')
      .eq('application_id', application.id);

    walletQuery = tenantId
      ? walletQuery.eq('tenant_id', tenantId)
      : walletQuery.eq('app_user_id', appUserId).is('tenant_id', null);

    const { data: wallet, error: walletError } = await walletQuery.maybeSingle();

    if (walletError) {
      throw walletError;
    }

    if (!wallet) {
      return jsonResponse({
        success: true,
        data: {
          balance: 0,
          currency: 'UYU',
          wallet_id: null,
          recent_transactions: [],
        },
      });
    }

    const { data: transactions, error: transactionsError } = await supabase
      .from('wallet_transactions')
      .select('id, type, amount, currency, balance_after, reference, feature_code, status, created_at')
      .eq('wallet_balance_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(transactionsLimit);

    if (transactionsError) {
      throw transactionsError;
    }

    return jsonResponse({
      success: true,
      data: {
        balance: Number(wallet.balance),
        currency: wallet.currency,
        wallet_id: wallet.id,
        updated_at: wallet.updated_at,
        recent_transactions: transactions || [],
      },
    });
  } catch (error: any) {
    console.error('wallet-balance error:', error);
    return jsonResponse({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error?.message || 'Error interno del servidor' },
    }, 500);
  }
});
