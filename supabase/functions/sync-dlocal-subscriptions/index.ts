import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DLocalSubscription {
  id: number;
  plan: {
    id: number;
    merchant_id: number;
    name: string;
    plan_token: string;
    amount: number;
    currency: string;
  };
  subscription_token: string;
  status: string;
  client_email: string;
  client_id: string;
  active: boolean;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Optional: Validate cron secret for security
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    // If CRON_SECRET is set, validate it. Otherwise allow all requests
    if (cronSecret && cronSecret !== requestSecret) {
      console.warn('❌ Invalid cron secret provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid authentication'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const dlocalApiUrl = Deno.env.get('DLOCAL_API_URL') || 'https://api-sbx.dlocalgo.com';
    const dlocalApiKey = Deno.env.get('DLOCAL_API_KEY') || '';
    const dlocalSecretKey = Deno.env.get('DLOCAL_SECRET_KEY') || '';

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured');
    }

    console.log('🔄 Iniciando sincronización de suscripciones con dLocal...');
    console.log('📍 API URL:', dlocalApiUrl);
    console.log('🔑 API Key configured:', dlocalApiKey ? 'Yes' : 'No');
    console.log('🔐 Secret Key configured:', dlocalSecretKey ? 'Yes' : 'No');

    // Get all plans from database
    const { data: plans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('provider', 'dlocal')
      .not('provider_plan_id', 'is', null);

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      throw plansError;
    }

    console.log(`📋 Found ${plans?.length || 0} dLocal plans in database`);

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: any[] = [];

    // For each plan, fetch subscriptions from dLocal
    for (const plan of plans || []) {
      try {
        console.log(`\n🔍 Fetching subscriptions for plan: ${plan.name} (ID: ${plan.provider_plan_id})`);

        // Call dLocal API to get subscriptions for this plan
        const apiUrl = `${dlocalApiUrl}/v1/subscription/plan/${plan.provider_plan_id}/subscription/all`;
        console.log(`🔗 API URL: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${dlocalApiKey}`,
            'Content-Type': 'application/json',
            'X-API-Secret': dlocalSecretKey
          }
        });

        console.log(`📡 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error fetching subscriptions for plan ${plan.provider_plan_id}:`);
          console.error(`   Status: ${response.status} ${response.statusText}`);
          console.error(`   Response: ${errorText}`);
          errors.push({
            plan_id: plan.id,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText
          });
          continue;
        }

        const data = await response.json();
        const subscriptions: DLocalSubscription[] = data.data || [];

        console.log(`✅ Found ${subscriptions.length} subscriptions for plan ${plan.name}`);

        // Process each subscription
        for (const dlocalSub of subscriptions) {
          try {
            // Only process CONFIRMED and active subscriptions
            if (dlocalSub.status !== 'CONFIRMED' || !dlocalSub.active) {
              console.log(`⏭️  Skipping subscription ${dlocalSub.id} (status: ${dlocalSub.status}, active: ${dlocalSub.active})`);
              continue;
            }

            // Find user by email
            const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

            if (userError) {
              console.error('Error listing users:', userError);
              continue;
            }

            const user = userData.users.find(u => u.email === dlocalSub.client_email);

            if (!user) {
              console.log(`⚠️  User not found for email: ${dlocalSub.client_email}`);
              continue;
            }

            // Map dLocal status to internal status
            const internalStatus = mapDLocalStatus(dlocalSub.status);

            // Calculate period dates
            const currentPeriodStart = new Date(dlocalSub.created_at).toISOString();
            const scheduledDate = new Date(dlocalSub.scheduled_date);
            const currentPeriodEnd = scheduledDate.toISOString();

            // Check if subscription already exists
            const { data: existingSubscription, error: checkError } = await supabase
              .from('subscriptions')
              .select('id, status')
              .eq('user_id', user.id)
              .eq('provider_subscription_id', dlocalSub.subscription_token)
              .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
              console.error('Error checking subscription:', checkError);
              continue;
            }

            if (existingSubscription) {
              // Update existing subscription
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  plan_id: plan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_plan_id: plan.provider_plan_id,
                  current_period_start: currentPeriodStart,
                  current_period_end: currentPeriodEnd,
                  metadata: {
                    dlocal_id: dlocalSub.id,
                    client_id: dlocalSub.client_id,
                    payment_method_code: (dlocalSub as any).payment_method_code,
                    last_synced: new Date().toISOString()
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSubscription.id);

              if (updateError) {
                console.error('Error updating subscription:', updateError);
                errors.push({
                  user_email: dlocalSub.client_email,
                  error: updateError.message
                });
              } else {
                console.log(`✅ Updated subscription for ${dlocalSub.client_email}`);
                totalUpdated++;
              }
            } else {
              // Create new subscription
              const { error: insertError } = await supabase
                .from('subscriptions')
                .insert({
                  user_id: user.id,
                  plan_id: plan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_subscription_id: dlocalSub.subscription_token,
                  provider_plan_id: plan.provider_plan_id,
                  current_period_start: currentPeriodStart,
                  current_period_end: currentPeriodEnd,
                  cancel_at_period_end: false,
                  metadata: {
                    dlocal_id: dlocalSub.id,
                    client_id: dlocalSub.client_id,
                    payment_method_code: (dlocalSub as any).payment_method_code,
                    synced_from_api: true,
                    last_synced: new Date().toISOString()
                  }
                });

              if (insertError) {
                console.error('Error creating subscription:', insertError);
                errors.push({
                  user_email: dlocalSub.client_email,
                  error: insertError.message
                });
              } else {
                console.log(`✅ Created subscription for ${dlocalSub.client_email}`);
                totalCreated++;
              }
            }

            totalSynced++;
          } catch (subError: any) {
            console.error(`Error processing subscription ${dlocalSub.id}:`, subError);
            errors.push({
              subscription_id: dlocalSub.id,
              error: subError.message
            });
          }
        }
      } catch (planError: any) {
        console.error(`Error processing plan ${plan.id}:`, planError);
        errors.push({
          plan_id: plan.id,
          error: planError.message
        });
      }
    }

    const result = {
      success: true,
      message: 'Subscription sync completed',
      stats: {
        total_synced: totalSynced,
        created: totalCreated,
        updated: totalUpdated,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('\n📊 Sync Summary:', result.stats);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Sync error:', error);

    return new Response(
      JSON.stringify({
        success: false,
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

function mapDLocalStatus(dlocalStatus: string): string {
  const statusMap: Record<string, string> = {
    'CONFIRMED': 'active',
    'PENDING': 'pending',
    'CANCELLED': 'cancelled',
    'EXPIRED': 'expired',
    'FAILED': 'payment_failed'
  };

  return statusMap[dlocalStatus] || 'inactive';
}