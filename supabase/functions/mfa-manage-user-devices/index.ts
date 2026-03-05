import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authorization header requerido' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'SERVER_CONFIG_ERROR', message: 'Configuración del servidor incompleta' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token inválido o expirado' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requesterId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const appUserId = body?.app_user_id as string | undefined;

    if (!action || !appUserId) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: 'action y app_user_id son requeridos' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('id, application_id')
      .eq('id', appUserId)
      .single();

    if (appUserError || !appUser) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, owner_id')
      .eq('id', appUser.application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'APPLICATION_NOT_FOUND', message: 'Aplicación no encontrada' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (application.owner_id !== requesterId) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'No tienes permisos para gestionar este usuario' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      const { data: devices, error: listError } = await supabase
        .from('mfa_devices')
        .select('id, device_name, device_platform, created_at, last_seen_at, is_active')
        .eq('app_user_id', appUserId)
        .order('created_at', { ascending: false });

      if (listError) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'LIST_ERROR', message: 'No se pudieron obtener dispositivos' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: { devices: devices ?? [] } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'revoke') {
      const deviceId = body?.device_id as string | undefined;
      if (!deviceId) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message: 'device_id es requerido para revoke' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: revokeError } = await supabase
        .from('mfa_devices')
        .update({ is_active: false })
        .eq('id', deviceId)
        .eq('app_user_id', appUserId);

      if (revokeError) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'REVOKE_ERROR', message: 'No se pudo revocar el dispositivo' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('mfa_login_challenges')
        .delete()
        .eq('app_user_id', appUserId)
        .eq('status', 'pending');

      return new Response(
        JSON.stringify({ success: true, message: 'Dispositivo revocado correctamente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reset') {
      const { error: resetError } = await supabase
        .from('mfa_devices')
        .update({ is_active: false })
        .eq('app_user_id', appUserId);

      if (resetError) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'RESET_ERROR', message: 'No se pudo resetear los dispositivos' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('mfa_login_challenges')
        .delete()
        .eq('app_user_id', appUserId)
        .eq('status', 'pending');

      return new Response(
        JSON.stringify({ success: true, message: 'Registro MFA reseteado. El usuario deberá volver a enrolar un dispositivo.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: { code: 'INVALID_ACTION', message: 'Acción no soportada' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('mfa-manage-user-devices error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
