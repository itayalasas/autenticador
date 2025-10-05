import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const applicationId = url.searchParams.get('application_id');

    if (!applicationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'application_id parameter is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get application with email config
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, name, application_id, email_config')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error fetching application',
          details: appError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!app) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Application not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get recent email logs
    const { data: emailLogs, error: logsError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(5);

    const emailConfig = app.email_config || {};

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          application: {
            id: app.id,
            name: app.name,
            application_id: app.application_id
          },
          email_config: {
            provider: emailConfig.email_provider || 'not_set',
            from_email: emailConfig.from_email || 'not_set',
            from_name: emailConfig.from_name || 'not_set',
            require_email_verification: emailConfig.require_email_verification ?? false,
            send_password_reset_email: emailConfig.send_password_reset_email ?? true,
            has_smtp_config: !!(emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password),
            has_api_key: !!emailConfig.api_key,
            smtp_configured: {
              host: emailConfig.smtp_host ? 'configured' : 'not_set',
              port: emailConfig.smtp_port || 'not_set',
              user: emailConfig.smtp_user ? 'configured' : 'not_set',
              password: emailConfig.smtp_password ? 'configured (hidden)' : 'not_set',
              secure: emailConfig.smtp_secure ?? 'not_set'
            }
          },
          recent_emails: emailLogs || [],
          diagnosis: {
            can_send_emails: emailConfig.email_provider !== 'system' && emailConfig.email_provider !== undefined,
            issue: emailConfig.email_provider === 'system' || !emailConfig.email_provider
              ? 'Email provider is set to "system" which only logs emails but does not send them. Change to SMTP, Resend, or SendGrid in Authentication settings.'
              : null,
            recommendation: emailConfig.email_provider === 'smtp' && !emailConfig.smtp_host
              ? 'SMTP selected but configuration is incomplete. Please configure SMTP host, user, and password.'
              : emailConfig.email_provider === 'resend' && !emailConfig.api_key
              ? 'Resend selected but API key is missing. Please add your Resend API key.'
              : emailConfig.email_provider === 'sendgrid' && !emailConfig.api_key
              ? 'SendGrid selected but API key is missing. Please add your SendGrid API key.'
              : emailConfig.email_provider !== 'system'
              ? 'Configuration looks good! Emails should be sending.'
              : 'Configure a real email provider (SMTP, Resend, or SendGrid) to send actual emails.'
          }
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Debug email config error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
