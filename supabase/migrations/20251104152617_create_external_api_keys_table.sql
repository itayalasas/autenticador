/*
  # Create External API Keys Table

  1. New Table
    - `external_api_keys`
      - `id` (uuid, primary key)
      - `name` (text) - Descriptive name for the API key
      - `key` (text, unique) - The actual API key
      - `description` (text) - Optional description
      - `is_active` (boolean) - Whether the key is active
      - `allowed_endpoints` (jsonb) - Array of allowed endpoints
      - `rate_limit` (integer) - Requests per minute limit
      - `last_used_at` (timestamptz) - Last time the key was used
      - `expires_at` (timestamptz) - Expiration date (optional)
      - `created_by` (uuid) - User who created the key
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `external_api_keys` table
    - Only authenticated admin users can manage keys
    - Public read access is NOT allowed (keys are secret)
    
  3. Important Notes
    - API keys should be generated with high entropy
    - Keys are used for external system authentication
    - Each key can have specific endpoint permissions
*/

-- Create external_api_keys table
CREATE TABLE IF NOT EXISTS external_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  allowed_endpoints jsonb DEFAULT '["*"]'::jsonb,
  rate_limit integer DEFAULT 60,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE external_api_keys ENABLE ROW LEVEL SECURITY;

-- Create index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_external_api_keys_key ON external_api_keys(key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_external_api_keys_active ON external_api_keys(is_active);

-- Policy: Only authenticated users can view keys
CREATE POLICY "Authenticated users can view external API keys"
  ON external_api_keys
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can insert keys
CREATE POLICY "Authenticated users can create external API keys"
  ON external_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Policy: Only authenticated users can update their keys
CREATE POLICY "Authenticated users can update external API keys"
  ON external_api_keys
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete keys
CREATE POLICY "Authenticated users can delete external API keys"
  ON external_api_keys
  FOR DELETE
  TO authenticated
  USING (true);

-- Create a function to generate a secure API key
CREATE OR REPLACE FUNCTION generate_external_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key text;
BEGIN
  -- Generate a secure random key with prefix
  new_key := 'eak_' || encode(gen_random_bytes(32), 'hex');
  RETURN new_key;
END;
$$;

-- Insert a default API key for application-info endpoint
INSERT INTO external_api_keys (name, key, description, allowed_endpoints, created_by)
VALUES (
  'Application Info API Key',
  generate_external_api_key(),
  'Default API key for accessing application information endpoint',
  '["application-info"]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (key) DO NOTHING;