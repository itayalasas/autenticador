import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    // Use service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get IP address from multiple sources
    // 1. Check if client sent their IP in the body (for development environments)
    let clientIp = '0.0.0.0';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.client_ip) {
          clientIp = body.client_ip;
          console.log('Using client-provided IP:', clientIp);
        }
      } catch (e) {
        // If parsing fails, continue with header detection
      }
    }

    // 2. Try to get IP from headers (for production environments)
    if (clientIp === '0.0.0.0') {
      const ipAddress = req.headers.get('x-forwarded-for') ||
                       req.headers.get('x-real-ip') ||
                       req.headers.get('cf-connecting-ip') ||
                       '0.0.0.0';
      clientIp = ipAddress.split(',')[0].trim();
      console.log('Using header-detected IP:', clientIp);
    }

    console.log('Final IP to check:', clientIp);

    // Check if IP is blocked
    const { data: blockedIP, error } = await supabase
      .from('blocked_ips')
      .select('id, ip_address, reason, blocked_at, expires_at')
      .eq('ip_address', clientIp)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    if (error) {
      console.error('Error checking IP status:', error);
    }

    console.log('Blocked IP result:', blockedIP);

    const isBlocked = !!blockedIP;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ip_address: clientIp,
          is_blocked: isBlocked,
          blocked_info: blockedIP ? {
            reason: blockedIP.reason,
            blocked_at: blockedIP.blocked_at,
            expires_at: blockedIP.expires_at
          } : null
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Check IP status error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al verificar el estado de la IP'
        }
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
