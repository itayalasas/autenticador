import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from_name?: string;
  from_email?: string;
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

    const { to, subject, html, from_name = 'AuthSystem', from_email = 'noreply@authsystem.com' }: EmailRequest = await req.json();

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

    // For now, we'll log the email instead of actually sending it
    // In production, you would integrate with Resend, SendGrid, or another email provider
    console.log('📧 Email would be sent:', {
      to,
      from: `${from_name} <${from_email}>`,
      subject,
      html: html.substring(0, 100) + '...'
    });

    // TODO: Integrate with actual email provider
    // Example with Resend:
    // const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    // const res = await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${RESEND_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     from: `${from_name} <${from_email}>`,
    //     to: [to],
    //     subject,
    //     html
    //   })
    // });

    // Store email in database for tracking
    const { error: dbError } = await supabase
      .from('email_logs')
      .insert({
        to_email: to,
        from_email,
        from_name,
        subject,
        html_content: html,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error logging email:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully'
      }),
      {
        status: 200,
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
