/*
  Preserve the trusted web-login context while a user confirms their email.
  The context is generated server-side by auth-register; it is never taken
  from the browser when the verification token is consumed.
*/

ALTER TABLE email_verification_tokens
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
