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
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (cronSecret && cronSecret !== requestSecret) {
      console.warn('\u274c Invalid cron secret provided');
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

    let dlocalApiUrl = Deno.env.get('DLOCAL_API_URL');
    let dlocalApiKey = Deno.env.get('DLOCAL_API_KEY');
    let dlocalSecretKey = Deno.env.get('DLOCAL_SECRET_KEY');

    if (!dlocalApiKey) {
      dlocalApiKey = Deno.env.get('VITE_DLOCAL_API_KEY');
    }
    if (!dlocalSecretKey) {
      dlocalSecretKey = Deno.env.get('VITE_DLOCAL_SECRET_KEY');
    }
    if (!dlocalApiUrl) {
      dlocalApiUrl = Deno.env.get('VITE_DLOCAL_API_URL');
    }

    if (!dlocalApiUrl) {
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    console.log('\ud83d\udd04 Iniciando sincronizaci\u00f3n de suscripciones con dLocal...');
    console.log('\ud83d\udccd API URL:', dlocalApiUrl);
    console.log('\ud83d\udd11 API Key configured:', dlocalApiKey ? 'Yes (length: ' + dlocalApiKey.length + ')' : 'No');
    console.log('\ud83d\udd10 Secret Key configured:', dlocalSecretKey ? 'Yes (length: ' + dlocalSecretKey.length + ')' : 'No');

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured. Check DLOCAL_API_KEY and DLOCAL_SECRET_KEY environment variables.');
    }

    console.log('\ud83c\udfab Setting up dLocal authentication headers');

    console.log('\n\ud83d\udccb Step 1: Checking plans cache...');

    // First, check if we have cached plans
    const { data: cachedPlans, error: cacheError } = await supabase
      .from('dlocal_plans_cache')
      .select('*')
      .eq('active', true);

    let dlocalPlans = cachedPlans || [];

    // If no cached plans, fetch from API and cache them
    if (!cachedPlans || cachedPlans.length === 0) {
      console.log('\u26a0\ufe0f  No cached plans found, fetching from dLocal API...');

      const plansResponse = await fetch(`${dlocalApiUrl}/v1/subscription/plan/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${dlocalApiKey}`,
          'X-API-Secret': dlocalSecretKey,
          'Content-Type': 'application/json'
        }
      });

      if (!plansResponse.ok) {
        const errorText = await plansResponse.text();
        throw new Error(`Failed to fetch dLocal plans: ${plansResponse.status} - ${errorText}`);
      }

      const dlocalPlansData = await plansResponse.json();
      const apiPlans = dlocalPlansData.data || [];

      console.log(`\u2705 Found ${apiPlans.length} plans from API, caching them...`);

      // Cache the plans
      for (const plan of apiPlans) {
        const planData = {
          id: plan.id,
          merchant_id: plan.merchant_id,
          name: plan.name,
          description: plan.description || '',
          country: plan.country,
          currency: plan.currency,
          amount: plan.amount,
          frequency_type: plan.frequency_type,
          frequency_value: plan.frequency_value,
          active: plan.active,
          free_trial_days: plan.free_trial_days,
          plan_token: plan.plan_token,
          subscribe_url: plan.subscribe_url,
          dlocal_created_at: plan.created_at,
          dlocal_updated_at: plan.updated_at,
          synced_at: new Date().toISOString()
        };

        await supabase
          .from('dlocal_plans_cache')
          .upsert(planData, { onConflict: 'id' });
      }

      dlocalPlans = apiPlans;
    } else {
      console.log(`\u2705 Using ${cachedPlans.length} cached plans`);
    }

    if (dlocalPlans.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No plans found',
          stats: { total_synced: 0, created: 0, updated: 0, errors: 0 }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('\n\ud83d\udccb Step 2: Matching with database plans...');
    const { data: dbPlans, error: plansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('provider', 'dlocal')
      .not('provider_plan_id', 'is', null);

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      throw plansError;
    }

    console.log(`\ud83d\udccb Found ${dbPlans?.length || 0} dLocal plans in database`);

    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: any[] = [];

    console.log('\n\ud83d\udd04 Step 3: Syncing subscriptions...');
    for (const dlocalPlan of dlocalPlans) {
      try {
        const dbPlan = dbPlans?.find(p => p.provider_plan_id === String(dlocalPlan.id));

        if (!dbPlan) {
          console.log(`\u23ed\ufe0f  Skipping dLocal plan "${dlocalPlan.name}" (ID: ${dlocalPlan.id}) - not found in database`);
          continue;
        }

        console.log(`\n\ud83d\udd0d Fetching subscriptions for plan: ${dlocalPlan.name} (ID: ${dlocalPlan.id})`);

        const apiUrl = `${dlocalApiUrl}/v1/subscription/plan/${dlocalPlan.id}/subscription/all`;
        console.log(`\ud83d\udd17 API URL: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${dlocalApiKey}`,
            'X-API-Secret': dlocalSecretKey,
            'Content-Type': 'application/json'
          }
        });

        console.log(`\ud83d\udce1 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`\u274c Error fetching subscriptions for plan ${dlocalPlan.id}:`);
          console.error(`   Status: ${response.status} ${response.statusText}`);
          console.error(`   Response: ${errorText}`);
          errors.push({
            plan_id: dbPlan.id,
            plan_name: dlocalPlan.name,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText
          });
          continue;
        }

        const data = await response.json();
        const subscriptions: DLocalSubscription[] = data.data || [];

        console.log(`\u2705 Found ${subscriptions.length} subscriptions for plan ${dlocalPlan.name}`);

        for (const dlocalSub of subscriptions) {
          try {
            if (dlocalSub.status !== 'CONFIRMED' || !dlocalSub.active) {
              console.log(`\u23ed\ufe0f  Skipping subscription ${dlocalSub.id} (status: ${dlocalSub.status}, active: ${dlocalSub.active})`);
              continue;
            }

            const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

            if (userError) {
              console.error('Error listing users:', userError);
              continue;
            }

            const user = userData.users.find(u => u.email === dlocalSub.client_email);

            if (!user) {
              console.log(`\u26a0\ufe0f  User not found for email: ${dlocalSub.client_email}`);
              continue;
            }

            const internalStatus = mapDLocalStatus(dlocalSub.status);

            const currentPeriodStart = new Date(dlocalSub.created_at).toISOString();
            const scheduledDate = new Date(dlocalSub.scheduled_date);
            const currentPeriodEnd = scheduledDate.toISOString();

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
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  plan_id: dbPlan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_plan_id: String(dlocalPlan.id),
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
                console.log(`\u2705 Updated subscription for ${dlocalSub.client_email}`);
                totalUpdated++;
              }
            } else {
              const { error: insertError } = await supabase
                .from('subscriptions')
                .insert({
                  user_id: user.id,
                  plan_id: dbPlan.id,
                  status: internalStatus,
                  provider: 'dlocal',
                  provider_subscription_id: dlocalSub.subscription_token,
                  provider_plan_id: String(dlocalPlan.id),
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
                console.log(`\u2705 Created subscription for ${dlocalSub.client_email}`);
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
        console.error(`Error processing plan ${dlocalPlan.id}:`, planError);
        errors.push({
          plan_id: dlocalPlan.id,
          plan_name: dlocalPlan.name,
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

    console.log('\n\ud83d\udcca Sync Summary:', result.stats);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('\u274c Sync error:', error);

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
