// Types for the authentication system
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'developer' | 'viewer';
  created_at: string;
  last_login?: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  application_id: string;
  domain: string;
  platform?: 'web' | 'mobile' | 'desktop' | 'api';
  logo?: string;
  status: 'active' | 'inactive' | 'deleted';
  environment: Environment;
  branding: BrandingConfig;
  users_count: number;
  metadata?: ApplicationMetadata;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentUrlsConfig {
  development: {
    base_url: string;
    callback_url: string;
  };
  testing: {
    base_url: string;
    callback_url: string;
  };
  production: {
    base_url: string;
    callback_url: string;
  };
}

export interface ApplicationMetadata {
  environment_urls?: EnvironmentUrlsConfig;
  cors_origins?: string[];
  webhook_url?: string;
  enable_email_verification?: boolean;
  allow_public_registration?: boolean;
  [key: string]: any;
}

export interface Environment {
  id: string;
  name: 'development' | 'testing' | 'production';
  domain: string;
  is_active: boolean;
  auth_url?: string;
  callback_url?: string;
  created_at: string;
  metadata?: {
    generated_urls?: {
      login: string;
      register: string;
      reset_password: string;
      callback: string;
    };
    [key: string]: any;
  };
}

export interface BrandingConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url?: string;
  favicon_url?: string;
  background_color: string;
  text_color: string;
  font_family: string;
  border_radius: number;
  button_style: 'rounded' | 'square';
  custom_texts?: Record<string, string>;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  application_id: string;
  user_roles: UserRole[];
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  last_login?: string;
  metadata?: Record<string, any>;
}

export interface UserRole {
  id: string;
  role_name: string;
  permissions: string[];
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  key_preview: string;
  application_id: string;
  permissions: string[];
  created_at: string;
  last_used?: string;
  is_active: boolean;
  expires_at?: string;
}

export interface ApplicationRole {
  id: string;
  application_id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
  created_at: string;
}
export interface AuthFormConfig {
  login_url: string;
  register_url: string;
  forgot_password_url: string;
  callback_url: string;
}

// Subscription types
export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    applications: number;
    users_per_app: number;
    api_requests_per_month: number;
    environments: string[];
    support_level: 'basic' | 'priority' | 'dedicated';
  };
  is_popular?: boolean;
  trial_days?: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_transfer' | 'digital_wallet';
  last_four?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
}