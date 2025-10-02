/*
  # Subscription System Schema

  1. New Tables
    - `subscription_plans` - Available subscription plans
    - `subscriptions` - User subscriptions
    - `payment_methods` - User payment methods
    - `invoices` - Billing invoices
    - `usage_tracking` - Track API usage and limits

  2. Security
    - Enable RLS on all subscription tables
    - Add policies for users to manage their own subscriptions
    - Add policies for admins to view all subscriptions

  3. Features
    - Multiple subscription plans (Basic, Pro, Enterprise)
    - Trial periods
    - Usage tracking and limits
    - Payment method management
    - Invoice generation
*/

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  features jsonb DEFAULT '[]'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  is_popular boolean DEFAULT false,
  trial_days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due', 'trialing')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  cancelled_at timestamptz,
  dlocal_subscription_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dlocal_payment_method_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'bank_transfer', 'digital_wallet')),
  last_four text,
  brand text,
  exp_month integer,
  exp_year integer,
  country text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dlocal_invoice_id text,
  amount decimal(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  due_date timestamptz,
  paid_at timestamptz,
  invoice_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Usage Tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, subscription_id, metric_name, period_start)
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can read active subscription plans"
  ON subscription_plans
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for payment_methods
CREATE POLICY "Users can manage own payment methods"
  ON payment_methods
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for invoices
CREATE POLICY "Users can read own invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for usage_tracking
CREATE POLICY "Users can read own usage"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert usage data"
  ON usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price, currency, interval, features, limits, is_popular, trial_days) VALUES
(
  'Básico',
  'Perfecto para proyectos pequeños y desarrollo',
  0,
  'USD',
  'month',
  '["Hasta 2 aplicaciones", "Hasta 100 usuarios por app", "10,000 requests API/mes", "Soporte por email", "Ambientes: Development"]'::jsonb,
  '{
    "applications": 2,
    "users_per_app": 100,
    "api_requests_per_month": 10000,
    "environments": ["development"],
    "support_level": "basic"
  }'::jsonb,
  false,
  14
),
(
  'Profesional',
  'Ideal para equipos y aplicaciones en producción',
  29,
  'USD',
  'month',
  '["Hasta 10 aplicaciones", "Hasta 1,000 usuarios por app", "100,000 requests API/mes", "Soporte prioritario", "Todos los ambientes", "Branding personalizado", "Webhooks", "Analytics avanzados"]'::jsonb,
  '{
    "applications": 10,
    "users_per_app": 1000,
    "api_requests_per_month": 100000,
    "environments": ["development", "testing", "production"],
    "support_level": "priority"
  }'::jsonb,
  true,
  14
),
(
  'Empresarial',
  'Para grandes organizaciones con necesidades avanzadas',
  99,
  'USD',
  'month',
  '["Aplicaciones ilimitadas", "Usuarios ilimitados", "1,000,000 requests API/mes", "Soporte dedicado", "Todos los ambientes", "Branding personalizado", "Webhooks", "Analytics avanzados", "SSO", "Auditoría completa", "SLA 99.9%"]'::jsonb,
  '{
    "applications": -1,
    "users_per_app": -1,
    "api_requests_per_month": 1000000,
    "environments": ["development", "testing", "production"],
    "support_level": "dedicated"
  }'::jsonb,
  false,
  14
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();