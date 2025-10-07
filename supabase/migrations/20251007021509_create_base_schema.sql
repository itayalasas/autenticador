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
