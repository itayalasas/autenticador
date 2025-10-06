/*
  # Sistema de Suscripciones

  1. Nueva Tabla: `subscription_plans`
    - `id` (uuid, primary key)
    - `name` (text) - Nombre del plan
    - `description` (text) - Descripción del plan
    - `price` (decimal) - Precio del plan
    - `currency` (text) - Moneda (USD, EUR, etc)
    - `interval` (text) - Intervalo (month, year)
    - `trial_days` (integer) - Días de prueba gratis
    - `features` (jsonb) - Lista de características
    - `limits` (jsonb) - Límites del plan
    - `is_active` (boolean) - Si está activo
    - `is_popular` (boolean) - Si es el plan más popular
    - `plan_token` (text, nullable) - Token del plan en DLocal
    - `subscribe_url` (text, nullable) - URL de suscripción
    - `original_amount` (text, nullable) - Monto original
    - `original_currency` (text, nullable) - Moneda original
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Nueva Tabla: `subscriptions`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key a auth.users)
    - `plan_id` (uuid, foreign key a subscription_plans)
    - `status` (text) - Estado: pending, active, trialing, cancelled, expired
    - `current_period_start` (timestamptz) - Inicio del período actual
    - `current_period_end` (timestamptz) - Fin del período actual
    - `trial_end` (timestamptz, nullable) - Fin del período de prueba
    - `cancel_at_period_end` (boolean) - Si se cancelará al final del período
    - `cancelled_at` (timestamptz, nullable) - Fecha de cancelación
    - `dlocal_subscription_id` (text, nullable) - ID de suscripción en DLocal
    - `metadata` (jsonb) - Metadatos adicionales
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Seguridad
    - Habilitar RLS en ambas tablas
    - Planes son visibles para todos los usuarios autenticados
    - Suscripciones solo visibles para el usuario propietario
*/

-- Crear tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  trial_days integer DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  is_popular boolean DEFAULT false,
  plan_token text,
  subscribe_url text,
  original_amount text,
  original_currency text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índices para planes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_price ON subscription_plans(price);

-- Habilitar RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para planes (todos pueden ver planes activos)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'trialing', 'cancelled', 'expired')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  cancelled_at timestamptz,
  dlocal_subscription_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índices para suscripciones
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- Habilitar RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para suscripciones
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para subscription_plans
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at_trigger ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at_trigger
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Trigger para subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Insertar plan básico gratuito por defecto
INSERT INTO subscription_plans (
  id,
  name,
  description,
  price,
  currency,
  interval,
  trial_days,
  features,
  limits,
  is_active,
  is_popular
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Básico',
  'Perfecto para comenzar y desarrollo',
  0,
  'USD',
  'month',
  0,
  '["Ambiente Development únicamente", "1 aplicación", "Hasta 100 usuarios", "10,000 requests API por mes", "Soporte comunitario"]'::jsonb,
  '{"applications": 1, "users_per_app": 100, "api_requests_per_month": 10000, "environments": ["development"], "support_level": "basic"}'::jsonb,
  true,
  false
) ON CONFLICT (id) DO NOTHING;

-- Función para crear suscripción básica automáticamente
CREATE OR REPLACE FUNCTION create_basic_subscription_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear suscripción básica para nuevo usuario
  INSERT INTO subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    metadata
  ) VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000000',
    'active',
    now(),
    now() + interval '1 year',
    '{"auto_created": true}'::jsonb
  ) ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear suscripción básica automáticamente
DROP TRIGGER IF EXISTS create_basic_subscription_trigger ON auth.users;
CREATE TRIGGER create_basic_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_basic_subscription_for_new_user();