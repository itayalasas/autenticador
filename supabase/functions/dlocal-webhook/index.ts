import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Signature",
};

interface DLocalWebhookEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: {
      id: string;
      status: string;
      subscription_id?: string;
      plan_id?: string;
      plan_token?: string;
      customer_email?: string;
      customer_id?: string;
      amount?: number;
      currency?: string;
      payment_method?: any;
    };
  };
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

    // Get webhook payload
    const payload: DLocalWebhookEvent = await req.json();
    console.log('📥 Webhook recibido:', payload);

    // Verify webhook signature (dLocal should send X-Signature header)
    const signature = req.headers.get('X-Signature');
    const isValid = await verifyWebhookSignature(payload, signature);

    if (!isValid) {
      console.error('❌ Firma de webhook inválida');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Store webhook event
    const { error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        provider: 'dlocal',
        event_type: payload.type,
        event_data: payload,
        processed: false,
        received_at: new Date().toISOString()
      });

    if (webhookError) {
      console.error('Error guardando webhook:', webhookError);
    }

    // Process webhook based on type
    let result: any = { success: false };

    switch (payload.type) {
      case 'subscription.created':
      case 'subscription.activated':
        result = await handleSubscriptionActivated(supabase, payload);
        break;

      case 'subscription.updated':
        result = await handleSubscriptionUpdated(supabase, payload);
        break;

      case 'subscription.cancelled':
      case 'subscription.expired':
        result = await handleSubscriptionCancelled(supabase, payload);
        break;

      case 'payment.succeeded':
      case 'invoice.payment_succeeded':
        result = await handlePaymentSucceeded(supabase, payload);
        break;

      case 'payment.failed':
      case 'invoice.payment_failed':
        result = await handlePaymentFailed(supabase, payload);
        break;

      default:
        console.log(`ℹ️  Tipo de evento no procesado: ${payload.type}`);
        result = { success: true, message: 'Event type not processed' };
    }

    // Mark webhook as processed
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_result: result
      })
      .eq('event_data->id', payload.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed',
        result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error procesando webhook:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function verifyWebhookSignature(payload: any, signature: string | null): Promise<boolean> {
  // TODO: Implement signature verification based on dLocal documentation
  // For now, we'll accept all webhooks in development
  // In production, you MUST verify the signature using dLocal's secret key

  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

  if (isDevelopment) {
    console.warn('⚠️  Webhook signature verification disabled in development');
    return true;
  }

  if (!signature) {
    console.error('❌ No signature provided');
    return false;
  }

  // Implement actual signature verification here
  // Example: HMAC SHA256 with secret key
  const secretKey = Deno.env.get('DLOCAL_WEBHOOK_SECRET') || '';

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedSignature === signature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

async function handleSubscriptionActivated(supabase: any, payload: DLocalWebhookEvent) {
  console.log('✅ Procesando activación de suscripción...');

  const { data: subscriptionObj } = payload.data.object;
  const customerEmail = subscriptionObj.customer_email;
  const planToken = subscriptionObj.plan_token;
  const subscriptionId = subscriptionObj.subscription_id || subscriptionObj.id;

  // Find user by email
  const { data: authUser, error: userError } = await supabase.auth.admin.getUserByEmail(customerEmail);

  if (userError || !authUser) {
    console.error('❌ Usuario no encontrado:', customerEmail);
    return { success: false, error: 'User not found' };
  }

  // Find the plan in subscription_plans
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('provider_plan_id', planToken)
    .single();

  if (planError || !plan) {
    console.error('❌ Plan no encontrado:', planToken);
    return { success: false, error: 'Plan not found' };
  }

  // Calculate billing dates
  const now = new Date();
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days

  // Check if subscription already exists
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', authUser.user.id)
    .eq('status', 'active')
    .single();

  if (existingSubscription) {
    // Update existing subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_id: plan.id,
        status: 'active',
        provider_subscription_id: subscriptionId,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: now.toISOString()
      })
      .eq('id', existingSubscription.id);

    if (updateError) {
      console.error('❌ Error actualizando suscripción:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Suscripción actualizada:', existingSubscription.id);
    return { success: true, subscription_id: existingSubscription.id, action: 'updated' };
  } else {
    // Create new subscription
    const { data: newSubscription, error: createError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: authUser.user.id,
        plan_id: plan.id,
        status: 'active',
        provider: 'dlocal',
        provider_subscription_id: subscriptionId,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creando suscripción:', createError);
      return { success: false, error: createError.message };
    }

    console.log('✅ Suscripción creada:', newSubscription.id);
    return { success: true, subscription_id: newSubscription.id, action: 'created' };
  }
}

async function handleSubscriptionUpdated(supabase: any, payload: DLocalWebhookEvent) {
  console.log('🔄 Procesando actualización de suscripción...');

  const subscriptionId = payload.data.object.subscription_id || payload.data.object.id;

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .update({
      status: payload.data.object.status === 'active' ? 'active' : 'inactive',
      updated_at: new Date().toISOString()
    })
    .eq('provider_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error actualizando suscripción:', error);
    return { success: false, error: error.message };
  }

  console.log('✅ Suscripción actualizada:', subscription.id);
  return { success: true, subscription_id: subscription.id };
}

async function handleSubscriptionCancelled(supabase: any, payload: DLocalWebhookEvent) {
  console.log('❌ Procesando cancelación de suscripción...');

  const subscriptionId = payload.data.object.subscription_id || payload.data.object.id;

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('provider_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error cancelando suscripción:', error);
    return { success: false, error: error.message };
  }

  console.log('✅ Suscripción cancelada:', subscription.id);
  return { success: true, subscription_id: subscription.id };
}

async function handlePaymentSucceeded(supabase: any, payload: DLocalWebhookEvent) {
  console.log('💰 Procesando pago exitoso...');

  const paymentData = payload.data.object;

  // Find subscription by payment data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', paymentData.subscription_id)
    .single();

  if (!subscription) {
    console.log('ℹ️  No se encontró suscripción para este pago');
    return { success: true, message: 'Payment recorded but no subscription found' };
  }

  // Update subscription to active if it wasn't
  if (subscription.status !== 'active') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);
  }

  console.log('✅ Pago procesado para suscripción:', subscription.id);
  return { success: true, subscription_id: subscription.id };
}

async function handlePaymentFailed(supabase: any, payload: DLocalWebhookEvent) {
  console.log('❌ Procesando pago fallido...');

  const paymentData = payload.data.object;

  // Find subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', paymentData.subscription_id)
    .single();

  if (!subscription) {
    console.log('ℹ️  No se encontró suscripción para este pago fallido');
    return { success: true, message: 'Payment failure recorded but no subscription found' };
  }

  // Mark subscription as payment_failed but don't deactivate immediately
  await supabase
    .from('subscriptions')
    .update({
      status: 'payment_failed',
      updated_at: new Date().toISOString()
    })
    .eq('id', subscription.id);

  console.log('⚠️  Pago fallido registrado para suscripción:', subscription.id);
  return { success: true, subscription_id: subscription.id, status: 'payment_failed' };
}
