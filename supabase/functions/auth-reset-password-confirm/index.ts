import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hash } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ResetPasswordConfirmRequest {
  token: string
  email: string
  new_password: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only POST method is allowed'
          }
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let requestBody;
    try {
      requestBody = await req.json()
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { token, email, new_password }: ResetPasswordConfirmRequest = requestBody

    if (!token || !email || !new_password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Token, email and new_password are required'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PASSWORD_TOO_SHORT',
            message: 'Password must be at least 8 characters'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🔍 Validating reset token for:', email);

    const { data: tokenData, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select(`
        *,
        app_users (
          id,
          email,
          application_id
        )
      `)
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenData) {
      console.log('❌ Token not found');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token inválido o expirado'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('❌ Token expired');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'El token ha expirado. Por favor solicita uno nuevo.'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (tokenData.used_at) {
      console.log('❌ Token already used');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOKEN_USED',
            message: 'Este token ya ha sido utilizado'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const appUser = tokenData.app_users;
    if (!appUser || appUser.email !== email) {
      console.log('❌ Email mismatch');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'EMAIL_MISMATCH',
            message: 'El email no coincide con el token'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Token valid, updating password...');

    const hashedPassword = await hash(new_password)

    const { error: updateError } = await supabase
      .from('app_users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', appUser.id)

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Error al actualizar la contraseña'
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { error: markUsedError } = await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    if (markUsedError) {
      console.error('⚠️ Error marking token as used:', markUsedError);
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'

    await supabase.from('auth_logs').insert({
      application_id: appUser.application_id,
      app_user_id: appUser.id,
      event_type: 'password_reset',
      ip_address: ipAddress,
      user_agent: req.headers.get('user-agent') || 'unknown',
      success: true,
      metadata: {
        email: email,
        action: 'password_changed'
      }
    });

    console.log('✅ Password reset successful for:', email);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: 'Contraseña actualizada exitosamente'
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Reset password confirm error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
