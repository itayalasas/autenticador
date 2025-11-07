/*
  # Create auth_codes table for OAuth-style token exchange

  1. New Tables
    - `auth_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Short temporary code
      - `access_token` (text) - Full JWT access token
      - `refresh_token` (text) - Full JWT refresh token
      - `user_id` (uuid) - Reference to app user
      - `application_id` (uuid) - Reference to application
      - `expires_at` (timestamptz) - Code expiration (5 minutes)
      - `used_at` (timestamptz) - When code was exchanged
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `auth_codes` table
    - Add policy for authenticated users to exchange their own codes
    - Add index on code for fast lookup
    - Add cleanup policy for expired codes

  3. Notes
    - Codes expire in 5 minutes
    - Codes can only be used once
    - This solves the URL length issue for OAuth callbacks
*/

-- Create auth_codes table
CREATE TABLE IF NOT EXISTS auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  user_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON auth_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires_at ON auth_codes(expires_at);

-- Enable RLS
ALTER TABLE auth_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow reading own unused, non-expired codes
CREATE POLICY "Users can read own unused auth codes"
  ON auth_codes
  FOR SELECT
  USING (
    used_at IS NULL 
    AND expires_at > now()
  );

-- Policy: Allow updating to mark code as used
CREATE POLICY "Users can mark codes as used"
  ON auth_codes
  FOR UPDATE
  USING (
    used_at IS NULL 
    AND expires_at > now()
  )
  WITH CHECK (
    used_at IS NOT NULL
  );

-- Function to cleanup expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth_codes
  WHERE expires_at < now() - interval '1 hour';
END;
$$;

COMMENT ON TABLE auth_codes IS 'Temporary codes for OAuth-style token exchange to avoid URL length issues';
COMMENT ON FUNCTION cleanup_expired_auth_codes IS 'Cleanup expired auth codes older than 1 hour';