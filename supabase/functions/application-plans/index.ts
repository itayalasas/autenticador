import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { buildAvailablePlan, getActivePlans, resolveApplicationBillingAccess } from '../_shared/application-billing.ts';
import { normalizeMercadoPagoConfig } from '../_shared/mercadopago.ts';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input = req.method === 'GET'
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await req.json().catch(() => ({}));

    const applicationId = String(input.application_id || '').trim();
    const apiKey = String(input.api_key || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const tenantId = String(input.tenant_id || '').trim() || null;

    if (!applicationId || !apiKey) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'application_id and api_key are required',
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

    let billingState = null;
    if (email) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('id, email, metadata, tenant_id')
        .eq('application_id', application.id)
        .eq('email', email)
        .maybeSingle();

      if (appUser) {
        billingState = await resolveApplicationBillingAccess({
          supabase,
          application,
          appUser,
          tenantId: tenantId || appUser.tenant_id || null,
        });
      }
    }

    if (!billingState) {
      const plans = await getActivePlans(supabase, application.id);
      const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {});

      billingState = {
        enabled: Boolean(application.billing_config?.enabled),
        success: true,
        has_access: true,
        available_plans: plans.map((plan: any) => buildAvailablePlan(plan, { backUrl: billingConfig.backUrl || null })),
        subscription: null,
        license: {
          source: 'internal',
          status: 'not_resolved',
          provider: 'mercadopago',
        },
      };
    }

    return jsonResponse({
      success: true,
      data: {
        application: {
          id: application.application_id,
          name: application.name,
          auth_mode: application.auth_mode,
        },
        checkout: {
          provider: 'mercadopago',
          managed_by_authsystem: true,
          start_endpoint: '/functions/v1/subscription-start-checkout',
          status_endpoint: '/functions/v1/subscription-checkout-status',
        },
        has_access: billingState.has_access,
        subscription: billingState.subscription,
        license: billingState.license,
        available_plans: billingState.available_plans,
      },
    });
  } catch (error: any) {
    console.error('application-plans error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
