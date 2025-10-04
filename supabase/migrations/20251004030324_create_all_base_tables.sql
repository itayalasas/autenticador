/*
  # Sistema de Autenticación - Schema Principal

  1. Nuevas Tablas
    - `profiles` - Perfiles de usuarios del sistema
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_application_id ON auth_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_app_user_id ON auth_logs(app_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

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
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for environments
CREATE POLICY "Users can manage environments of own applications"
  ON environments
  FOR ALL
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for branding_configs
CREATE POLICY "Users can manage branding of own applications"
  ON branding_configs
  FOR ALL
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for app_users (SELECT)
CREATE POLICY "Users can read app users of own applications"
  ON app_users
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policy for app_users (INSERT)
CREATE POLICY "Users can create app users in own applications"
  ON app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- RLS Policy for app_users (UPDATE)
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

-- RLS Policy for app_users (DELETE)
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
CREATE POLICY "Users can manage roles of own application users"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    app_user_id IN (
      SELECT au.id FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

-- RLS Policies for api_keys
CREATE POLICY "Users can manage API keys of own applications"
  ON api_keys
  FOR ALL
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

CREATE POLICY "Service role can insert auth logs"
  ON auth_logs
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
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branding_configs_updated_at
  BEFORE UPDATE ON branding_configs
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