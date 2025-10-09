import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DLocalPlan {
  id: number;
  merchant_id: number;
  name: string;
  description: string;
  country: string;
  currency: string;
  amount: number;
  frequency_type: 'MONTHLY' | 'YEARLY';
  frequency_value: number;
  active: boolean;
  free_trial_days: number;
  plan_token: string;
  created_at: string;
  updated_at: string;
  subscribe_url: string;
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
      console.warn('\u26a0\ufe0f Production URL detected, forcing sandbox environment');
      dlocalApiUrl = 'https://api-sbx.dlocalgo.com';
    }

    console.log('\ud83d\udd04 Syncing dLocal plans...');
    console.log('\ud83d\udccd API URL:', dlocalApiUrl);

    if (!dlocalApiKey || !dlocalSecretKey) {
      throw new Error('dLocal API credentials not configured');
    }

    console.log('\ud83d\udccb Fetching plans from dLocal API...');
    const response = await fetch(`${dlocalApiUrl}/v1/subscription/plan/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${dlocalApiKey}`,
        'X-API-Secret': dlocalSecretKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch dLocal plans: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const dlocalPlans: DLocalPlan[] = data.data || [];

    console.log(`\u2705 Found ${dlocalPlans.length} plans from dLocal`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let syncedToSubscriptionPlans = 0;

    for (const plan of dlocalPlans) {
      try {
        // Step 1: Sync to dlocal_plans_cache
        const { data: existingPlan } = await supabase
          .from('dlocal_plans_cache')
          .select('id, dlocal_updated_at')
          .eq('id', plan.id)
          .maybeSingle();

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

        if (existingPlan) {
          const { error } = await supabase
            .from('dlocal_plans_cache')
            .update(planData)
            .eq('id', plan.id);

          if (error) {
            console.error(`Error updating plan ${plan.id} in cache:`, error);
          } else {
            console.log(`  ✓ Updated cache: ${plan.name}`);
            updated++;
          }
        } else {
          const { error } = await supabase
            .from('dlocal_plans_cache')
            .insert(planData);

          if (error) {
            console.error(`Error inserting plan ${plan.id} in cache:`, error);
          } else {
            console.log(`  ✓ Created cache: ${plan.name}`);
            created++;
          }
        }

        // Step 2: Sync to subscription_plans table
        const { data: existingSubscriptionPlan } = await supabase
          .from('subscription_plans')
          .select('id, provider_plan_id')
          .eq('provider', 'dlocal')
          .eq('provider_plan_id', plan.id.toString())
          .maybeSingle();

        const subscriptionPlanData = {
          name: plan.name,
          description: plan.description || `Plan ${plan.name} - ${plan.currency} ${plan.amount}/${plan.frequency_type.toLowerCase()}`,
          price: plan.amount,
          currency: plan.currency,
          interval: plan.frequency_type === 'MONTHLY' ? 'month' : 'year',
          features: [
            `${plan.currency} ${plan.amount} / ${plan.frequency_type.toLowerCase()}`,
            plan.free_trial_days > 0 ? `${plan.free_trial_days} días de prueba gratis` : 'Sin prueba gratuita',
            `País: ${plan.country}`
          ],
          limits: {
            country: plan.country,
            frequency_value: plan.frequency_value
          },
          is_active: plan.active,
          provider: 'dlocal',
          provider_plan_id: plan.id.toString(),
          provider_metadata: {
            plan_token: plan.plan_token,
            subscribe_url: plan.subscribe_url,
            merchant_id: plan.merchant_id,
            dlocal_created_at: plan.created_at,
            dlocal_updated_at: plan.updated_at
          },
          trial_days: plan.free_trial_days,
          updated_at: new Date().toISOString()
        };

        if (existingSubscriptionPlan) {
          const { error: updateError } = await supabase
            .from('subscription_plans')
            .update(subscriptionPlanData)
            .eq('id', existingSubscriptionPlan.id);

          if (updateError) {
            console.error(`  ⚠️  Error updating subscription_plan ${plan.id}:`, updateError);
          } else {
            console.log(`  ✓ Updated subscription_plan: ${plan.name}`);
            syncedToSubscriptionPlans++;
          }
        } else {
          const { error: insertError } = await supabase
            .from('subscription_plans')
            .insert({
              ...subscriptionPlanData,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error(`  ⚠️  Error creating subscription_plan ${plan.id}:`, insertError);
          } else {
            console.log(`  ✓ Created subscription_plan: ${plan.name}`);
            syncedToSubscriptionPlans++;
          }
        }

      } catch (error: any) {
        console.error(`Error processing plan ${plan.id}:`, error);
        skipped++;
      }
    }

    const result = {
      success: true,
      message: 'Plans sync completed',
      stats: {
        total: dlocalPlans.length,
        cache: {
          created,
          updated,
          skipped
        },
        subscription_plans: {
          synced: syncedToSubscriptionPlans
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('\n📊 Sync Summary:');
    console.log('  Cache:', result.stats.cache);
    console.log('  Subscription Plans:', result.stats.subscription_plans);

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