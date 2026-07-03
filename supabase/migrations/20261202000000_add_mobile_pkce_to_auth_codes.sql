ALTER TABLE auth_codes
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS redirect_uri text,
  ADD COLUMN IF NOT EXISTS code_challenge text,
  ADD COLUMN IF NOT EXISTS code_challenge_method text,
  ADD COLUMN IF NOT EXISTS state text;

UPDATE auth_codes
SET channel = 'web'
WHERE channel IS NULL;

ALTER TABLE auth_codes
  ALTER COLUMN channel SET DEFAULT 'web';

ALTER TABLE auth_codes
  ALTER COLUMN channel SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_codes_channel_check'
  ) THEN
    ALTER TABLE auth_codes
      ADD CONSTRAINT auth_codes_channel_check
      CHECK (channel IN ('web', 'mobile'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_codes_code_challenge_method_check'
  ) THEN
    ALTER TABLE auth_codes
      ADD CONSTRAINT auth_codes_code_challenge_method_check
      CHECK (
        code_challenge_method IS NULL
        OR code_challenge_method IN ('S256', 'plain')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_codes_application_unused
  ON auth_codes(application_id, code)
  WHERE used_at IS NULL;

COMMENT ON COLUMN auth_codes.channel IS 'Authentication channel that created the code: web or mobile';
COMMENT ON COLUMN auth_codes.redirect_uri IS 'Trusted callback/deep-link URI bound to this authorization code';
COMMENT ON COLUMN auth_codes.code_challenge IS 'PKCE code challenge stored for authorization-code exchanges';
COMMENT ON COLUMN auth_codes.code_challenge_method IS 'PKCE code challenge method (S256 or plain)';
COMMENT ON COLUMN auth_codes.state IS 'Opaque client state echoed back on callback';
