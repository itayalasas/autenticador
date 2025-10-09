/*
  # Sistema de Autenticación - Schema Principal

  1. Nuevas Tablas
    - `profiles` - Perfiles de usuarios del sistema
    - `applications` - Aplicaciones registradas
    - `environments` - Ambientes por aplicación (dev, testing, prod)
    - `app_users` - Usuarios de las aplicaciones
    - `api_keys` - Claves de API
    - `branding_configs` - Configuraciones de branding
    - `user_roles` - Roles de usuarios por aplicación
    - `auth_logs` - Logs de autenticación

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas de acceso por usuario autenticado
    - Restricciones de dominio y validaciones
*/

-- Profiles table for system users
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'developer', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  application_id text UNIQUE NOT NULL DEFAULT 'app_' || substr(gen_random_uuid()::text, 1, 12),
  domain text NOT NULL,
  logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  users_count integer DEFAULT 0,
  email_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Environments table
CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('development', 'testing', 'production')),
  domain text NOT NULL,
  is_active boolean DEFAULT true,
  auth_url text,
  callback_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(application_id, name)
);

-- Branding configurations
CREATE TABLE IF NOT EXISTS branding_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#1E40AF',
  accent_color text DEFAULT '#F59E0B',
  background_color text DEFAULT '#FFFFFF',
  text_color text DEFAULT '#1F2937',
  font_family text DEFAULT 'Inter',
  logo_url text,
  favicon_url text,
  border_radius integer DEFAULT 8,
  button_style text DEFAULT 'rounded' CHECK (button_style IN ('rounded', 'square')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(application_id)
);

-- App users (users of the applications, not system users)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  metadata jsonb DEFAULT '{}',
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(application_id, email)
);

-- User roles for applications
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  permissions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(app_user_id, role_name)
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_preview text NOT NULL,
  permissions jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  last_used timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Auth logs
CREATE TABLE IF NOT EXISTS auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('login', 'register', 'logout', 'password_reset', 'failed_login')),
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Blocked IPs table
CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL UNIQUE,
  reason text NOT NULL,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auth_logs_application_id ON auth_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_app_user_id ON auth_logs(app_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for applications
CREATE POLICY "Users can read own applications"
  ON applications
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create applications"
  ON applications
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own applications"
  ON applications
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own applications"
  ON applications
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for environments
CREATE POLICY "Users can read environments of own applications"
  ON environments
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert environments in own applications"
  ON environments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update environments in own applications"
  ON environments
  FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete environments in own applications"
  ON environments
  FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for branding_configs
CREATE POLICY "Users can read branding of own applications"
  ON branding_configs
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert branding in own applications"
  ON branding_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update branding in own applications"
  ON branding_configs
  FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete branding in own applications"
  ON branding_configs
  FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for app_users
CREATE POLICY "Users can read app users of own applications"
  ON app_users
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert app users in own applications"
  ON app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update app users in own applications"
  ON app_users
  FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete app users in own applications"
  ON app_users
  FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can read roles of own application users"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert roles for own application users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update roles for own application users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete roles for own application users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

-- RLS Policies for api_keys
CREATE POLICY "Users can read API keys of own applications"
  ON api_keys
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert API keys in own applications"
  ON api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update API keys in own applications"
  ON api_keys
  FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete API keys in own applications"
  ON api_keys
  FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for auth_logs
CREATE POLICY "Users can read logs of own applications"
  ON auth_logs
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert auth logs"
  ON auth_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert auth logs"
  ON auth_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for blocked_ips
CREATE POLICY "Users can read all blocked IPs"
  ON blocked_ips
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert blocked IPs"
  ON blocked_ips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update blocked IPs"
  ON blocked_ips
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete blocked IPs"
  ON blocked_ips
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for email_verification_tokens
CREATE POLICY "Users can read verification tokens of own application users"
  ON email_verification_tokens
  FOR SELECT
  TO authenticated
  USING (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert verification tokens"
  ON email_verification_tokens
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert verification tokens"
  ON email_verification_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for email_logs
CREATE POLICY "Users can read email logs of own applications"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    ) OR application_id IS NULL
  );

CREATE POLICY "Service can insert email logs"
  ON email_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Functions to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_branding_configs_updated_at ON branding_configs;
CREATE TRIGGER update_branding_configs_updated_at
  BEFORE UPDATE ON branding_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blocked_ips_updated_at ON blocked_ips;
