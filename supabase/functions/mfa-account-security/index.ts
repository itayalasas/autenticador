import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { hashDeviceToken } from '../_shared/device-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface RequestBody {
  application_id: string;
  api_key: string;
  email?: string;
  password?: string;
  device_token?: string;
  device_id?: string;
  device_name?: string;
  device_platform?: string;
  action?: 'overview' | 'revoke_device' | 'reset_security';
  target_device_id?: string;
}

interface ValidationResult {
  error?: { code: string; message: string };
  application?: any;
  user?: any;
}

async function validateUser(supabase: ReturnType<typeof createClient>, body: RequestBody): Promise<ValidationResult> {
  const { application_id, api_key, email, password, device_token, device_id, device_name, device_platform } = body;

  const { data: application } = await supabase
    .from('applications')
    .select('id, application_id, name')
    .eq('application_id', application_id)
    .maybeSingle();

  if (!application) return { error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } };

  const { data: apiKeyData } = await supabase
    .from('api_keys')
    .select('application_id, is_active')
    .eq('key_hash', api_key)
    .eq('is_active', true)
    .maybeSingle();

  if (!apiKeyData) return { error: { code: 'INVALID_API_KEY', message: 'API Key inválida' } };
  if (apiKeyData.application_id !== application.id) return { error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicación' } };

  const nowIso = new Date().toISOString();

  if (device_token) {
    const deviceTokenHash = await hashDeviceToken(device_token);

    const { data: device } = await supabase
      .from('mfa_devices')
      .select('id, application_id, app_user_id, device_id, device_name, is_active')
      .eq('application_id', application.id)
      .eq('device_token_hash', deviceTokenHash)
      .maybeSingle();

    if (!device) return { error: { code: 'DEVICE_TOKEN_NOT_FOUND', message: 'Token de dispositivo no encontrado' } };
    if (!device.is_active) return { error: { code: 'DEVICE_NOT_ACTIVE', message: 'El dispositivo está inactivo' } };
    if (device_id && device.device_id !== device_id) return { error: { code: 'DEVICE_MISMATCH', message: 'El dispositivo no coincide con el token registrado' } };

    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, name, status, last_login')
      .eq('id', device.app_user_id)
      .maybeSingle();

    if (!user) return { error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } };
    if (user.status !== 'active') return { error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' } };
    if (email && user.email && user.email.toLowerCase() !== email.toLowerCase()) {
      return { error: { code: 'USER_MISMATCH', message: 'El correo no coincide con el token del dispositivo' } };
    }

    const devicePatch: Record<string, unknown> = {
      last_seen_at: nowIso,
      device_token_last_used_at: nowIso,
    };

    if (device_name) {
      devicePatch.device_name = device_name;
    } else if (device.device_name) {
      devicePatch.device_name = device.device_name;
    }

    if (device_platform) {
      devicePatch.device_platform = device_platform;
    }

    await supabase.from('mfa_devices').update(devicePatch).eq('id', device.id);

    return { application, user };
  }

  if (!email || !password) {
    return { error: { code: 'MISSING_FIELDS', message: 'application_id, api_key, email and password are required' } };
  }

  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, name, password_hash, status, last_login')
    .eq('application_id', application.id)
    .eq('email', email)
    .maybeSingle();

  if (!user) return { error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } };
  if (user.status !== 'active') return { error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' } };

  const validPassword = await bcrypt.compare(password, user.password_hash || '');
  if (!validPassword) return { error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } };

  return { application, user };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method is allowed' } }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: RequestBody = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const validation = await validateUser(supabase, body);

    if (validation.error) {
      return new Response(JSON.stringify({ success: false, error: validation.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const application = validation.application!;
    const user = validation.user!;
    const action = body.action || 'overview';

    if (action === 'revoke_device') {
      const deviceId = body.target_device_id;
      if (!deviceId) {
        return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'target_device_id es requerido' } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: revokeError } = await supabase
        .from('mfa_devices')
        .update({ is_active: false })
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .eq('id', deviceId);

      if (revokeError) {
        return new Response(JSON.stringify({ success: false, error: { code: 'REVOKE_ERROR', message: 'No se pudo revocar el dispositivo' } }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase
        .from('mfa_login_challenges')
        .delete()
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .eq('status', 'pending');

      await supabase
        .from('passkey_setup_tokens')
        .update({ status: 'cancelled' })
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .is('used_at', null);

      await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        event_type: 'device_revoked',
        success: true,
        metadata: { device_id: deviceId }
      });

      return new Response(JSON.stringify({ success: true, message: 'Dispositivo revocado correctamente' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset_security') {
      const { error: resetError } = await supabase
        .from('mfa_devices')
        .update({ is_active: false })
        .eq('application_id', application.id)
        .eq('app_user_id', user.id);

      if (resetError) {
        return new Response(JSON.stringify({ success: false, error: { code: 'RESET_ERROR', message: 'No se pudo resetear los dispositivos' } }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase
        .from('passkeys')
        .update({ is_active: false })
        .eq('application_id', application.id)
        .eq('app_user_id', user.id);

      await supabase
        .from('mfa_login_challenges')
        .delete()
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .eq('status', 'pending');

      await supabase.from('auth_logs').insert({
        application_id: application.id,
        app_user_id: user.id,
        event_type: 'security_reset',
        success: true
      });

      return new Response(JSON.stringify({ success: true, message: 'Seguridad restablecida. El usuario deberá volver a enrolar sus credenciales.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const [devicesRes, logsRes, passkeysRes, pendingRes] = await Promise.all([
      supabase
        .from('mfa_devices')
        .select('id, device_id, device_name, device_platform, created_at, last_seen_at, is_active, push_provider, device_token_last_used_at')
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('auth_logs')
        .select('id, event_type, success, created_at, ip_address, metadata')
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('passkeys')
        .select('id, credential_id, device_name, created_at, last_used_at, is_active')
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('mfa_login_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('application_id', application.id)
        .eq('app_user_id', user.id)
        .eq('status', 'pending'),
    ]);

    if (devicesRes.error) {
      return new Response(JSON.stringify({ success: false, error: { code: 'DEVICES_ERROR', message: 'No se pudieron cargar los dispositivos' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (passkeysRes.error) {
      return new Response(JSON.stringify({ success: false, error: { code: 'PASSKEYS_ERROR', message: 'No se pudieron cargar las claves de paso' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pendingRes.error) {
      return new Response(JSON.stringify({ success: false, error: { code: 'PENDING_ERROR', message: 'No se pudieron cargar las solicitudes pendientes' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const securitySummary = {
      total_devices: devicesRes.data?.length || 0,
      active_devices: (devicesRes.data || []).filter((device: any) => device.is_active).length,
      passkeys: (passkeysRes.data || []).filter((passkey: any) => passkey.is_active !== false).length,
      pending_challenges: pendingRes.count || 0,
      last_login_at: user.last_login || null,
      has_device_token: !!body.device_token,
    };

    await supabase.from('auth_logs').insert({
      application_id: application.id,
      app_user_id: user.id,
      event_type: 'security_overview',
      success: true,
      metadata: {
        device_count: securitySummary.total_devices,
        active_devices: securitySummary.active_devices,
        passkeys: securitySummary.passkeys,
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          last_login: user.last_login,
        },
        application: {
          id: application.id,
          application_id: application.application_id,
          name: application.name,
        },
        summary: securitySummary,
        devices: devicesRes.data || [],
        recent_logs: logsRes.data || [],
        passkeys: passkeysRes.data || [],
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-account-security error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
