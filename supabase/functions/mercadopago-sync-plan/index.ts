import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import {
  buildPlanProviderUpdatePayload,
  buildMercadoPagoPlanPayload,
  MercadoPagoApiError,
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header requerido',
        },
      }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return jsonResponse({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token invalido o expirado',
        },
      }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const planId = String(body?.application_plan_id || '').trim();
    const requestedEnvironment = normalizeBillingEnvironmentName(body?.environment || null);
    if (!planId) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'application_plan_id es requerido',
        },
      }, 400);
    }

    const { data: plan, error: planError } = await supabase
      .from('application_billing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return jsonResponse({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Plan no encontrado',
        },
      }, 404);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('id, owner_id, billing_config')
      .eq('id', plan.application_id)
      .single();

    if (applicationError || !application) {
      return jsonResponse({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Aplicacion no encontrada',
        },
      }, 404);
    }

    if (application.owner_id !== userData.user.id) {
      return jsonResponse({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para sincronizar este plan',
        },
      }, 403);
    }

    const billingConfig = normalizeMercadoPagoConfig(application.billing_config || {}, requestedEnvironment);
    if (!billingConfig.enabled) {
      return jsonResponse({
        success: false,
        error: {
          code: 'BILLING_DISABLED',
          message: 'La facturacion interna no esta habilitada para esta aplicacion',
        },
      }, 422);
    }

    if (!billingConfig.accessToken) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MERCADOPAGO_CONFIG_MISSING',
          message: 'Falta configurar el access token de Mercado Pago',
        },
      }, 422);
    }

    const backUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/mercadopago-return`;
    const payload = buildMercadoPagoPlanPayload(plan, backUrl);

    const providerPlanId = requestedEnvironment
      ? String(plan?.metadata?.provider_by_environment?.[requestedEnvironment]?.provider_plan_id || '').trim() || null
      : (plan.provider_plan_id || null);
    let providerResponse: any = null;
    let recreatedProviderPlan = false;

    if (providerPlanId) {
      try {
        providerResponse = await mercadoPagoRequest(
          billingConfig,
          'PUT',
          `/preapproval_plan/${providerPlanId}`,
          { body: payload },
        );
      } catch (error) {
        if (error instanceof MercadoPagoApiError && error.status === 404) {
          console.warn(
            'mercadopago-sync-plan: provider_plan_id no existe con las credenciales actuales, recreando plan',
            {
              applicationPlanId: planId,
              previousProviderPlanId: providerPlanId,
            },
          );

          providerResponse = await mercadoPagoRequest(
            billingConfig,
            'POST',
            '/preapproval_plan',
            { body: payload },
          );
          recreatedProviderPlan = true;
        } else {
          throw error;
        }
      }
    } else {
      providerResponse = await mercadoPagoRequest(
        billingConfig,
        'POST',
        '/preapproval_plan',
        { body: payload },
      );
    }

    const nextProviderMetadata = {
      ...(providerResponse || {}),
      authsystem_sync: {
        recreated_provider_plan: recreatedProviderPlan,
        previous_provider_plan_id: recreatedProviderPlan ? providerPlanId : null,
        synced_at: new Date().toISOString(),
        environment: requestedEnvironment,
      },
    };

    const environmentAwareProviderPayload = buildPlanProviderUpdatePayload({
      plan,
      providerResponse: nextProviderMetadata,
      environmentName: requestedEnvironment,
      provider: 'mercadopago',
    });

    const updatePayload = {
      ...environmentAwareProviderPayload,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPlan, error: updateError } = await supabase
      .from('application_billing_plans')
      .update(updatePayload)
      .eq('id', planId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      data: {
        plan: updatedPlan,
        mercado_pago: {
          id: providerResponse.id || null,
          status: providerResponse.status || null,
          init_point: providerResponse.init_point || null,
          environment: requestedEnvironment,
          recreated_provider_plan: recreatedProviderPlan,
          previous_provider_plan_id: recreatedProviderPlan ? providerPlanId : null,
        },
      },
    });
  } catch (error: any) {
    console.error('mercadopago-sync-plan error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
