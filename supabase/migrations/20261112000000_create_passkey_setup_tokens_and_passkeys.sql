/*
  Create passkey setup tokens and passkeys tables.

  - `passkey_setup_tokens` stores the email invitation token and WebAuthn challenge.
  - `passkeys` stores the registered credential for the application user.
*/

CREATE TABLE IF NOT EXISTS passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT '{}'::text[],
  device_name text,
  credential_device_type text,
  credential_backed_up boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkeys_application_user
  ON passkeys(application_id, app_user_id);

CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id
  ON passkeys(credential_id);

CREATE TABLE IF NOT EXISTS passkey_setup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  email text NOT NULL,
  device_name text,
  auth_url text NOT NULL,
  environment_name text,
  status text NOT NULL DEFAULT 'pending',
  challenge text,
  challenge_expires_at timestamptz,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  passkey_id uuid REFERENCES passkeys(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkey_setup_tokens_token
  ON passkey_setup_tokens(token);

CREATE INDEX IF NOT EXISTS idx_passkey_setup_tokens_application_user
  ON passkey_setup_tokens(application_id, app_user_id);

CREATE INDEX IF NOT EXISTS idx_passkey_setup_tokens_expires_at
  ON passkey_setup_tokens(expires_at);
