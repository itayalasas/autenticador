/*
  # Crear tabla de configuración de conectores

  1. Nueva Tabla
    - `connectors_config`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key a auth.users)
      - `connector_type` (text) - 'github', 'netlify', 'gitlab', etc.
      - `config_data` (jsonb) - Configuración específica del conector
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Estructura de config_data por tipo:
  
  GitHub:
  {
    "client_id": "github_client_id",
    "client_secret": "github_client_secret",
    "redirect_uri": "https://domain.com/github/callback"
  }
  
  Netlify:
  {
    "access_token": "netlify_token",
    "site_id": "netlify_site_id"
  }

  3. Seguridad
    - Enable RLS
    - Policies para que usuarios solo vean sus propias configuraciones
*/

-- Create connectors_config table
CREATE TABLE IF NOT EXISTS connectors_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  connector_type text NOT NULL CHECK (connector_type IN ('github', 'netlify', 'gitlab', 'bitbucket', 'stripe', 'dlocal')),
  config_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connector_type)
);

-- Enable RLS
ALTER TABLE connectors_config ENABLE ROW LEVEL SECURITY;

-- Policies for connectors_config
CREATE POLICY "Users can read own connector configs"
  ON connectors_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connector configs"
  ON connectors_config
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connector configs"
  ON connectors_config
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connector configs"
  ON connectors_config
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_connectors_config_user_id ON connectors_config(user_id);
CREATE INDEX IF NOT EXISTS idx_connectors_config_type ON connectors_config(user_id, connector_type);
CREATE INDEX IF NOT EXISTS idx_connectors_config_active ON connectors_config(user_id, is_active) WHERE is_active = true;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_connectors_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_connectors_config_updated_at_trigger ON connectors_config;
CREATE TRIGGER update_connectors_config_updated_at_trigger
  BEFORE UPDATE ON connectors_config
  FOR EACH ROW
  EXECUTE FUNCTION update_connectors_config_updated_at();
