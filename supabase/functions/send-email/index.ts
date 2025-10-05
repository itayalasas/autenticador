import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  application_id?: string;
  app_user_id?: string;
}

interface EmailConfig {
  email_provider: 'system' | 'smtp' | 'resend' | 'sendgrid';
  from_name: string;
  from_email: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  api_key?: string;
}

async function sendWithSMTP(config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host || '',
        port: config.smtp_port || 587,
        tls: config.smtp_secure ?? true,
        auth: {
          username: config.smtp_user || '',
          password: config.smtp_password || '',
        },
      },
    });

    await client.send({
      from: `${config.from_name} <${config.from_email}>`,
      to,
      subject,
      content: html,
      html,
    });

    await client.close();
    console.log('✅ Email sent successfully via SMTP');
    return true;
  } catch (error) {
    console.error('❌ SMTP Error:', error);
    throw error;
  }
}

async function sendWithResend(apiKey: string, config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${config.from_name} <${config.from_email}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    console.log('✅ Email sent successfully via Resend');
    return true;
  } catch (error) {
    console.error('❌ Resend Error:', error);
    throw error;
  }
}

async function sendWithSendGrid(apiKey: string, config: EmailConfig, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: {
          email: config.from_email,
          name: config.from_name,
        },
        subject,
        content: [{
          type: 'text/html',
          value: html,
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    console.log('✅ Email sent successfully via SendGrid');
    return true;
  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    throw error;
  }
}

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

    const { to, subject, html, application_id, app_user_id }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: to, subject, html'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get email configuration from application
    let emailConfig: EmailConfig = {
      email_provider: 'system',
      from_name: 'AuthSystem',
      from_email: 'noreply@authsystem.com',
    };

    if (application_id) {
      console.log('🔍 Looking for application config with ID:', application_id);

      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('email_config')
        .eq('id', application_id)
        .maybeSingle();

      if (appError) {
        console.error('❌ Error fetching application config:', appError);
      }

      if (app?.email_config) {
        console.log('📧 Found email config:', {
          provider: app.email_config.email_provider,
          from_email: app.email_config.from_email,
          has_smtp_host: !!app.email_config.smtp_host,
          has_api_key: !!app.email_config.api_key
        });
        emailConfig = { ...emailConfig, ...app.email_config };
      } else {
        console.log('⚠️ No email config found for application, using defaults');
      }
    } else {
      console.log('⚠️ No application_id provided, using default email config');
    }

    let status = 'sent';
    let errorMessage = null;
    let actuallySent = false;

    // Send email based on provider
    console.log('📤 Attempting to send email using provider:', emailConfig.email_provider);

    try {
      switch (emailConfig.email_provider) {
        case 'smtp':
          console.log('🔧 Using SMTP provider');
          if (emailConfig.smtp_host && emailConfig.smtp_user && emailConfig.smtp_password) {
            console.log('✅ SMTP configuration complete, sending email...');
            await sendWithSMTP(emailConfig, to, subject, html);
            actuallySent = true;
          } else {
            console.error('❌ SMTP configuration incomplete:', {
              has_host: !!emailConfig.smtp_host,
              has_user: !!emailConfig.smtp_user,
              has_password: !!emailConfig.smtp_password
            });
            throw new Error('SMTP configuration incomplete');
          }
          break;

        case 'resend':
          console.log('🔧 Using Resend provider');
          if (emailConfig.api_key) {
            console.log('✅ Resend API key found, sending email...');
            await sendWithResend(emailConfig.api_key, emailConfig, to, subject, html);
            actuallySent = true;
          } else {
            console.error('❌ Resend API key not configured');
            throw new Error('Resend API key not configured');
          }
          break;

        case 'sendgrid':
          console.log('🔧 Using SendGrid provider');
          if (emailConfig.api_key) {
            console.log('✅ SendGrid API key found, sending email...');
            await sendWithSendGrid(emailConfig.api_key, emailConfig, to, subject, html);
            actuallySent = true;
          } else {
            console.error('❌ SendGrid API key not configured');
            throw new Error('SendGrid API key not configured');
          }
          break;

        case 'system':
        default:
          console.log('⚠️ Using SYSTEM mode - Email will be logged but NOT sent physically');
          console.log('📧 Email logged (system mode - not sent physically):', {
            to,
            from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
            subject,
          });
          break;
      }
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.message;
      console.error('❌ Email sending failed:', error);
    }

    // Store email in database for tracking
    const { error: dbError } = await supabase
      .from('email_logs')
      .insert({
        to_email: to,
        from_email: emailConfig.from_email,
        from_name: emailConfig.from_name,
        subject,
        html_content: html,
        status,
        error_message: errorMessage,
        application_id: application_id || null,
        app_user_id: app_user_id || null,
        sent_at: actuallySent ? new Date().toISOString() : null
      });

    if (dbError) {
      console.error('Error logging email:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: status === 'sent',
        message: actuallySent 
          ? 'Email sent successfully' 
          : 'Email logged (not sent - configure email provider)',
        provider: emailConfig.email_provider,
        actually_sent: actuallySent
      }),
      {
        status: status === 'sent' ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
