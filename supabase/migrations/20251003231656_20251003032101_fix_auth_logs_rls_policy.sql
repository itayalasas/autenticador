/*
  # Fix Auth Logs RLS Policy
  
  1. Changes
    - Drop restrictive policy that only shows logs of owned applications
    - Add new policy that allows authenticated users to see all auth logs
    - This is appropriate for an admin dashboard where all logs should be visible
  
  2. Security
    - Still requires authentication to view logs
    - Only authenticated users can access the logs table
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can read logs of own applications" ON auth_logs;

-- Create new policy that allows authenticated users to see all logs
CREATE POLICY "Authenticated users can read all auth logs"
  ON auth_logs
  FOR SELECT
  TO authenticated
  USING (true);