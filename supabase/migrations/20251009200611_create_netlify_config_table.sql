/*
  # Crear tabla de configuración de Netlify

  1. Nueva Tabla
    - `netlify_config`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key a auth.users)
      - `access_token` (text, encriptado)
      - `site_id` (text)
      - `site_name` (text)
      - `site_url` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Seguridad
    - Enable RLS
    - Policies para que usuarios solo accedan a su propia config
*/

-- Create netlify_config table
CREATE TABLE IF NOT EXISTS netlify_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token text NOT NULL,
  site_id text NOT NULL,
  site_name text,
  site_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, site_id)
);

-- Enable RLS
ALTER TABLE netlify_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own config
CREATE POLICY "Users can read own netlify config"
  ON netlify_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own config
CREATE POLICY "Users can insert own netlify config"
  ON netlify_config
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own config
CREATE POLICY "Users can update own netlify config"
  ON netlify_config
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own config
CREATE POLICY "Users can delete own netlify config"
  ON netlify_config
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_netlify_config_user_id ON netlify_config(user_id);
CREATE INDEX IF NOT EXISTS idx_netlify_config_active ON netlify_config(user_id, is_active) WHERE is_active = true;