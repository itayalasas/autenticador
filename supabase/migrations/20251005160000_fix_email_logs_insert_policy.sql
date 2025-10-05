/*
  # Fix email_logs INSERT policy for service role

  1. Changes
    - Drop existing INSERT policy that only allows authenticated users
    - Create new INSERT policy that allows service_role to insert

  2. Security
    - Service role (used by edge functions) can insert email logs
    - This is necessary because edge functions need to log emails
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;

-- Create new policy that allows service_role to insert
CREATE POLICY "Allow service role to insert email logs"
  ON email_logs
  FOR INSERT
  WITH CHECK (true);