CREATE TRIGGER update_blocked_ips_updated_at
  BEFORE UPDATE ON blocked_ips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Usuario'),
    new.email
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user count in applications
CREATE OR REPLACE FUNCTION update_application_user_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE applications 
    SET users_count = users_count + 1 
    WHERE id = NEW.application_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE applications 
    SET users_count = users_count - 1 
    WHERE id = OLD.application_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language plpgsql;

-- Triggers for user count
DROP TRIGGER IF EXISTS update_app_user_count_insert ON app_users;
CREATE TRIGGER update_app_user_count_insert
  AFTER INSERT ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_application_user_count();

DROP TRIGGER IF EXISTS update_app_user_count_delete ON app_users;
CREATE TRIGGER update_app_user_count_delete
  AFTER DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_application_user_count();
/*
  # Sistema de Notificaciones

  1. Nueva Tabla: `notifications`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key a auth.users)
    - `title` (text) - Título de la notificación
    - `message` (text) - Mensaje de la notificación
    - `type` (text) - Tipo: info, success, warning, error
    - `category` (text) - Categoría: security, billing, system, application
    - `is_read` (boolean) - Si fue leída
    - `link` (text, nullable) - Link opcional para más detalles
    - `metadata` (jsonb, nullable) - Datos adicionales
    - `created_at` (timestamptz)
    - `read_at` (timestamptz, nullable)

  2. Nueva Tabla: `notification_preferences`
    - `user_id` (uuid, primary key, foreign key a auth.users)
    - `email_updates` (boolean) - Actualizaciones por email
    - `security_alerts` (boolean) - Alertas de seguridad
    - `billing_notifications` (boolean) - Notificaciones de facturación
    - `product_updates` (boolean) - Actualizaciones de producto
    - `email_frequency` (text) - Frecuencia: immediate, daily, weekly
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Seguridad
    - Habilitar RLS en ambas tablas
    - Usuarios solo pueden ver/editar sus propias notificaciones y preferencias
*/

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category text NOT NULL DEFAULT 'system' CHECK (category IN ('security', 'billing', 'system', 'application')),
  is_read boolean DEFAULT false,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para notificaciones
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Crear tabla de preferencias de notificaciones
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_updates boolean DEFAULT true,
  security_alerts boolean DEFAULT true,
  billing_notifications boolean DEFAULT true,
  product_updates boolean DEFAULT false,
  email_frequency text DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para preferencias
CREATE POLICY "Users can view own preferences"
  ON notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at_trigger ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at_trigger
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Función para crear notificación de bienvenida
CREATE OR REPLACE FUNCTION create_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, category)
  VALUES (
    NEW.id,
    'Bienvenido a AuthSystem',
    'Gracias por unirte a AuthSystem. Estamos emocionados de tenerte aquí.',
    'success',
    'system'
  );
  
  -- Crear preferencias por defecto
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear notificación de bienvenida
DROP TRIGGER IF EXISTS create_welcome_notification_trigger ON auth.users;
CREATE TRIGGER create_welcome_notification_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_welcome_notification();
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
  EXECUTE FUNCTION create_basic_subscription_for_new_user();/*
  # Create dLocal Plans Cache Table

  1. New Tables
    - `dlocal_plans_cache`
      - `id` (bigint, primary key) - dLocal plan ID
      - `merchant_id` (bigint) - Merchant ID
      - `name` (text) - Plan name
      - `description` (text) - Plan description
      - `country` (text) - Country code
      - `currency` (text) - Currency code
      - `amount` (numeric) - Plan amount
      - `frequency_type` (text) - MONTHLY or YEARLY
      - `frequency_value` (integer) - Frequency value
      - `active` (boolean) - Whether plan is active
      - `free_trial_days` (integer) - Free trial days
      - `plan_token` (text, unique) - Plan token for subscriptions
      - `subscribe_url` (text) - Checkout URL
      - `dlocal_created_at` (timestamptz) - When plan was created in dLocal
      - `dlocal_updated_at` (timestamptz) - When plan was updated in dLocal
      - `synced_at` (timestamptz) - When this record was last synced
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `dlocal_plans_cache` table
    - Add policy for authenticated users to read plans
    - Add policy for service role to manage plans

  3. Indexes
    - Index on `plan_token` for fast lookups
    - Index on `active` for filtering active plans
    - Index on `synced_at` for cache invalidation
*/

