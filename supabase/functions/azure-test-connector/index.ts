import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface AzureConnectorPayload {
  tenant_id: string;
  subscription_id: string;
  client_id: string;
  client_secret: string;
  resource_group?: string;
  location?: string;
  containerapps_environment?: string;
}

function extractGuid(value: string | undefined | null): string {
  const normalizedValue = String(value || '').trim();
  const match = normalizedValue.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return match ? match[0] : normalizedValue;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePayload(payload: AzureConnectorPayload): AzureConnectorPayload {
  return {
    tenant_id: extractGuid(payload?.tenant_id),
    subscription_id: extractGuid(payload?.subscription_id),
    client_id: extractGuid(payload?.client_id),
    client_secret: String(payload?.client_secret || '').trim(),
    resource_group: String(payload?.resource_group || '').trim() || undefined,
    location: String(payload?.location || '').trim() || undefined,
    containerapps_environment: String(payload?.containerapps_environment || '').trim() || undefined,
  };
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

    const rawPayload = await req.json().catch(() => ({}));
    const payload = normalizePayload(rawPayload as AzureConnectorPayload);

    if (!payload.tenant_id || !payload.subscription_id || !payload.client_id || !payload.client_secret) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'tenant_id, subscription_id, client_id y client_secret son requeridos',
        },
      }, 400);
    }

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${payload.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: payload.client_id,
        client_secret: payload.client_secret,
        scope: 'https://management.azure.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      return jsonResponse({
        success: false,
        error: {
          code: 'AZURE_INVALID_CREDENTIALS',
          message: 'Azure rechazo las credenciales del Service Principal',
          detail,
        },
      }, 400);
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = tokenPayload?.access_token;
    if (!accessToken) {
      return jsonResponse({
        success: false,
        error: {
          code: 'AZURE_TOKEN_MISSING',
          message: 'Azure no devolvio un access token valido',
        },
      }, 400);
    }

    if (payload.resource_group) {
      const rgResponse = await fetch(
        `https://management.azure.com/subscriptions/${payload.subscription_id}/resourcegroups/${encodeURIComponent(payload.resource_group)}?api-version=2021-04-01`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (rgResponse.status === 404) {
        return jsonResponse({
          success: false,
          error: {
            code: 'AZURE_RESOURCE_GROUP_NOT_FOUND',
            message: 'El Resource Group configurado no existe en la suscripcion indicada',
          },
        }, 400);
      }

      if (!rgResponse.ok) {
        const detail = await rgResponse.text();
        return jsonResponse({
          success: false,
          error: {
            code: 'AZURE_RESOURCE_GROUP_FORBIDDEN',
            message: 'No se pudo consultar el Resource Group configurado con este Service Principal',
            detail,
          },
        }, 400);
      }
    } else {
      const subscriptionResponse = await fetch(
        `https://management.azure.com/subscriptions/${payload.subscription_id}?api-version=2020-01-01`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!subscriptionResponse.ok) {
        const detail = await subscriptionResponse.text();
        return jsonResponse({
          success: false,
          error: {
            code: 'AZURE_SUBSCRIPTION_INVALID',
            message: 'No se pudo validar la suscripcion de Azure',
            detail,
          },
        }, 400);
      }
    }

    return jsonResponse({
      success: true,
      message: 'Azure Container Apps conectado correctamente',
      data: {
        subscription_id: payload.subscription_id,
        resource_group: payload.resource_group || null,
        containerapps_environment: payload.containerapps_environment || null,
      },
    });
  } catch (error: any) {
    console.error('azure-test-connector error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
