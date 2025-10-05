/*
  # Add Email Configuration to Applications

  1. Changes
    - Add email_config jsonb column to applications table for storing email settings
    - Add email verification settings
    - Add password reset settings
    - Add notification settings

  2. Email Configuration Structure
    - require_email_verification: boolean
    - send_welcome_email: boolean
    - send_password_reset_email: boolean
    - notify_admin_new_user: boolean
    - admin_notification_email: string
    - from_name: string
    - from_email: string (optional, uses system default if not provided)
    - email_provider: string (resend, sendgrid, etc.)
    - email_provider_api_key: string (encrypted)

  3. Security
    - Only authenticated users can read/update their own applications
*/

-- Add email_config column to applications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'email_config'
  ) THEN
    ALTER TABLE applications ADD COLUMN email_config jsonb DEFAULT jsonb_build_object(
      'require_email_verification', false,
      'send_welcome_email', false,
      'send_password_reset_email', true,
      'notify_admin_new_user', false,
      'admin_notification_email', '',
      'from_name', 'AuthSystem',
      'from_email', '',
      'email_provider', 'system',
      'email_provider_api_key', ''
    );
  END IF;
END $$;