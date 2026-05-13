import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import bcrypt from "npm:bcryptjs@2.4.3";
import { hashDeviceToken } from '../_shared/device-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface UnlinkRequest {
  application_id: string;
  api_key: string;
  email?: string;
  password?: string;
  device_token?: string;
  device_id?: string;
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

    const body: UnlinkRequest = await req.json();
    const { application_id, api_key, email, password, device_token, device_id } = body;

    if (!application_id || !api_key || (!email && !device_token) || (!password && !device_token) || (!device_id && !device_token)) {
      return new Response(JSON.stringify({ success: false, error: { code: 'MISSING_FIELDS', message: 'application_id, api_key and either device_token or email/password + device_id are required' } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: application } = await supabase
      .from('applications')
      .select('id, application_id, name')
      .eq('application_id', application_id)
      .maybeSingle();

    if (!application) {
      return new Response(JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('id, application_id, is_active')
      .eq('key_hash', api_key)
      .eq('is_active', true)
      .maybeSingle();

    if (!apiKeyData) {
      return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_API_KEY', message: 'API Key inválida o inactiva' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (apiKeyData.application_id !== application.id) {
      return new Response(JSON.stringify({ success: false, error: { code: 'API_KEY_MISMATCH', message: 'API Key no pertenece a esta aplicación' } }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let targetDeviceId = device_id || '';
    let targetUserId = '';

    if (device_token) {
      const deviceTokenHash = await hashDeviceToken(device_token);
      const { data: device } = await supabase
        .from('mfa_devices')
        .select('id, app_user_id, device_id, device_name, is_active')
        .eq('application_id', application.id)
        .eq('device_token_hash', deviceTokenHash)
        .maybeSingle();

      if (!device) {
        return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_TOKEN_NOT_FOUND', message: 'Token de dispositivo no encontrado' } }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!device.is_active) {
        return new Response(JSON.stringify({ success: false, error: { code: 'DEVICE_NOT_ACTIVE', message: 'El dispositivo ya estaba inactivo' } }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      targetDeviceId = device.device_id;
      targetUserId = device.app_user_id;

      const { data: deviceUser } = await supabase
        .from('app_users')
        .select('id, email, status')
        .eq('id', device.app_user_id)
        .maybeSingle();

      if (!deviceUser) {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (email && deviceUser.email && deviceUser.email.toLowerCase() !== email.toLowerCase()) {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_MISMATCH', message: 'El correo no coincide con el dispositivo vinculado' } }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      const { data: user } = await supabase
        .from('app_users')
        .select('id, email, password_hash, status')
        .eq('application_id', application.id)
        .eq('email', email)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (user.status !== 'active') {
        return new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_ACTIVE', message: 'Usuario inactivo' } }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const validPassword = await bcrypt.compare(password || '', user.password_hash || '');
      if (!validPassword) {
        return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      targetUserId = user.id;
    }

    const { data: deactivatedDevices, error: unlinkError } = await supabase
      .from('mfa_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('application_id', application.id)
      .eq('app_user_id', targetUserId)
      .eq('device_id', targetDeviceId)
      .eq('is_active', true)
      .select('id, device_id');

    if (unlinkError) {
      console.error('Error unlinking MFA device:', unlinkError);
      return new Response(JSON.stringify({ success: false, error: { code: 'UNLINK_ERROR', message: 'No se pudo desvincular el dispositivo' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase
      .from('mfa_login_challenges')
      .delete()
      .eq('application_id', application.id)
      .eq('app_user_id', targetUserId)
      .eq('status', 'pending');

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: 'unlinked',
        application_id: application.application_id,
        app_user_id: targetUserId,
        device_id: targetDeviceId,
        deactivated_devices: deactivatedDevices?.length || 0,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('mfa-unlink-device error:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
