/*
  # Mobile MFA support (Authenticator-style)

  1. New tables
    - mfa_pairing_tokens: one-time tokens for QR pairing flow
    - mfa_devices: registered mobile devices per user/application
    - mfa_login_challenges: login approvals pending in mobile app

  2. Notes
    - Existing login flow remains compatible when 2FA is disabled.
    - When enabled (applications.metadata.enable_two_factor = true), auth-login can require MFA challenge approval.
*/

CREATE TABLE IF NOT EXISTS mfa_pairing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  challenge_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  access_token text,
  refresh_token text,
  callback_url text,
  approved_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_mfa_challenge_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mfa_devices_user_device
  ON mfa_devices(application_id, app_user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_mfa_pairing_tokens_token ON mfa_pairing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mfa_pairing_tokens_user ON mfa_pairing_tokens(app_user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_user ON mfa_devices(app_user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_devices_active ON mfa_devices(application_id, app_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfa_login_challenges_user ON mfa_login_challenges(app_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_login_challenges_id_status ON mfa_login_challenges(id, status);

CREATE OR REPLACE FUNCTION set_mfa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mfa_devices_updated_at ON mfa_devices;
CREATE TRIGGER trg_mfa_devices_updated_at
  BEFORE UPDATE ON mfa_devices
  FOR EACH ROW
  EXECUTE FUNCTION set_mfa_updated_at();

DROP TRIGGER IF EXISTS trg_mfa_login_challenges_updated_at ON mfa_login_challenges;
CREATE TRIGGER trg_mfa_login_challenges_updated_at
  BEFORE UPDATE ON mfa_login_challenges
  FOR EACH ROW
  EXECUTE FUNCTION set_mfa_updated_at();
