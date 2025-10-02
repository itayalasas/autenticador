import { supabase } from '../lib/supabase';
import { Subscription, SubscriptionPlan, PaymentMethod } from '../types';
import { dLocalService } from './dLocalService';

export const subscriptionService = {
  // Get all available subscription plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      // First try to get plans from DLocal API
      try {
        const dLocalPlans = await dLocalService.getSubscriptionPlans();
        
        // Convert DLocal plans to internal format
        const convertedPlans = dLocalPlans.map(plan => dLocalService.convertToInternalPlan(plan));
        
        // Add free plan
        const freePlan = {
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
            environments: ['development'],
            support_level: 'basic'
          }
        };
        
        return [freePlan, ...convertedPlans];
      } catch (dLocalError) {
        console.warn('DLocal API not available, using fallback plans');
        // Return only free plan and fallback plans if DLocal fails
        const freePlan = {
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
            environments: ['development'],
            support_level: 'basic'
          }
        };

        // Use fallback DLocal plans
        const fallbackDLocalPlans = dLocalService.getFallbackPlans();
        const convertedFallbackPlans = fallbackDLocalPlans.map(plan => dLocalService.convertToInternalPlan(plan));
        
        return [freePlan, ...convertedFallbackPlans];
      }
    } catch (error) {
      console.error('Error loading DLocal plans, using fallback:', error);
      
      // Fallback to database plans if DLocal fails
      const { data, error: dbError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (dbError) throw dbError;
      return data || [];
    }
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

  // Create basic subscription automatically for new users
  async createBasicSubscription(): Promise<Subscription> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('🔄 Creating basic subscription for user:', user.id);

    // Get or create basic plan in database
    let { data: basicPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', 'Básico')
      .eq('price', 0)
      .single();

    if (planError || !basicPlan) {
      console.log('📝 Creating basic plan in database...');
      // Create basic plan if it doesn't exist
      const { data: newPlan, error: createPlanError } = await supabase
        .from('subscription_plans')
        .insert({
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
            environments: ['development'],
            support_level: 'basic'
          },
          is_popular: false,
          trial_days: 0,
          is_active: true
        })
        .select()
        .single();

      if (createPlanError) {
        console.error('❌ Error creating basic plan:', createPlanError);
        throw createPlanError;
      }
      
      basicPlan = newPlan;
      console.log('✅ Basic plan created in database:', basicPlan);
    }

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_id: basicPlan.id,
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

    // For free plan, create subscription directly
    if (plan.price === 0) {
      // Cancel any existing subscriptions first
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

      const trialEnd = plan.trial_days > 0 
        ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000)
        : null;

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: plan.trial_days > 0 ? 'trialing' : 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year for free plan
          trial_end: trialEnd?.toISOString()
        })
        .select()
        .single();

      if (subError) throw subError;
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
      apiKey: import.meta.env.VITE_DLOCAL_API_KEY,
      secretKey: import.meta.env.VITE_DLOCAL_SECRET_KEY,
      environment: import.meta.env.VITE_DLOCAL_ENVIRONMENT || 'sandbox'
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
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription', current: 0, limit: 0 };
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return { allowed: false, reason: 'No plan found', current: 0, limit: 0 };
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
    const subscription = await this.getCurrentSubscription();
    if (!subscription) {
      // Allow development for free users, block testing and production
      return environment === 'development';
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      return environment === 'development';
    }

    // Check if subscription is active
    if (!['active', 'trialing'].includes(subscription.status)) {
      return environment === 'development';
    }

    // Check if subscription hasn't expired
    if (new Date(subscription.current_period_end) < new Date()) {
      return environment === 'development';
    }

    // Verificar acceso por plan
    switch (plan.name.toLowerCase()) {
      case 'básico':
        return environment === 'development';
      case 'profesional':
        return ['development', 'testing', 'production'].includes(environment);
      case 'empresarial':
        return ['development', 'testing', 'production'].includes(environment);
      default:
        return environment === 'development';
    }
  },

  // Check if user can access feature
  async canAccessFeature(feature: string): Promise<boolean> {
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
  }
}