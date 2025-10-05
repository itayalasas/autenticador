/*
  # Create Email Logs Table

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key)
      - `to_email` (text)
      - `from_email` (text)
      - `from_name` (text)
      - `subject` (text)
      - `html_content` (text)
      - `status` (text) - sent, failed, pending
      - `error_message` (text, nullable)
      - `application_id` (uuid, nullable, foreign key)
      - `app_user_id` (uuid, nullable, foreign key)
      - `sent_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `email_logs` table
    - Add policy for authenticated users to read their application's email logs
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read email logs for their applications
CREATE POLICY "Users can read email logs for their applications"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- Policy: Service role can insert email logs
CREATE POLICY "Service role can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_logs_application_id ON email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_app_user_id ON email_logs(app_user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);