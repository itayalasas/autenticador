/*
  # Fix validate_reset_password_token RPC

  1. Problem
    - The function referenced `v_token_row.user_id`, but the
      `email_verification_tokens` table stores the user as `app_user_id`.
    - Because of that, every validation call failed to locate the user and
      either returned `not_found` or `email_mismatch`, producing
      "Token de recuperación inválido o expirado" in the UI.

  2. Fix
    - Replace the function so it uses `v_token_row.app_user_id`.
    - Keep the exact same signature and return shape so the frontend
      continues to work without changes.

  3. Security
    - Function is SECURITY DEFINER so the UI (anon role) can validate a
      token without reading the tokens table directly.
*/

CREATE OR REPLACE FUNCTION public.validate_reset_password_token(
  p_token text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row email_verification_tokens%ROWTYPE;
  v_app_user  app_users%ROWTYPE;
  v_app       applications%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_email IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'missing_params');
  END IF;

  SELECT * INTO v_token_row
  FROM email_verification_tokens
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_token_row.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF v_token_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;

  SELECT * INTO v_app_user
  FROM app_users
  WHERE id = v_token_row.app_user_id
  LIMIT 1;

  IF NOT FOUND OR lower(v_app_user.email) <> lower(p_email) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'email_mismatch');
  END IF;

  SELECT * INTO v_app
  FROM applications
  WHERE id = v_app_user.application_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'valid', true,
    'application', jsonb_build_object(
      'id', v_app.id,
      'name', v_app.name,
      'application_id', v_app.application_id,
      'domain', v_app.domain,
      'email_config', v_app.email_config
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_reset_password_token(text, text) TO anon, authenticated;