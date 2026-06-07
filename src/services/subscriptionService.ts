import { supabase } from '../lib/supabase';
import { Subscription, SubscriptionPlan, PaymentMethod } from '../types';
import { dLocalService } from './dLocalService';
import { getEnvVariable } from './envConfigService';

export const subscriptionService = {
  // Get all available subscription plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      // Get plans directly from subscription_plans table
      const { data: plans, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) {
        console.error('Error loading plans from database:', error);
        throw error;
      }

      if (!plans || plans.length === 0) {
        console.warn('No plans found in database, returning basic plan only');

        // Return basic plan as fallback
        return [{
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Básico',
          description: 'Perfecto para comenzar y desarrollo',
          price: 0,
          currency: 'USD',
          interval: 'month',
          trial_days: 0,
          is_active: true,
          is_popular: false,
          features: [
            'Ambiente Development únicamente',
            '1 aplicación',
            'Hasta 100 usuarios',
            '10,000 requests API por mes',
            'Soporte comunitario'
          ],
          limits: {
            applications: 1,
            users_per_app: 100,
            api_requests_per_month: 10000,
            api_keys_per_environment: 1,
            environments: ['development'],
            support_level: 'basic'
          }
        }];
      }

      // Transform database plans to internal format
      return plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: Number(plan.price),
        currency: plan.currency,
        interval: plan.interval,
        trial_days: plan.trial_days || 0,
        is_active: plan.is_active,
        is_popular: plan.is_popular || false,
        features: Array.isArray(plan.features) ? plan.features : [],
        limits: plan.limits || {},
        provider: plan.provider,
        provider_plan_id: plan.provider_plan_id,
        provider_metadata: plan.provider_metadata
      }));
    } catch (error) {
      console.error('Error loading subscription plans:', error);

      // Ultimate fallback: return only basic plan
      return [{
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Básico',
        description: 'Perfecto para comenzar y desarrollo',
        price: 0,
        currency: 'USD',
        interval: 'month',
        trial_days: 0,
        is_active: true,
        is_popular: false,
        features: [
          'Ambiente Development únicamente',
          '1 aplicación',
          'Hasta 100 usuarios',
          '10,000 requests API por mes',
          'Soporte comunitario'
        ],
        limits: {
          applications: 1,
          users_per_app: 100,
          api_requests_per_month: 10000,
          api_keys_per_environment: 1,
          environments: ['development'],
          support_level: 'basic'
        }
      }];
    }
  },

  // Get current user
  async getCurrentUser() {
    return await supabase.auth.getUser();
  },

  // Get current user subscription
  async getCurrentSubscription(): Promise<Subscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Ensure basic plan exists in database
  async ensureBasicPlanExists(): Promise<string> {
    const basicPlanId = '00000000-0000-0000-0000-000000000000';

    // Check if basic plan exists
    const { data: existingPlan, error: checkError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('id', basicPlanId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for basic plan:', checkError);
      throw checkError;
    }

    // If plan exists, return its ID
    if (existingPlan) {
      return basicPlanId;
    }

    // If plan doesn't exist, create it
    console.log('📝 Creating basic plan in database...');
    const { data: newPlan, error: createError } = await supabase
      .from('subscription_plans')
      .insert({
        id: basicPlanId,
        name: 'Básico',
        description: 'Perfecto para comenzar y desarrollo',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          'Ambiente Development únicamente',
          '1 aplicación',
          'Hasta 100 usuarios',
          '10,000 requests API por mes',
          'Soporte comunitario'
        ],
        limits: {
          applications: 1,
          users_per_app: 100,
          api_requests_per_month: 10000,
          api_keys_per_environment: 1,
          environments: ['development'],
          support_level: 'basic'
        },
        is_popular: false,
        trial_days: 0,
        is_active: true
      })
      .select('id')
      .single();

    if (createError) {
      console.error('❌ Error creating basic plan:', createError);
      throw createError;
    }

    console.log('✅ Basic plan created in database');
    return newPlan.id;
  },

  // Create basic subscription automatically for new users
  async createBasicSubscription(): Promise<Subscription> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('🔄 Creating basic subscription for user:', user.id);

    // Ensure basic plan exists
    const basicPlanId = await this.ensureBasicPlanExists();

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: basicPlanId,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        metadata: {
          auto_created: true,
          created_at: new Date().toISOString()
        }
      })
      .select(`
        *,
        subscription_plans(*)
      `)
      .single();

    if (subError) {
      console.error('❌ Error creating basic subscription:', subError);
      throw subError;
    }

    console.log('✅ Basic subscription created successfully:', subscription);
    return subscription;
  },

  // Create subscription with DLocal
  async createSubscription(planId: string, paymentMethodId?: string): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get plan details from DLocal or database
    const plans = await this.getSubscriptionPlans();
    const plan = plans.find(p => p.id === planId);

    if (!plan) throw new Error('Plan not found');

    // For free plan (Basic), create subscription directly without DLocal
    if (plan.price === 0) {
      console.log('Creating free basic subscription for user:', user.id);

      // Ensure basic plan exists in database
      const basicPlanId = await this.ensureBasicPlanExists();

      // Cancel any existing subscriptions first
      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing', 'pending']);

      if (cancelError) {
        console.warn('Could not cancel existing subscriptions:', cancelError);
      }

      // Create new basic subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_id: basicPlanId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year for free plan
          metadata: {
            plan_name: 'Básico',
            internal: true,
            created_via: 'manual_selection'
          }
        })
        .select(`
          *,
          subscription_plans(*)
        `)
        .single();

      if (subError) {
        console.error('Error creating basic subscription:', subError);
        throw subError;
      }

      console.log('Basic subscription created successfully:', subscription);
      return subscription;
    }

    // For paid plans, redirect to DLocal checkout
    const dLocalResult = await dLocalService.createSubscription(planId, {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email
    });
    
    // Create pending subscription record (will be activated after payment)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: planId,
        status: 'pending',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (plan.interval === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        dlocal_subscription_id: dLocalResult.plan.plan_token,
        metadata: {
          dlocal_plan_token: dLocalResult.plan.plan_token,
          checkout_url: dLocalResult.checkout_url,
          original_amount: dLocalResult.plan.amount,
          original_currency: dLocalResult.plan.currency
        }
      })
      .select()
      .single();

    if (subError) throw subError;
    return {
      subscription,
      checkout_url: dLocalResult.checkout_url,
      requires_payment: true
    };
  },

  // Create DLocal subscription
  async createDLocalSubscription(plan: SubscriptionPlan, user: any, paymentMethodId?: string) {
    // DLocal API integration
    const dLocalConfig = {
      apiKey: getEnvVariable('VITE_DLOCAL_API_KEY'),
      secretKey: getEnvVariable('VITE_DLOCAL_SECRET_KEY'),
      environment: getEnvVariable('VITE_DLOCAL_ENVIRONMENT') || 'sandbox'
    };

    const paymentData = {
      amount: plan.price,
      currency: plan.currency,
      country: 'US', // Default, should be detected from user
      payment_method_id: paymentMethodId,
      order_id: `sub_${Date.now()}_${user.id}`,
      description: `Suscripción ${plan.name} - AuthSystem`,
      notification_url: `${window.location.origin}/api/webhooks/dlocal`,
      callback_url: `${window.location.origin}/subscription/success`,
      customer: {
        id: user.id,
        name: user.user_metadata?.name || user.email,
        email: user.email
      },
      subscription: {
        plan_id: plan.id,
        interval: plan.interval,
        trial_days: plan.trial_days
      }
    };

    // In a real implementation, this would call DLocal API
    // For now, simulate the response
    return {
      subscription_id: `dlocal_sub_${Date.now()}`,
      payment_id: `dlocal_pay_${Date.now()}`,
      payment_method: 'card',
      status: 'active',
      payment_url: `https://checkout.dlocal.com/pay/${Date.now()}`
    };
  },

  // Activate subscription after successful DLocal payment
  async activateSubscription(planToken: string, subscriptionData: any): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get plan details
    const plans = await this.getSubscriptionPlans();
    const plan = plans.find(p => p.plan_token === planToken || p.id === planToken);

    if (!plan) throw new Error('Plan not found');

    // Cancel any existing active subscriptions
    const { error: cancelError } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing']);

    if (cancelError) {
      console.warn('Could not cancel existing subscriptions:', cancelError);
    }

    // Create new active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (plan.interval === 'year' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
        dlocal_subscription_id: planToken,
        metadata: {
          dlocal_plan_token: planToken,
          payment_completed_at: new Date().toISOString(),
          original_amount: subscriptionData.plan_amount || plan.original_amount,
          original_currency: subscriptionData.plan_currency || plan.original_currency
        }
      })
      .select()
      .single();

    if (subError) throw subError;
    return subscription;
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        cancelled_at: cancelAtPeriodEnd ? null : new Date().toISOString(),
        status: cancelAtPeriodEnd ? 'active' : 'cancelled'
      })
      .eq('id', subscriptionId);

    if (error) throw error;
  },

  // Check if user can create more applications
  async canCreateApplication(): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    let subscription = await this.getCurrentSubscription();
    if (!subscription) {
      try {
        console.log('ℹ️ No active subscription found. Creating free basic subscription automatically...');
        subscription = await this.createBasicSubscription();
      } catch (error) {
        console.error('❌ Error auto-creating basic subscription:', error);
        return {
          allowed: false,
          reason: 'No se pudo activar el plan Básico gratuito automáticamente',
          current: 0,
          limit: 0
        };
      }
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return { allowed: false, reason: 'No se encontró un plan asociado a la suscripción', current: 0, limit: 0 };
    }

    // Get current application count
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { count: currentApps, error } = await supabase
      .from('applications')
      .select('id', { count: 'exact' })
      .eq('owner_id', user.id)
      .eq('status', 'active');

    if (error) throw error;

    const current = currentApps || 0;
    const limit = plan.limits.applications;

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
      reason: limit !== -1 && current >= limit ? `Has alcanzado el límite de ${limit} aplicaciones` : undefined
    };
  },

  // Check if user can create more users in an application
  async canCreateUser(applicationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription', current: 0, limit: 0 };
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return { allowed: false, reason: 'No plan found', current: 0, limit: 0 };
    }

    // Get current user count for this application
    const { count: currentUsers, error } = await supabase
      .from('app_users')
      .select('id', { count: 'exact' })
      .eq('application_id', applicationId)
      .in('status', ['active', 'pending']);

    if (error) throw error;

    const current = currentUsers || 0;
    const limit = plan.limits.users_per_app;

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
      reason: limit !== -1 && current >= limit ? `Has alcanzado el límite de ${limit} usuarios por aplicación` : undefined
    };
  },

  // Check if user can make more API requests this month
  async canMakeApiRequest(): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription', current: 0, limit: 0 };
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return { allowed: false, reason: 'No plan found', current: 0, limit: 0 };
    }

    // Get current API request count for this month
    const usage = await this.getCurrentUsage();
    const current = usage.api_requests || 0;
    const limit = plan.limits.api_requests_per_month;

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
      reason: limit !== -1 && current >= limit ? `Has alcanzado el límite de ${limit} requests API este mes` : undefined
    };
  },

  // Check if user can access specific environment
  async canAccessEnvironment(environment: string): Promise<boolean> {
    // TEMPORARY: Subscription validation disabled - always allow access
    console.log('⚠️  Subscription validation DISABLED - allowing access to', environment);
    return true;

    /* ORIGINAL CODE - COMMENTED OUT FOR DEPLOYMENT
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      // Allow development for free users, block testing and production
      console.log('🔍 No subscription found, allowing development only');
      return environment === 'development';
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      console.log('🔍 No plan found in subscription, allowing development only');
      return environment === 'development';
    }

    console.log('🔍 Checking environment access:', {
      environment,
      plan_name: plan.name,
      plan_limits: plan.limits,
      environments: plan.limits?.environments,
      status: subscription.status,
      period_end: subscription.current_period_end
    });

    // Check if subscription is active
    if (!['active', 'trialing'].includes(subscription.status)) {
      console.log('🔍 Subscription not active, allowing development only');
      return environment === 'development';
    }

    // Check if subscription hasn't expired
    if (new Date(subscription.current_period_end) < new Date()) {
      console.log('🔍 Subscription expired, allowing development only');
      return environment === 'development';
    }

    // Check if plan has limits defined
    if (!plan.limits || !plan.limits.environments) {
      // If no limits defined, allow only development
      console.log('🔍 No limits or environments defined, allowing development only');
      return environment === 'development';
    }

    // Check if environment is in the allowed environments list
    const hasAccess = plan.limits.environments.includes(environment);
    console.log(`🔍 Environment ${environment} access:`, hasAccess, 'Available:', plan.limits.environments);
    return hasAccess;
    */
  },

  // Check if user can access feature
  async canAccessFeature(feature: string): Promise<boolean> {
    // TEMPORARY: Subscription validation disabled - always allow access
    console.log('⚠️  Subscription validation DISABLED - allowing feature', feature);
    return true;

    /* ORIGINAL CODE - COMMENTED OUT FOR DEPLOYMENT
    const subscription = await this.getCurrentSubscription();
    if (!subscription) return false;

    const plan = subscription.subscription_plans;
    if (!plan) return false;

    // Check if subscription is active
    if (!['active', 'trialing'].includes(subscription.status)) return false;

    // Check if subscription hasn't expired
    if (new Date(subscription.current_period_end) < new Date()) return false;

    // Check feature access based on plan
    switch (feature) {
      case 'production_api_keys':
        return plan.limits.environments?.includes('production') || false;
      case 'custom_branding':
        return plan.price > 0;
      case 'webhooks':
        return plan.price > 0;
      case 'analytics':
        return plan.price > 0;
      case 'priority_support':
        return plan.limits.support_level === 'priority' || plan.limits.support_level === 'dedicated';
      default:
        return true;
    }
    */
  },

  // Get usage for current period
  async getCurrentUsage(): Promise<Record<string, number>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const subscription = await this.getCurrentSubscription();
    if (!subscription) return {};

    const { data: usage, error } = await supabase
      .from('usage_tracking')
      .select('metric_name, metric_value')
      .eq('user_id', user.id)
      .eq('subscription_id', subscription.id)
      .gte('period_start', subscription.current_period_start)
      .lte('period_end', subscription.current_period_end);

    if (error) throw error;

    const usageMap: Record<string, number> = {};
    usage?.forEach(u => {
      usageMap[u.metric_name] = u.metric_value;
    });

    return usageMap;
  },

  // Track usage
  async trackUsage(metric: string, value: number = 1): Promise<void> {
  },

  // Check if user can create more API keys in the specified environment
  async canCreateApiKey(applicationId: string, environment: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription', current: 0, limit: 0 };
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return { allowed: false, reason: 'No plan found', current: 0, limit: 0 };
    }

    // Check if user can access this environment
    const canAccess = await this.canAccessEnvironment(environment);
    if (!canAccess) {
      return {
        allowed: false,
        reason: `El ambiente ${environment} no está disponible en tu plan. Actualiza a un plan superior para acceder.`,
        current: 0,
        limit: 0
      };
    }

    // Get current API key count for this application and environment
    const { count: currentKeys, error } = await supabase
      .from('api_keys')
      .select('id', { count: 'exact' })
      .eq('application_id', applicationId)
      .eq('environment', environment)
      .eq('is_active', true);

    if (error) throw error;

    const current = currentKeys || 0;
    const limit = plan.limits.api_keys_per_environment || -1;

    return {
      allowed: limit === -1 || current < limit,
      current,
      limit,
      reason: limit !== -1 && current >= limit ? `Has alcanzado el límite de ${limit} API key${limit > 1 ? 's' : ''} por ambiente en el plan ${plan.name}. Actualiza tu plan para crear más.` : undefined
    };
  },

  // Get payment methods (placeholder for future DLocal integration)
  async getPaymentMethods(): Promise<any[]> {
    return [];
  },

  // Get invoices (placeholder for future DLocal integration)
  async getInvoices(): Promise<any[]> {
    return [];
  },

  // Poll for subscription activation after payment
  async pollForSubscriptionActivation(options: {
    maxAttempts?: number;
    intervalMs?: number;
    onProgress?: (attempt: number, maxAttempts: number) => void;
  } = {}): Promise<Subscription | null> {
    const {
      maxAttempts = 24,
      intervalMs = 5000,
      onProgress
    } = options;

    console.log('🔄 Iniciando polling para activación de suscripción...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (onProgress) {
        onProgress(attempt, maxAttempts);
      }

      try {
        const subscription = await this.getCurrentSubscription();

        if (subscription && subscription.status === 'active' && subscription.plan_id !== '00000000-0000-0000-0000-000000000000') {
          console.log(`✅ Suscripción activa encontrada en intento ${attempt}/${maxAttempts}`);
          return subscription;
        }

        console.log(`⏳ Intento ${attempt}/${maxAttempts}: Suscripción aún no activa, esperando ${intervalMs /1000}s...`);
      } catch (error) {
        console.error(`Error en intento ${attempt}:`, error);
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    console.log('⚠️  Tiempo de espera agotado. La suscripción se activará cuando el webhook sea procesado.');
    return null;
  }
}
