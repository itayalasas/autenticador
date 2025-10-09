import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

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
    frequency_type: string;
    frequency_value: number;
    active: boolean;
    free_trial_days: number;
    created_at: string;
    updated_at: string;
    subscribe_url: string;
  };
  subscription_token: string;
  status: string;
  payment_method_code: string;
  client_id: string;
  client_first_name: string;
  client_last_name: string;
  client_document_type: string;
  client_document: string;
  client_email: string;
  language: string;
  card_token: string;
  dlocal_account_type: string;
  scheduled_date: string;
  active: boolean;
  country: string;
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
      console.warn('Invalid cron secret provided');
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

    if (dlocalApiUrl.includes('api.dlocalgo.com') && !dlocalApiUrl.includes('sbx')) {
      console.warn('Production URL detected, forcing sandbox environment');
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    console.log('=== Starting dLocal Subscription Sync ===');
    console.log('API URL:', dlocalApiUrl);

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured');
    }

    // Step 1: Get cached plans
    console.log('\n[Step 1] Fetching cached plans...');
    const { data: cachedPlans, error: plansError } = await supabase
      .from('dlocal_plans_cache')
      .select('*')
      .eq('active', true);

    if (plansError || !cachedPlans || cachedPlans.length === 0) {
      throw new Error('No active plans found in cache. Run sync-dlocal-plans first.');
    }

    console.log(`Found ${cachedPlans.length} active plans in cache`);

    // Step 2: Get database subscription plans
    console.log('\n[Step 2] Fetching subscription plans from database...');
    const { data: dbPlans, error: dbPlansError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('provider', 'dlocal')
      .not('provider_plan_id', 'is', null);

    if (dbPlansError) {
      throw dbPlansError;
    }

    console.log(`Found ${dbPlans?.length || 0} dLocal plans in subscription_plans table`);

    let totalProcessed = 0;
    let totalCached = 0;
    let totalSynced = 0;
    let totalUpdated = 0;
    const errors: any[] = [];

    // Step 3: Fetch and cache subscriptions from dLocal
    console.log('\n[Step 3] Fetching subscriptions from dLocal API...');

    for (const dlocalPlan of cachedPlans) {
      try {
        console.log(`\n--- Processing plan: ${dlocalPlan.name} (ID: ${dlocalPlan.id}) ---`);

        const apiUrl = `${dlocalApiUrl}/v1/subscription/plan/${dlocalPlan.id}/subscription/all`;

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${dlocalApiKey}`,
            'X-API-Secret': dlocalSecretKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ERROR: Failed to fetch subscriptions for plan ${dlocalPlan.id}`);
          console.error(`Status: ${response.status} - ${errorText}`);
          errors.push({
            plan_id: dlocalPlan.id,
            plan_name: dlocalPlan.name,
            error: `HTTP ${response.status}`,
            details: errorText
          });
          continue;
        }

        const data = await response.json();
        const subscriptions: DLocalSubscription[] = data.data || [];

        console.log(`Found ${subscriptions.length} subscription(s) for plan ${dlocalPlan.name}`);

        // Cache subscriptions
        for (const sub of subscriptions) {
          try {
            totalProcessed++;

            // Check if subscription already exists in cache
            const { data: existingCache } = await supabase
              .from('dlocal_subscriptions_cache')
              .select('id')
              .eq('id', sub.id)
              .maybeSingle();

            const cacheData = {
              id: sub.id,
              subscription_token: sub.subscription_token,
              plan_id: dlocalPlan.id,
              status: sub.status,
              payment_method_code: sub.payment_method_code,
              client_id: sub.client_id,
              client_first_name: sub.client_first_name,
              client_last_name: sub.client_last_name,
              client_document_type: sub.client_document_type,
              client_document: sub.client_document,
              client_email: sub.client_email,
              language: sub.language,
              card_token: sub.card_token,
              dlocal_account_type: sub.dlocal_account_type,
              scheduled_date: sub.scheduled_date,
              active: sub.active,
              country: sub.country,
              dlocal_created_at: sub.created_at,
              dlocal_updated_at: sub.updated_at,
              raw_data: sub,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (existingCache) {
              // Update existing cache
              const { error: updateError } = await supabase
                .from('dlocal_subscriptions_cache')
                .update(cacheData)
                .eq('id', sub.id);

              if (updateError) {
                console.error(`ERROR updating cache for subscription ${sub.id}:`, updateError);
              } else {
                console.log(`  ✓ Updated cache: ${sub.client_email} - ${sub.status}`);
              }
            } else {
              // Insert new cache
              const { error: insertError } = await supabase
                .from('dlocal_subscriptions_cache')
                .insert(cacheData);

              if (insertError) {
                console.error(`ERROR caching subscription ${sub.id}:`, insertError);
              } else {
                console.log(`  ✓ Cached new: ${sub.client_email} - ${sub.status}`);
                totalCached++;
              }
            }

          } catch (cacheError: any) {
            console.error(`ERROR processing subscription ${sub.id}:`, cacheError.message);
            errors.push({
              subscription_id: sub.id,
              error: cacheError.message
            });
          }
        }

      } catch (planError: any) {
        console.error(`ERROR processing plan ${dlocalPlan.id}:`, planError.message);
        errors.push({
          plan_id: dlocalPlan.id,
          plan_name: dlocalPlan.name,
          error: planError.message
        });
      }
    }

    // Step 4: Sync cached subscriptions to subscriptions table
    console.log('\n[Step 4] Syncing cached subscriptions to subscriptions table...');

    // Get all users from auth system once
    const { data: { users: allUsers }, error: allUsersError } = await supabase.auth.admin.listUsers();

    if (allUsersError) {
      console.error('ERROR fetching users from auth system:', allUsersError);
      throw allUsersError;
    }

    console.log(`\nRegistered users in auth system (${allUsers.length}):`);
    allUsers.forEach(u => {
      console.log(`  - ${u.email} (ID: ${u.id})`);
    });

    const { data: cachedSubs, error: cachedSubsError } = await supabase
      .from('dlocal_subscriptions_cache')
      .select('*');

    if (cachedSubsError) {
      console.error('ERROR fetching cached subscriptions:', cachedSubsError);
    } else {
      console.log(`\nProcessing ${cachedSubs?.length || 0} cached subscriptions...`);

      for (const cachedSub of cachedSubs || []) {
        try {
          // Only process if we find a user with EXACT email match
          const user = allUsers.find(u => u.email?.toLowerCase() === cachedSub.client_email?.toLowerCase());

          if (!user) {
            console.log(`  ⊘ Skipping: ${cachedSub.client_email} (not registered in auth system)`);
            continue;
          }

          console.log(`  ✓ Processing: ${user.email} (ID: ${user.id})`)

          // Find matching database plan
          const dbPlan = dbPlans?.find(p => p.provider_plan_id === String(cachedSub.plan_id));

          if (!dbPlan) {
            console.log(`  ⊘ Plan not found in database: ${cachedSub.plan_id}`);
            continue;
          }

          console.log(`\n  Processing: ${cachedSub.client_email}`);
          console.log(`    Status: ${cachedSub.status}, Active: ${cachedSub.active}`);

          const internalStatus = mapDLocalStatus(cachedSub.status);
          const isNotCompleted = cachedSub.status !== 'CONFIRMED' || !cachedSub.active;

          if (isNotCompleted) {
            console.log(`    ⚠ Not completed - deactivating user's active subscriptions`);

            const { error: deactivateError } = await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancel_at_period_end: true,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('status', 'active');

            if (deactivateError) {
              console.error('    ERROR deactivating:', deactivateError);
            } else {
              console.log(`    ✓ Deactivated active subscriptions`);
            }
            continue;
          }

          // Check if subscription already exists
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('provider_subscription_id', cachedSub.subscription_token)
            .maybeSingle();

          // Deactivate other active subscriptions
          const { data: otherActiveSubs } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .neq('provider_subscription_id', cachedSub.subscription_token);

          if (otherActiveSubs && otherActiveSubs.length > 0) {
            console.log(`    🔄 Deactivating ${otherActiveSubs.length} old subscription(s)`);

            await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancel_at_period_end: true,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
              .eq('status', 'active')
              .neq('provider_subscription_id', cachedSub.subscription_token);
          }

          const currentPeriodStart = new Date(cachedSub.dlocal_created_at).toISOString();
          const currentPeriodEnd = new Date(cachedSub.scheduled_date).toISOString();

          const subscriptionData = {
            user_id: user.id,
            plan_id: dbPlan.id,
            status: internalStatus,
            provider: 'dlocal',
            provider_subscription_id: cachedSub.subscription_token,
            provider_plan_id: String(cachedSub.plan_id),
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancelled_at: null,
            cancel_at_period_end: false,
            metadata: {
              dlocal_id: cachedSub.id,
              client_id: cachedSub.client_id,
              payment_method_code: cachedSub.payment_method_code,
              dlocal_status: cachedSub.status,
              dlocal_active: cachedSub.active,
              client_name: `${cachedSub.client_first_name} ${cachedSub.client_last_name}`,
              last_synced: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          };

          if (existingSub) {
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update(subscriptionData)
              .eq('id', existingSub.id);

            if (updateError) {
              console.error('    ERROR updating subscription:', updateError);
              errors.push({
                user_email: cachedSub.client_email,
                error: updateError.message
              });
            } else {
              console.log(`    ✓ Updated subscription`);
              totalUpdated++;
            }
          } else {
            const { error: insertError } = await supabase
              .from('subscriptions')
              .insert(subscriptionData);

            if (insertError) {
              console.error('    ERROR creating subscription:', insertError);
              errors.push({
                user_email: cachedSub.client_email,
                error: insertError.message
              });
            } else {
              console.log(`    ✓ Created subscription`);
              totalSynced++;
            }
          }

        } catch (syncError: any) {
          console.error(`  ERROR syncing subscription ${cachedSub.id}:`, syncError.message);
          errors.push({
            subscription_id: cachedSub.id,
            error: syncError.message
          });
        }
      }
    }

    const result = {
      success: true,
      message: 'Subscription sync completed',
      stats: {
        total_processed: totalProcessed,
        total_cached: totalCached,
        total_synced: totalSynced,
        total_updated: totalUpdated,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log('\n=== Sync Summary ===');
    console.log('Processed:', totalProcessed);
    console.log('Cached:', totalCached);
    console.log('Created:', totalSynced);
    console.log('Updated:', totalUpdated);
    console.log('Errors:', errors.length);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('SYNC ERROR:', error);

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
