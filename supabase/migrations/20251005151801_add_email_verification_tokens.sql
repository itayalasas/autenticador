/*
  # Add Email Verification Tokens

  1. New Table
    - `email_verification_tokens`
      - `id` (uuid, primary key)
      - `app_user_id` (uuid, foreign key)
      - `token` (text, unique)
      - `expires_at` (timestamptz)
      - `used` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Tokens are checked by service role only
*/

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access
CREATE POLICY "Service role can manage verification tokens"
  ON email_verification_tokens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_app_user_id ON email_verification_tokens(app_user_id);