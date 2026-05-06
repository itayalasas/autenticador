import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RegisterTenantRequest {
  application_id: string;
  api_key: string;
  name: string;
  slug?: string;
  domain?: string;
  plan_id?: string;
  metadata?: Record<string, any>;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: RegisterTenantRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { application_id, api_key, name, slug, domain, plan_id, metadata } = body;

    if (!application_id || !api_key || !name) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'application_id, api_key and name are required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_API_KEY', message: 'API Key inválida o inactiva' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name, domain, auth_mode, application_id, metadata')
      .eq('application_id', application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key belongs to this application
    if (apiKeyData.application_id !== application.id) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicación' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify application is in tenant mode
    if (application.auth_mode !== 'tenant') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_MODE_MISMATCH',
            message: 'Esta aplicación no tiene habilitado el modo de autenticación por tenant. Configura auth_mode=tenant en el dashboard.'
          }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantSlug = slug || generateSlug(name);

    // Check slug uniqueness within this application
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('application_id', application.id)
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (existingTenant) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TENANT_ALREADY_EXISTS',
            message: `Ya existe un tenant con el identificador "${tenantSlug}" en esta aplicación`
          }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantMetadata: Record<string, any> = { ...(metadata || {}) };
    if (plan_id) tenantMetadata.plan_id = plan_id;

    // Create the tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        application_id: application.id,
        name,
        slug: tenantSlug,
        domain: domain || null,
        status: 'active',
        metadata: tenantMetadata
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      return new Response(
        JSON.stringify({ success: false, error: { code: 'DATABASE_ERROR', message: 'Error al crear el tenant', details: tenantError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trigger subscription auto-sync (activate-trial) if enabled for this application
    let subscriptionSync: { attempted: boolean; success: boolean; error?: string } = {
      attempted: false,
      success: false,
    };

    const appMeta = (application.metadata || {}) as Record<string, any>;
    const syncEnabled = appMeta.subscription_sync_enabled === true;
    const syncApiKey = appMeta.subscription_sync_api_key as string | undefined;
    const syncPlanId = (plan_id as string | undefined) || (appMeta.subscription_sync_plan_id as string | undefined);

    if (syncEnabled && syncApiKey && syncPlanId) {
      subscriptionSync.attempted = true;
      try {
        const trialRes = await fetch(
          'https://veymthufmfqhxxxzfmfi.supabase.co/functions/v1/admin-api/activate-trial',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': syncApiKey,
            },
            body: JSON.stringify({
              application_id: application_id,
              plan_id: syncPlanId,
              tenant_id: tenant.id,
            }),
          }
        );

        if (trialRes.ok) {
          subscriptionSync.success = true;
        } else {
          const errText = await trialRes.text();
          subscriptionSync.error = `HTTP ${trialRes.status}: ${errText}`;
          console.error('activate-trial failed:', subscriptionSync.error);
        }
      } catch (syncError: any) {
        subscriptionSync.error = syncError?.message || 'Unknown error';
        console.error('activate-trial exception:', syncError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          tenant_id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          status: tenant.status,
          metadata: tenant.metadata,
          created_at: tenant.created_at,
          application: {
            id: application_id,
            name: application.name
          },
          subscription_sync: subscriptionSync
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('register-tenant error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
