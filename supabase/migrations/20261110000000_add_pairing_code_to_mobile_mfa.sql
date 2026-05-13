/*
  Add a short human-friendly pairing code for mobile device enrollment.

  The internal UUID token remains in place for compatibility, but the new
  `pairing_code` can be shown to the user and typed manually instead of the
  raw token.
*/

ALTER TABLE mfa_pairing_tokens
  ADD COLUMN IF NOT EXISTS pairing_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_pairing_tokens_pairing_code
  ON mfa_pairing_tokens(pairing_code);
