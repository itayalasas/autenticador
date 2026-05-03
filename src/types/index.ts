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

export type ThemeStyle = 'modern-glass' | 'minimal-clean' | 'corporate' | 'gradient-bold' | 'neumorphic' | 'custom';
export type CardStyle = 'flat' | 'elevated' | 'glass' | 'neumorphic';
export type InputStyle = 'outlined' | 'filled' | 'underlined';
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'gradient';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ShadowIntensity = 'none' | 'light' | 'medium' | 'strong';
export type FontSizeScale = 'small' | 'medium' | 'large';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export type FormWidth = 'narrow' | 'medium' | 'wide';
export type Spacing = 'compact' | 'normal' | 'relaxed';

export interface BrandingConfig {
  // Theme System
  theme_style?: ThemeStyle;

  // Basic Colors (existing)
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;

  // Extended Colors
  gradient_start?: string;
  gradient_end?: string;
  error_color?: string;
  success_color?: string;
  warning_color?: string;

  // Logo & Assets (existing)
  logo_url?: string;
  favicon_url?: string;
  background_image_url?: string;

  // Typography (existing + extended)
  font_family: string;
  heading_font_family?: string;
  font_size_scale?: FontSizeScale;

  // Card Styling
  card_style?: CardStyle;
  card_background?: string;
  card_blur?: number;

  // Input Styling
  input_style?: InputStyle;
  input_background?: string;
  input_border_color?: string;
  input_focus_color?: string;

  // Button Styling (existing + extended)
  button_style: 'rounded' | 'square';
  button_variant?: ButtonVariant;
  button_size?: ButtonSize;
  button_hover_transform?: boolean;

  // Borders (existing + extended)
  border_radius: number;
  shadow_intensity?: ShadowIntensity;

  // Background Effects
  background_pattern?: string;
  use_gradient?: boolean;
  glass_effect?: boolean;
  blur_background?: boolean;

  // Animation Settings
  enable_animations?: boolean;
  animation_speed?: AnimationSpeed;

  // Layout Settings
  form_width?: FormWidth;
  spacing?: Spacing;

  // Message Customization
  message_loading_text?: string;
  message_success_text?: string;
  message_error_text?: string;
  message_error_help_text?: string;
  redirect_delay?: number;

  // Message Colors
  message_loading_bg?: string;
  message_success_bg?: string;
  message_error_bg?: string;

  // Custom Texts (existing)
  custom_texts?: Record<string, string>;
}

export interface ThemePreset {
  name: string;
  label: string;
  description: string;
  config: Partial<BrandingConfig>;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  application_id: string;
  tenant_id?: string | null;
  role_id?: string | null;
  user_roles: UserRole[];
  roles?: string[];
  role_display_name?: string | null;
  role_permissions?: string[];
  tenant_name?: string | null;
  tenant_slug?: string | null;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  last_login?: string;
  metadata?: Record<string, any>;
}

export interface MfaManagedDevice {
  id: string;
  device_name: string;
  device_platform?: string;
  created_at: string;
  last_seen_at?: string;
  is_active: boolean;
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
  environment: string;
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
  is_active: boolean;
  available_for_registration?: boolean;
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
    api_keys_per_environment?: number;
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