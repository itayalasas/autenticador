// Logica compartida de billetera: aplicar el resultado de un pago de
// Mercado Pago a una sesion de recarga (wallet_topup_sessions), usada tanto
// por el webhook como por el endpoint de status/polling para que ambos
// caminos terminen en el mismo lugar y la idempotencia (via
// apply_wallet_transaction) los proteja de acreditar dos veces.

import { resolveScopedPlanEntitlements } from './application-billing.ts';
import { normalizeUrl } from './application-auth-url.ts';
import { resolveConfiguredValue, sendTemplatedEmail } from './email-notifications.ts';

export interface WalletTopupSessionRecord {
  id: string;
  application_id: string;
  tenant_id: string | null;
  app_user_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
  provider: string;
  provider_payment_id: string | null;
  provider_metadata: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  payer_email?: string | null;
}

// Notifica la recarga acreditada mandando un email via el mismo API de
// email externo que ya usan auth-reset-password/verify-email (EMAIL_API_URL
// + EMAIL_API_KEY, con fallback a EXTERNAL_EMAIL_API_URL/KEY) en vez de
// inventar secrets nuevos. Falla en silencio: un error de notificacion nunca
// debe tirar abajo la acreditacion del saldo, que ya quedo aplicada en la
// base cuando esto corre.
async function notifyWalletTopupSuccess(params: {
  supabase: any;
  session: WalletTopupSessionRecord;
  transaction: Record<string, any>;
  applicationName?: string | null;
  applicationDomain?: string | null;
}) {
  const { supabase, session, transaction, applicationName, applicationDomain } = params;
  const recipientEmail = String(session.payer_email || '').trim();
  if (!recipientEmail) {
    console.warn('wallet_topup_success: sin recipientEmail, no se notifica', { session_id: session.id });
    return;
  }

  // El dominio de la aplicacion (applications.domain) es dinamico por
  // aplicacion, a diferencia de hardcodear "sendcraft.net" en el template.
  const normalizedDomain = normalizeUrl(applicationDomain || '');
  const dashboardUrl = normalizedDomain ? `${normalizedDomain}/dashboard` : null;

  const apiUrl = resolveConfiguredValue<string>([
    { source: 'env.EMAIL_API_URL', value: Deno.env.get('EMAIL_API_URL') },
    { source: 'env.EXTERNAL_EMAIL_API_URL', value: Deno.env.get('EXTERNAL_EMAIL_API_URL') },
  ]);
  const apiKey = resolveConfiguredValue<string>([
    { source: 'env.EMAIL_API_KEY', value: Deno.env.get('EMAIL_API_KEY') },
    { source: 'env.EXTERNAL_EMAIL_API_KEY', value: Deno.env.get('EXTERNAL_EMAIL_API_KEY') },
  ]);

  if (!apiUrl.value || !apiKey.value) {
    console.warn('wallet_topup_success: falta EMAIL_API_URL o EMAIL_API_KEY, no se notifica', {
      has_api_url: Boolean(apiUrl.value),
      has_api_key: Boolean(apiKey.value),
    });
    return;
  }

  let planName: string | null = null;
  try {
    const { plan } = await resolveScopedPlanEntitlements({
      supabase,
      application: { id: session.application_id },
      tenantId: session.tenant_id,
      appUserId: session.app_user_id,
    });
    planName = plan?.name || null;
  } catch {
    // El nombre del plan es solo contexto para el email; si no se puede
    // resolver seguimos sin el, no vale la pena bloquear la notificacion.
  }

  try {
    await sendTemplatedEmail({
      apiUrl: apiUrl.value,
      apiKey: apiKey.value,
      templateName: 'wallet_topup_success',
      recipientEmail,
      data: {
        application_name: applicationName || 'SendCraft',
        plan_name: planName,
        amount: Number(session.amount),
        currency: session.currency,
        new_balance: transaction?.balance_after != null ? Number(transaction.balance_after) : null,
        topup_date: new Date().toISOString(),
        topup_date_formatted: new Date().toLocaleDateString('es-UY', {
          year: 'numeric', month: 'long', day: 'numeric',
        }),
        dashboard_url: dashboardUrl,
      },
    });

    console.log('wallet_topup_success: email notificado');
  } catch (error) {
    console.warn('wallet_topup_success: no se pudo notificar la recarga por email', error);
  }
}

function mapMercadoPagoPaymentStatus(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'approved':
      return 'completed';
    case 'rejected':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'failed';
    default:
      return 'pending';
  }
}

export async function creditWalletFromPayment(params: {
  supabase: any;
  session: WalletTopupSessionRecord;
  payment: Record<string, any>;
  applicationName?: string | null;
  applicationDomain?: string | null;
}): Promise<{ session: Record<string, any>; transaction: Record<string, any> | null }> {
  const { supabase, session, payment, applicationName, applicationDomain } = params;

  if (['completed', 'failed', 'cancelled'].includes(session.status)) {
    return { session, transaction: null };
  }

  const paymentId = String(payment?.id || '').trim();
  const providerStatus = String(payment?.status || '').trim().toLowerCase();
  const mappedStatus = mapMercadoPagoPaymentStatus(providerStatus);
  const nowIso = new Date().toISOString();

  let transaction: Record<string, any> | null = null;

  if (mappedStatus === 'completed' && paymentId) {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('apply_wallet_transaction', {
      p_application_id: session.application_id,
      p_tenant_id: session.tenant_id,
      p_app_user_id: session.app_user_id,
      p_type: 'topup',
      p_amount: Number(session.amount),
      p_currency: session.currency,
      p_reference: `wallet_topup_session:${session.id}`,
      p_feature_code: null,
      p_provider: session.provider || 'mercadopago',
      p_provider_payment_id: paymentId,
      p_metadata: { wallet_topup_session_id: session.id, payment_id: paymentId },
    });

    if (rpcError) {
      throw rpcError;
    }

    transaction = rpcResult || null;

    if (transaction) {
      // Se espera (no fire-and-forget): el runtime de Edge Functions puede
      // terminar la ejecucion apenas el handler devuelve la respuesta HTTP,
      // matando cualquier promesa que haya quedado corriendo sin esperar.
      await notifyWalletTopupSuccess({ supabase, session, transaction, applicationName, applicationDomain });
    }
  }

  const { data: updatedSession } = await supabase
    .from('wallet_topup_sessions')
    .update({
      provider_payment_id: paymentId || session.provider_payment_id,
      provider_status: providerStatus || null,
      provider_metadata: payment || session.provider_metadata || {},
      status: mappedStatus === 'pending' ? session.status : mappedStatus,
      last_synced_at: nowIso,
      completed_at: mappedStatus === 'completed' ? nowIso : null,
    })
    .eq('id', session.id)
    .select('*')
    .maybeSingle();

  return { session: updatedSession || session, transaction };
}
