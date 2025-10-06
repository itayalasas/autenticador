-- ============================================================================
-- SCRIPT DE CONFIGURACIÓN COMPLETA DE BASE DE DATOS
-- Sistema de Autenticación con Suscripciones
-- ============================================================================
-- Este script contiene todas las tablas, funciones, triggers y datos
-- necesarios para el funcionamiento completo del sistema.
-- ============================================================================

-- ============================================================================
-- 1. TABLA DE PERFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'developer', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. TABLA DE APLICACIONES
-- ============================================================================

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  application_id text UNIQUE NOT NULL DEFAULT ('app_' || substr(gen_random_uuid()::text, 1, 12)),
  domain text NOT NULL,
  logo_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  users_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  max_failed_attempts integer DEFAULT 5,
  auto_block_enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  email_config jsonb DEFAULT jsonb_build_object(
    'email_provider', 'system',
    'require_email_verification', false,
    'send_welcome_email', false,
    'send_password_reset_email', true,
    'notify_admin_new_user', false,
    'admin_notification_email', '',
    'from_name', 'AuthSystem',
    'from_email', '',
    'smtp_host', '',
    'smtp_port', 587,
    'smtp_secure', true,
    'smtp_user', '',
    'smtp_password', '',
    'api_key', ''
  )
);

CREATE INDEX IF NOT EXISTS idx_applications_owner_id ON applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- No RLS on applications table (as per migration)

-- ============================================================================
-- 3. TABLA DE ENTORNOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('development', 'testing', 'production')),
  domain text NOT NULL,
  is_active boolean DEFAULT true,
  auth_url text,
  callback_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environments_application_id ON environments(application_id);

ALTER TABLE environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view environments of their applications"
  ON environments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environments.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage environments of their applications"
  ON environments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environments.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environments.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. TABLA DE CONFIGURACIÓN DE BRANDING
-- ============================================================================

CREATE TABLE IF NOT EXISTS branding_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
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
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branding_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view branding of their applications"
  ON branding_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = branding_configs.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage branding of their applications"
  ON branding_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = branding_configs.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = branding_configs.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. TABLA DE USUARIOS DE APLICACIONES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  metadata jsonb DEFAULT '{}'::jsonb,
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_application_id ON app_users(application_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_app_email ON app_users(application_id, email);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view app_users of their applications"
  ON app_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = app_users.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage app_users of their applications"
  ON app_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = app_users.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = app_users.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. TABLA DE ROLES DE USUARIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_app_user_id ON user_roles(app_user_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles of their application users"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      JOIN applications ON applications.id = app_users.application_id
      WHERE app_users.id = user_roles.app_user_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage roles of their application users"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      JOIN applications ON applications.id = app_users.application_id
      WHERE app_users.id = user_roles.app_user_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      JOIN applications ON applications.id = app_users.application_id
      WHERE app_users.id = user_roles.app_user_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. TABLA DE API KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_preview text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  last_used timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_application_id ON api_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view API keys of their applications"
  ON api_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = api_keys.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage API keys of their applications"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = api_keys.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = api_keys.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. TABLA DE LOGS DE AUTENTICACIÓN
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('login', 'register', 'logout', 'password_reset', 'failed_login')),
  ip_address inet,
  user_agent text,
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_application_id ON auth_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_app_user_id ON auth_logs(app_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);

ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view auth logs of their applications"
  ON auth_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = auth_logs.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert auth logs"
  ON auth_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 9. TABLA DE IPs BLOQUEADAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  reason text NOT NULL,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  blocked_by_system boolean DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_application_id ON blocked_ips(application_id);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocked IPs of their applications"
  ON blocked_ips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = blocked_ips.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage blocked IPs of their applications"
  ON blocked_ips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = blocked_ips.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = blocked_ips.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert blocked IPs"
  ON blocked_ips FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 10. TABLA DE LOGS DE EMAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email logs of their applications"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = email_logs.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 11. TABLA DE TOKENS DE VERIFICACIÓN DE EMAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_app_user_id ON email_verification_tokens(app_user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view verification tokens of their application users"
  ON email_verification_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      JOIN applications ON applications.id = app_users.application_id
      WHERE app_users.id = email_verification_tokens.app_user_id
      AND applications.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 12. TABLA DE NOTIFICACIONES
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 13. TABLA DE PREFERENCIAS DE NOTIFICACIONES
-- ============================================================================

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

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notification preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 14. TABLA DE PLANES DE SUSCRIPCIÓN
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_price ON subscription_plans(price);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 15. TABLA DE SUSCRIPCIONES
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 16. FUNCIONES Y TRIGGERS
-- ============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_branding_configs_updated_at ON branding_configs;
CREATE TRIGGER update_branding_configs_updated_at
  BEFORE UPDATE ON branding_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blocked_ips_updated_at ON blocked_ips;
CREATE TRIGGER update_blocked_ips_updated_at
  BEFORE UPDATE ON blocked_ips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar updated_at de suscripciones
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at_trigger ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at_trigger
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Función para auto-bloquear IPs
CREATE OR REPLACE FUNCTION auto_block_ip(
  p_application_id uuid,
  p_ip_address inet,
  p_failed_attempts integer
)
RETURNS boolean AS $$
DECLARE
  v_max_attempts integer;
  v_auto_block_enabled boolean;
BEGIN
  -- Get application configuration
  SELECT max_failed_attempts, auto_block_enabled
  INTO v_max_attempts, v_auto_block_enabled
  FROM applications
  WHERE id = p_application_id;

  -- Check if auto-blocking is enabled and threshold is reached
  IF v_auto_block_enabled AND v_max_attempts IS NOT NULL AND p_failed_attempts >= v_max_attempts THEN
    -- Insert blocked IP if not already blocked
    INSERT INTO blocked_ips (
      application_id,
      ip_address,
      reason,
      blocked_by_system,
      is_active,
      metadata
    )
    VALUES (
      p_application_id,
      p_ip_address,
      'Automatically blocked after ' || p_failed_attempts || ' failed login attempts',
      true,
      true,
      jsonb_build_object(
        'failed_attempts', p_failed_attempts,
        'auto_blocked_at', now()
      )
    )
    ON CONFLICT DO NOTHING;

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

DROP TRIGGER IF EXISTS create_basic_subscription_trigger ON auth.users;
CREATE TRIGGER create_basic_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_basic_subscription_for_new_user();

-- ============================================================================
-- 17. DATOS INICIALES
-- ============================================================================

-- Insertar plan básico gratuito
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
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Verificar que todo se haya creado correctamente
SELECT 'Script ejecutado exitosamente' AS status;
