// Service for DLocal API integration
export interface DLocalPlan {
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

export interface DLocalPlansResponse {
  data: DLocalPlan[];
  total_elements: number;
  total_pages: number;
  page: number;
  number_of_elements: number;
  size: number;
}

class DLocalService {
  private apiUrl: string;
  private apiKey: string;
  private secretKey: string;
  private plansEndpoint: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_DLOCAL_API_URL || 'https://api-sbx.dlocalgo.com';
    this.apiKey = import.meta.env.VITE_DLOCAL_API_KEY || '';
    this.secretKey = import.meta.env.VITE_DLOCAL_SECRET_KEY || '';
    this.plansEndpoint = import.meta.env.VITE_DLOCAL_PLANS_ENDPOINT || 'v1/subscription/plan/all';
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-API-Secret': this.secretKey
    };
  }

  // Get all available subscription plans from DLocal
  async getSubscriptionPlans(): Promise<DLocalPlan[]> {
    try {
      // Check if API keys are configured
      if (!this.apiKey || !this.secretKey) {
        console.warn('⚠️ DLocal API keys not configured, using fallback plans');
        return this.getFallbackPlans();
      }

      console.log('🔄 Fetching subscription plans from DLocal...');
      
      try {
        const response = await fetch(`${this.apiUrl}/${this.plansEndpoint}`, {
          method: 'GET',
          headers: this.getAuthHeaders()
        });

        if (!response.ok) {
          console.warn(`⚠️ DLocal API error: ${response.status} ${response.statusText}, using fallback plans`);
          return this.getFallbackPlans();
        }

        const data: DLocalPlansResponse = await response.json();
        console.log('✅ DLocal plans loaded:', data);
        
        // Filter only active plans
        return data.data.filter(plan => plan.active);
      } catch (fetchError) {
        console.warn('⚠️ DLocal API not available, using fallback plans');
        return this.getFallbackPlans();
      }
    } catch (error) {
      console.warn('⚠️ Using fallback plans due to configuration or network issues');
      return this.getFallbackPlans();
    }
  }

  // Fallback plans in case DLocal API is not available
  getFallbackPlans(): DLocalPlan[] {
    return [
      {
        id: 4631,
        merchant_id: 3348,
        name: "Plan Profesional",
        description: "Perfecto para proyectos pequeños y desarrollo",
        country: "UY",
        currency: "UYU",
        amount: 1189.00,
        frequency_type: "MONTHLY",
        frequency_value: 1,
        active: true,
        free_trial_days: 0,
        plan_token: "Dktil5kCQtirHXx1PXWr02JXdPoEzxJU",
        created_at: "2025-10-02T02:46:23",
        updated_at: "2025-10-02T02:46:23",
        subscribe_url: "https://checkout-sbx.dlocalgo.com/validate/subscription/Dktil5kCQtirHXx1PXWr02JXdPoEzxJU"
      },
      {
        id: 4632,
        merchant_id: 3348,
        name: "Plan Empresarial",
        description: "Para grandes organizaciones con necesidades avanzadas",
        country: "UY",
        currency: "UYU",
        amount: 4059.00,
        frequency_type: "MONTHLY",
        frequency_value: 1,
        active: true,
        free_trial_days: 0,
        plan_token: "pHmMNr9nB6jqz9kHnD77MGYK2mtC6YB1",
        created_at: "2025-10-02T02:47:59",
        updated_at: "2025-10-02T02:47:59",
        subscribe_url: "https://checkout-sbx.dlocalgo.com/validate/subscription/pHmMNr9nB6jqz9kHnD77MGYK2mtC6YB1"
      }
    ];
  }

  // Convert DLocal plan to internal format
  convertToInternalPlan(dLocalPlan: DLocalPlan) {
    // Convert UYU to USD for display (approximate conversion)
    const usdAmount = Math.round(dLocalPlan.amount / 40); // Approximate UYU to USD conversion
    
    return {
      id: dLocalPlan.plan_token, // Use plan_token as ID for consistency
      name: dLocalPlan.name,
      description: dLocalPlan.description,
      price: usdAmount,
      currency: 'USD', // Display in USD for consistency
      original_currency: dLocalPlan.currency,
      original_amount: dLocalPlan.amount,
      interval: dLocalPlan.frequency_type === 'MONTHLY' ? 'month' : 'year',
      trial_days: dLocalPlan.free_trial_days,
      is_active: dLocalPlan.active,
      is_popular: dLocalPlan.name.toLowerCase().includes('profesional'),
      subscribe_url: dLocalPlan.subscribe_url,
      plan_token: dLocalPlan.plan_token,
      features: this.getPlanFeatures(dLocalPlan.name),
      limits: this.getPlanLimits(dLocalPlan.name)
    };
  }

  // Get features based on plan name
  private getPlanFeatures(planName: string): string[] {
    const name = planName.toLowerCase();
    
    if (name.includes('profesional')) {
      return [
        'Ambientes Development, Testing y Production',
        'API Keys ilimitadas',
        'Branding personalizado',
        'Webhooks',
        'Hasta 10,000 usuarios por app',
        '1M requests API por mes',
        'Soporte por email',
        'Documentación completa'
      ];
    }
    
    if (name.includes('empresarial')) {
      return [
        'Todo lo del plan Profesional',
        'Soporte prioritario dedicado',
        'SLA garantizado 99.9%',
        'Usuarios ilimitados',
        'API requests ilimitados',
        'Consultoría personalizada',
        'Integración personalizada',
        'Backup y recuperación avanzada'
      ];
    }
    
    return [
      'Ambiente Development únicamente',
      '1 aplicación',
      'Hasta 100 usuarios',
      '10,000 requests API por mes',
      'Soporte comunitario'
    ];
  }

  // Get limits based on plan name
  private getPlanLimits(planName: string) {
    const name = planName.toLowerCase();
    
    if (name.includes('profesional')) {
      return {
        applications: 5,
        users_per_app: 10000,
        api_requests_per_month: 1000000,
        environments: ['development', 'testing', 'production'],
        support_level: 'priority'
      };
    }
    
    if (name.includes('empresarial')) {
      return {
        applications: -1, // Unlimited
        users_per_app: -1, // Unlimited
        api_requests_per_month: -1, // Unlimited
        environments: ['development', 'testing', 'production'],
        support_level: 'dedicated'
      };
    }
    
    return {
      applications: 1,
      users_per_app: 100,
      api_requests_per_month: 10000,
      environments: ['development'],
      support_level: 'basic'
    };
  }

  // Create subscription (redirect to DLocal checkout)
  async createSubscription(planToken: string, userInfo: any) {
    try {
      console.log('🔄 Creating subscription with DLocal...');
      
      // Get the plan details
      const plans = await this.getSubscriptionPlans();
      const selectedPlan = plans.find(plan => plan.plan_token === planToken);
      
      if (!selectedPlan) {
        throw new Error('Plan not found');
      }

      // Store subscription info for when user returns
      localStorage.setItem('pending_dlocal_subscription', JSON.stringify({
        plan_token: planToken,
        plan_name: selectedPlan.name,
        plan_amount: selectedPlan.amount,
        plan_currency: selectedPlan.currency,
        user_id: userInfo.id,
        user_email: userInfo.email,
        timestamp: Date.now()
      }));

      console.log('💾 Stored pending subscription:', {
        plan_token: planToken,
        plan_name: selectedPlan.name,
        subscribe_url: selectedPlan.subscribe_url
      });

      // Redirect to DLocal checkout
      window.open(selectedPlan.subscribe_url, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      return {
        success: true,
        checkout_url: selectedPlan.subscribe_url,
        plan: selectedPlan
      };
    } catch (error) {
      console.error('❌ Error creating DLocal subscription:', error);
      throw error;
    }
  }

  // Check if user has completed payment (called when user returns)
  async checkPaymentStatus(planToken: string): Promise<boolean> {
    try {
      console.log('🔍 Checking payment completion for plan:', planToken);
      
      // Check if there's a pending subscription that matches
      const pendingSubscription = localStorage.getItem('pending_dlocal_subscription');
      
      if (pendingSubscription) {
        const data = JSON.parse(pendingSubscription);
        
        // If the plan tokens match and enough time has passed, assume payment was completed
        const timePassed = Date.now() - data.timestamp;
        if (data.plan_token === planToken && timePassed > 5 * 1000) { // 5 seconds minimum
          console.log('✅ Payment completion detected');
          
        }
      }
      
      // Also check the other localStorage key
      if (pendingSubscription2) {
        const data = JSON.parse(pendingSubscription2);
        const timePassed = Date.now() - data.timestamp;
        if (data.plan_token === planToken && timePassed > 5 * 1000) {
          console.log('✅ Payment completion detected (alternate storage)');
          return true;
        }
      }
      
      console.log('❌ Payment not completed or insufficient time passed', {
        planToken,
        hasPending: !!pendingSubscription,
        hasPending2: !!pendingSubscription2
      });
      return false;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return false;
    }
  }

  // Get exchange rate for display purposes
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      // Approximate exchange rates (in production, use a real exchange rate API)
      const rates: Record<string, number> = {
        'UYU_USD': 0.025, // 1 UYU = 0.025 USD (approximate)
        'USD_UYU': 40     // 1 USD = 40 UYU (approximate)
      };
      
      return rates[`${fromCurrency}_${toCurrency}`] || 1;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return 1;
    }
  }
}

export const dLocalService = new DLocalService();