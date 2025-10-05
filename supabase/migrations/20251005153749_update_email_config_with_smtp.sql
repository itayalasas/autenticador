/*
  # Update Email Configuration with SMTP Support

  1. Changes
    - Update default email_config to support SMTP configuration
    - Add support for multiple email providers (system, smtp, resend, sendgrid)
    - Add SMTP server configuration fields

  2. Email Configuration Structure
    - email_provider: 'system' | 'smtp' | 'resend' | 'sendgrid'
    - require_email_verification: boolean
    - send_welcome_email: boolean
    - send_password_reset_email: boolean
    - notify_admin_new_user: boolean
    - admin_notification_email: string
    - from_name: string
    - from_email: string
    
    SMTP Configuration:
    - smtp_host: string
    - smtp_port: number
    - smtp_secure: boolean (TLS)
    - smtp_user: string
    - smtp_password: string (encrypted)
    
    API Configuration:
    - api_key: string (for Resend, SendGrid, etc.)

  3. Security
    - SMTP passwords and API keys are stored in email_config
    - Only accessible by application owner
*/

-- Update existing email_config columns to include SMTP configuration
DO $$
BEGIN
  -- Update default value for new applications
  ALTER TABLE applications 
  ALTER COLUMN email_config 
  SET DEFAULT jsonb_build_object(
    'email_provider', 'system',
    'require_email_verification', false,
    'send_welcome_email', false,
    'send_password_reset_email', true,
    'notify_admin_new_user', false,
    'admin_notification_email', '',
    'from_name', 'AuthSystem',
    'from_email', '',
    'smtp_host', '',
    'smtp_port', 587,
    'smtp_secure', true,
    'smtp_user', '',
    'smtp_password', '',
    'api_key', ''
  );
END $$;