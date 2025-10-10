/*
  # Create Environment Variables Configuration Table

  1. New Tables
    - `environment_variables`
      - `id` (uuid, primary key)
      - `application_id` (uuid, references applications)
      - `environment_id` (uuid, references environments) - NULL for global vars
      - `key` (text) - Variable name (e.g., VITE_SUPABASE_URL)
      - `value` (text) - Variable value
      - `is_secret` (boolean) - Whether to mask the value in UI
      - `is_global` (boolean) - Whether this applies to all environments
      - `description` (text) - Description of what this variable is for
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `environment_variables` table
    - Add policies for authenticated users to manage their app env vars
    - Add unique constraint on (application_id, environment_id, key)

  3. Indexes
    - Index on application_id for fast lookups
    - Index on environment_id for fast lookups
*/

CREATE TABLE IF NOT EXISTS environment_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  is_secret boolean DEFAULT false,
  is_global boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate keys per environment
CREATE UNIQUE INDEX IF NOT EXISTS environment_variables_unique_key 
  ON environment_variables(application_id, COALESCE(environment_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS environment_variables_application_id_idx 
  ON environment_variables(application_id);

CREATE INDEX IF NOT EXISTS environment_variables_environment_id_idx 
  ON environment_variables(environment_id);

-- Enable RLS
ALTER TABLE environment_variables ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read env vars for their applications
CREATE POLICY "Users can read own application env vars"
  ON environment_variables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environment_variables.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert env vars for their applications
CREATE POLICY "Users can insert env vars for own applications"
  ON environment_variables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environment_variables.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Policy: Users can update env vars for their applications
CREATE POLICY "Users can update own application env vars"
  ON environment_variables
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environment_variables.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environment_variables.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete env vars for their applications
CREATE POLICY "Users can delete own application env vars"
  ON environment_variables
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = environment_variables.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_environment_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_environment_variables_updated_at'
  ) THEN
    CREATE TRIGGER update_environment_variables_updated_at
      BEFORE UPDATE ON environment_variables
      FOR EACH ROW
      EXECUTE FUNCTION update_environment_variables_updated_at();
  END IF;
END $$;