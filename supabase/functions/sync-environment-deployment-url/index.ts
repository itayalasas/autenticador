import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-deploy-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeUrl(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function generateApiKey(environmentName: string): string {
  const chars = 'abcdef0123456789';
  let result = `ak_${environmentName}_`;
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function resolveEnvironmentApiKey(
  supabase: ReturnType<typeof createClient>,
  applicationId: string,
  environmentName: string
) {
  const { data: existingKeys, error: existingKeysError } = await supabase
    .from('api_keys')
    .select('id, key_hash, key_preview')
    .eq('application_id', applicationId)
    .eq('environment', environmentName)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingKeysError) {
    throw new Error(`No se pudo consultar la API Key del ambiente: ${existingKeysError.message}`);
  }

  const existingKey = existingKeys?.[0];
  if (existingKey?.key_hash) {
    return {
      apiKey: String(existingKey.key_hash),
      keyPreview: String(existingKey.key_preview || '')
    };
  }

  const apiKey = generateApiKey(environmentName);
  const keyPreview = `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 6)}`;

  const { error: insertKeyError } = await supabase
    .from('api_keys')
    .insert({
      application_id: applicationId,
      name: `${environmentName.charAt(0).toUpperCase() + environmentName.slice(1)} Environment Key`,
      key_hash: apiKey,
      key_preview: keyPreview,
      permissions: ['read', 'write'],
      environment: environmentName,
      is_active: true
    });

  if (insertKeyError) {
    throw new Error(`No se pudo crear la API Key del ambiente: ${insertKeyError.message}`);
  }

  return { apiKey, keyPreview };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const deployToken = req.headers.get('x-deploy-token')?.trim();
    if (!deployToken) {
      return jsonResponse({
        success: false,
        error: {
          code: 'MISSING_DEPLOY_TOKEN',
          message: 'x-deploy-token es requerido',
        },
      }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const environmentId = String(payload?.environment_id || '').trim();
    const deployedBaseUrl = normalizeUrl(payload?.deployed_base_url);
    const deploymentProvider = String(payload?.deployment_provider || 'azure_container_apps').trim();
    const deployedCallbackUrl = normalizeUrl(payload?.deployed_callback_url);
    const azureContainerAppName = String(payload?.azure_container_app_name || '').trim() || null;
    const azureContainerAppsEnvironment = String(payload?.azure_containerapps_environment || '').trim() || null;

    if (!environmentId || !deployedBaseUrl) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'environment_id y deployed_base_url son requeridos',
        },
      }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: environment, error: environmentError } = await supabase
      .from('environments')
      .select('*')
      .eq('id', environmentId)
      .single();

    if (environmentError || !environment) {
      return jsonResponse({
        success: false,
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: 'No se encontró el ambiente indicado',
          detail: environmentError?.message,
        },
      }, 404);
    }

    const expectedToken = String(environment.metadata?.deploy_callback_token || '').trim();
    const previousTokens = Array.isArray(environment.metadata?.deploy_callback_previous_tokens)
      ? environment.metadata.deploy_callback_previous_tokens
          .filter((token: unknown) => typeof token === 'string' && token.trim().length > 0)
          .map((token: string) => token.trim())
      : [];
    const acceptedTokens = [expectedToken, ...previousTokens].filter(Boolean);
    const tokenMatches = acceptedTokens.includes(deployToken);

    if (!tokenMatches) {
      console.warn('sync-environment-deployment-url token mismatch', {
        environmentId,
        hasExpectedToken: Boolean(expectedToken),
        expectedTokenPreview: expectedToken ? `${expectedToken.slice(0, 6)}...${expectedToken.slice(-6)}` : null,
        receivedTokenPreview: deployToken ? `${deployToken.slice(0, 6)}...${deployToken.slice(-6)}` : null,
        expectedLength: expectedToken.length,
        receivedLength: deployToken.length,
        acceptedTokenCount: acceptedTokens.length,
      });
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_DEPLOY_TOKEN',
          message: 'El token de callback no coincide con el ambiente',
        },
      }, 403);
    }

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', environment.application_id)
      .single();

    if (applicationError || !application) {
      return jsonResponse({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'No se encontró la aplicación asociada al ambiente',
          detail: applicationError?.message,
        },
      }, 404);
    }

    const environmentKey = String(environment.name || '').toLowerCase();
    const callbackUrl = deployedCallbackUrl
      || normalizeUrl(environment.callback_url)
      || normalizeUrl(application.metadata?.environment_urls?.[environmentKey]?.callback_url)
      || normalizeUrl(`https://${application.domain}/callback`);

    const { apiKey, keyPreview } = await resolveEnvironmentApiKey(
      supabase,
      String(application.id),
      String(environment.name || '').toLowerCase()
    );
    const externalApplicationId = String(application.application_id || '').trim();
    const redirectUri = encodeURIComponent(callbackUrl);
    const querySuffix = apiKey
      ? `?app_id=${externalApplicationId}&redirect_uri=${redirectUri}&api_key=${apiKey}`
      : `?app_id=${externalApplicationId}&redirect_uri=${redirectUri}`;

    const deployedUrls: Record<string, any> = {
      base_url: deployedBaseUrl,
      callback_url: callbackUrl,
      login_url: `${deployedBaseUrl}/login${querySuffix}`,
      register_url: `${deployedBaseUrl}/register${querySuffix}`,
      reset_password_url: `${deployedBaseUrl}/reset-password${querySuffix}`,
      deployed_at: new Date().toISOString(),
      deployment_provider: deploymentProvider,
    };

    if (application.auth_mode === 'tenant') {
      deployedUrls.register_tenant_url = `${deployedBaseUrl}/register-tenant${querySuffix}`;
    }

    const updatedEnvironmentMetadata = {
      ...(environment.metadata || {}),
      deployment_status: 'deployed',
      deployment_provider: deploymentProvider,
      last_deploy: new Date().toISOString(),
      last_deployed_base_url: deployedBaseUrl,
      api_key: apiKey,
      api_key_preview: keyPreview,
      deployed_urls: deployedUrls,
      ...(azureContainerAppName ? { azure_container_app_name: azureContainerAppName } : {}),
      ...(azureContainerAppsEnvironment ? { azure_containerapps_environment: azureContainerAppsEnvironment } : {}),
    };

    const { error: updateEnvironmentError } = await supabase
      .from('environments')
      .update({
        auth_url: deployedBaseUrl,
        callback_url: callbackUrl,
        metadata: updatedEnvironmentMetadata,
      })
      .eq('id', environmentId);

    if (updateEnvironmentError) {
      return jsonResponse({
        success: false,
        error: {
          code: 'ENVIRONMENT_UPDATE_FAILED',
          message: 'No se pudo actualizar el ambiente con la URL desplegada',
          detail: updateEnvironmentError.message,
        },
      }, 500);
    }

    const updatedApplicationMetadata = {
      ...(application.metadata || {}),
      environment_urls: {
        ...(application.metadata?.environment_urls || {}),
        [environmentKey]: {
          ...(application.metadata?.environment_urls?.[environmentKey] || {}),
          ...deployedUrls,
        },
      },
    };

    const { error: updateApplicationError } = await supabase
      .from('applications')
      .update({
        metadata: updatedApplicationMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id);

    if (updateApplicationError) {
      return jsonResponse({
        success: false,
        error: {
          code: 'APPLICATION_UPDATE_FAILED',
          message: 'Se actualizó el ambiente pero no la metadata de la aplicación',
          detail: updateApplicationError.message,
        },
      }, 500);
    }

    const { data: latestLog } = await supabase
      .from('deployment_logs')
      .select('id, metadata')
      .eq('environment_name', environment.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLog?.id) {
      await supabase
        .from('deployment_logs')
        .update({
          metadata: {
            ...(latestLog.metadata || {}),
            deployment_provider: deploymentProvider,
            deployed_urls: deployedUrls,
            synced_from_workflow_at: new Date().toISOString(),
          }
        })
        .eq('id', latestLog.id);
    }

    return jsonResponse({
      success: true,
      data: {
        environment_id: environmentId,
        base_url: deployedBaseUrl,
        callback_url: callbackUrl,
        deployed_urls: deployedUrls,
      },
    });
  } catch (error: any) {
    console.error('sync-environment-deployment-url error:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor',
      },
    }, 500);
  }
});