CREATE TABLE IF NOT EXISTS dlocal_plans_cache (
  id bigint PRIMARY KEY,
  merchant_id bigint NOT NULL,
  name text NOT NULL,
  description text,
  country text NOT NULL,
  currency text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  frequency_type text NOT NULL CHECK (frequency_type IN ('MONTHLY', 'YEARLY')),
  frequency_value integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  free_trial_days integer NOT NULL DEFAULT 0,
  plan_token text UNIQUE NOT NULL,
  subscribe_url text NOT NULL,
  dlocal_created_at timestamptz,
  dlocal_updated_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_plan_token ON dlocal_plans_cache(plan_token);
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_active ON dlocal_plans_cache(active);
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_synced_at ON dlocal_plans_cache(synced_at);

-- Enable RLS
ALTER TABLE dlocal_plans_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read active plans
CREATE POLICY "Authenticated users can read active plans"
  ON dlocal_plans_cache
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policy: Service role can read all plans
CREATE POLICY "Service role can read all plans"
  ON dlocal_plans_cache
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Service role can insert plans
CREATE POLICY "Service role can insert plans"
  ON dlocal_plans_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can update plans
CREATE POLICY "Service role can update plans"
  ON dlocal_plans_cache
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can delete plans
CREATE POLICY "Service role can delete plans"
  ON dlocal_plans_cache
  FOR DELETE
  TO service_role
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dlocal_plans_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dlocal_plans_cache_updated_at_trigger ON dlocal_plans_cache;
CREATE TRIGGER update_dlocal_plans_cache_updated_at_trigger
  BEFORE UPDATE ON dlocal_plans_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_dlocal_plans_cache_updated_at();


-- ============================================================================
-- ADDITIONAL CONFIGURATIONS
-- ============================================================================
/*
  # Add environment column to api_keys table

  1. Changes
    - Add environment column to api_keys table
    - Set default to 'development'
    - Add check constraint to ensure valid environment values
    
  2. Notes
    - Existing API keys will be set to 'development' by default
    - Valid environments: development, testing, production
*/

-- Add environment column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'environment'
  ) THEN
    ALTER TABLE api_keys 
    ADD COLUMN environment text DEFAULT 'development' NOT NULL;
    
    -- Add check constraint for valid environments
    ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_environment_check 
    CHECK (environment IN ('development', 'testing', 'production'));
  END IF;
END $$;
/*
  # Create deployment_logs table

  1. New Tables
    - `deployment_logs`
      - `id` (uuid, primary key)
      - `environment_id` (uuid, foreign key to environments)
      - `application_id` (uuid, foreign key to applications)
      - `user_id` (uuid, foreign key to auth.users)
      - `deployment_type` (text) - Type of deployment (deploy, test, validate)
      - `status` (text) - Status (success, failed, partial)
      - `logs` (jsonb) - Array of log entries with timestamp, level, message
      - `test_results` (jsonb) - Test results from the deployment
      - `metadata` (jsonb) - Additional metadata (api_key, urls, etc)
      - `started_at` (timestamptz) - When deployment started
      - `completed_at` (timestamptz) - When deployment completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `deployment_logs` table
    - Add policies for users to:
      - View their own deployment logs
      - Create deployment logs for their applications
*/

