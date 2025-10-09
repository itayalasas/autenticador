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

    for (const plan of dlocalPlans) {
      try {
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
            console.error(`Error updating plan ${plan.id}:`, error);
          } else {
            console.log(`\u2705 Updated plan: ${plan.name}`);
            updated++;
          }
        } else {
          const { error } = await supabase
            .from('dlocal_plans_cache')
            .insert(planData);

          if (error) {
            console.error(`Error inserting plan ${plan.id}:`, error);
          } else {
            console.log(`\u2705 Created plan: ${plan.name}`);
            created++;
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
        created,
        updated,
        skipped
      },
      timestamp: new Date().toISOString()
    };

    console.log('\ud83d\udcca Sync Summary:', result.stats);

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