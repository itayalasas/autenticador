/*
  # Add push notification fields to mfa_devices

  1. Changes
    - Adds push_token, push_provider and device_platform fields.
    - Adds index for efficient lookup of active push tokens.

  2. Notes
    - Existing records remain valid with null push fields.
*/

ALTER TABLE mfa_devices
ADD COLUMN IF NOT EXISTS push_token text;

ALTER TABLE mfa_devices
ADD COLUMN IF NOT EXISTS push_provider text;

ALTER TABLE mfa_devices
ADD COLUMN IF NOT EXISTS device_platform text;

CREATE INDEX IF NOT EXISTS idx_mfa_devices_push_active
  ON mfa_devices(application_id, app_user_id, is_active)
  WHERE push_token IS NOT NULL;