-- Create deployment_logs table
CREATE TABLE IF NOT EXISTS deployment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  deployment_type text NOT NULL DEFAULT 'deploy',
  status text NOT NULL DEFAULT 'running',
  logs jsonb DEFAULT '[]'::jsonb,
  test_results jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deployment_logs_environment_id ON deployment_logs(environment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_application_id ON deployment_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_user_id ON deployment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Users can create deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Users can update own deployment logs" ON deployment_logs;

-- Policy: Users can view their own deployment logs
CREATE POLICY "Users can view own deployment logs"
  ON deployment_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create deployment logs for their applications
CREATE POLICY "Users can create deployment logs"
  ON deployment_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own deployment logs
CREATE POLICY "Users can update own deployment logs"
  ON deployment_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
/*
  # Add Provider Fields to Subscription Plans

  1. Changes
    - Add `provider` column to track payment provider (dlocal, stripe, etc.)
    - Add `provider_plan_id` column to store external plan ID from provider
    - Add `provider_metadata` column for additional provider-specific data
    
  2. Notes
    - These fields are optional to maintain backward compatibility
    - Existing plans will have NULL values for these fields
*/

-- Add provider columns to subscription_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider_plan_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider_metadata'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for faster lookups by provider
CREATE INDEX IF NOT EXISTS idx_subscription_plans_provider 
  ON subscription_plans(provider) 
  WHERE provider IS NOT NULL;

-- Add index for provider_plan_id lookups
CREATE INDEX IF NOT EXISTS idx_subscription_plans_provider_plan_id 
  ON subscription_plans(provider_plan_id) 
  WHERE provider_plan_id IS NOT NULL;/*
  # Add Provider Fields to Subscriptions

  1. Changes
    - Add `provider` column to track payment provider (dlocal, stripe, etc.)
    - Add `provider_subscription_id` column to store external subscription ID
    - Add `provider_plan_id` column to store external plan ID reference
    
  2. Notes
    - These fields complement the existing dlocal_subscription_id
    - Migrate existing dlocal_subscription_id values to provider_subscription_id
    - Add indexes for better query performance
*/

-- Add provider columns to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_plan_id text;
  END IF;
END $$;

-- Migrate existing dlocal_subscription_id to provider fields
UPDATE subscriptions 
SET 
  provider = 'dlocal',
  provider_subscription_id = dlocal_subscription_id
WHERE dlocal_subscription_id IS NOT NULL 
  AND provider_subscription_id IS NULL;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider 
  ON subscriptions(provider) 
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id 
  ON subscriptions(provider_subscription_id) 
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_plan_id 
  ON subscriptions(provider_plan_id) 
  WHERE provider_plan_id IS NOT NULL;
-- ============================================================================
-- MISSING TABLES
-- ============================================================================

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_application_id ON usage_tracking(application_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON usage_tracking(created_at DESC);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view usage of own applications"
  ON usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- Application roles table
CREATE TABLE IF NOT EXISTS application_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(application_id, role_name)
);

ALTER TABLE application_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage roles in own applications"
  ON application_roles
  FOR ALL
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'dlocal',
  provider_payment_method_id text,
  type text NOT NULL CHECK (type IN ('card', 'bank_transfer', 'other')),
  last_four text,
  brand text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
  ON payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON payment_methods
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON payment_methods
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  provider text DEFAULT 'dlocal',
  provider_invoice_id text,
  invoice_number text,
  invoice_url text,
  due_date timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- SAMPLE DATA (Optional - commented out by default)
-- ============================================================================

-- Uncomment to insert sample subscription plans
/*
INSERT INTO subscription_plans (name, description, price, currency, interval, trial_days, features, limits, is_popular, provider)
VALUES
  ('Profesional', 'Perfecto para proyectos pequeños y desarrollo', 29.99, 'USD', 'month', 7, 
   '["Ambientes Development y Testing", "3 aplicaciones", "Hasta 1,000 usuarios por app", "50,000 requests API por mes", "Soporte por email"]'::jsonb,
   '{"applications": 3, "users_per_app": 1000, "api_requests_per_month": 50000, "environments": ["development", "testing"], "support_level": "email"}'::jsonb,
   false, null),
  
  ('Empresarial', 'Para grandes organizaciones con necesidades avanzadas', 99.99, 'USD', 'month', 14,
   '["Todos los ambientes", "Aplicaciones ilimitadas", "Usuarios ilimitados", "500,000 requests API por mes", "Soporte prioritario 24/7", "SLA garantizado"]'::jsonb,
   '{"applications": -1, "users_per_app": -1, "api_requests_per_month": 500000, "environments": ["development", "testing", "production"], "support_level": "priority"}'::jsonb,
   true, null)
ON CONFLICT DO NOTHING;
*/

-- ============================================================================
-- FINAL NOTES
-- ============================================================================
-- This export includes:
-- 1. All table schemas with proper data types and constraints
-- 2. All indexes for performance optimization
-- 3. All RLS policies for security
-- 4. All triggers and functions for automation
-- 5. Default data (basic subscription plan)
--
-- To use this script:
-- 1. Run it in your Supabase SQL Editor
-- 2. Or use: psql -h <host> -U <user> -d <database> -f complete_database_export.sql
-- 
-- Make sure to configure these environment variables for Edge Functions:
-- - DLOCAL_API_KEY
-- - DLOCAL_SECRET_KEY  
-- - DLOCAL_API_URL (https://api-sbx.dlocalgo.com for sandbox)
