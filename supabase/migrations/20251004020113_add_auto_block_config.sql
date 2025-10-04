/*
  # Add Auto-Block Configuration

  1. Changes to applications table
    - Add `max_failed_attempts` column (integer, default: 5)
      - Number of failed login attempts before auto-blocking IP
      - NULL = manual blocking only
    - Add `auto_block_enabled` column (boolean, default: true)
      - Enable/disable automatic IP blocking feature

  2. Security
    - No RLS changes needed (uses existing application policies)
    
  3. Notes
    - If max_failed_attempts is NULL, auto-blocking is disabled
    - If auto_block_enabled is false, auto-blocking is disabled
    - Default of 5 attempts provides reasonable security
*/

-- Create applications table if it doesn't exist (for fresh databases)
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add new columns for auto-blocking configuration
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS max_failed_attempts integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS auto_block_enabled boolean DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN applications.max_failed_attempts IS 'Maximum failed login attempts before auto-blocking IP. NULL = manual only.';
COMMENT ON COLUMN applications.auto_block_enabled IS 'Enable or disable automatic IP blocking feature.';