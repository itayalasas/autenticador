/*
  Add a private device token to MFA devices so the mobile app can authenticate
  without keeping the user's password around.
*/

ALTER TABLE mfa_devices
  ADD COLUMN IF NOT EXISTS device_token_hash text,
  ADD COLUMN IF NOT EXISTS device_token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_token_last_used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_devices_device_token_hash
  ON mfa_devices(device_token_hash);
