/*
  # Fix App Users Registration Policies

  1. Security Updates
    - Fix RLS policies for app_users table to allow registration
    - Ensure service role can insert new users
    - Update policies to work with edge functions

  2. Changes
    - Add service role insert policy for app_users
    - Fix existing policies to work with application ownership
    - Ensure proper permissions for user creation
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can insert app users in own applications" ON app_users;
DROP POLICY IF EXISTS "Users can read app users of own applications" ON app_users;
DROP POLICY IF EXISTS "Users can update app users in own applications" ON app_users;
DROP POLICY IF EXISTS "Users can delete app users in own applications" ON app_users;

-- Create new policies that work with both dashboard users and service role
CREATE POLICY "Users can read app users of own applications"
  ON app_users FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert app users in own applications"
  ON app_users FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update app users in own applications"
  ON app_users FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete app users in own applications"
  ON app_users FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  );

-- CRITICAL: Add service role policy for edge functions to insert users
CREATE POLICY "Service role can insert app users"
  ON app_users FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow service role to read for validation
CREATE POLICY "Service role can read app users"
  ON app_users FOR SELECT
  TO service_role
  USING (true);

-- Allow service role to update (for last_login, etc.)
CREATE POLICY "Service role can update app users"
  ON app_users FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure the applications table allows service role access for validation
DROP POLICY IF EXISTS "Service role can read applications" ON applications;
CREATE POLICY "Service role can read applications"
  ON applications FOR SELECT
  TO service_role
  USING (true);

-- Fix user_roles policies to work with service role
DROP POLICY IF EXISTS "Service role can insert user roles" ON user_roles;
CREATE POLICY "Service role can insert user roles"
  ON user_roles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read user roles"
  ON user_roles FOR SELECT
  TO service_role
  USING (true);

-- Ensure auth_logs can be inserted by service role (already exists but let's make sure)
DROP POLICY IF EXISTS "Service role can insert auth logs" ON auth_logs;
CREATE POLICY "Service role can insert auth logs"
  ON auth_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure email_logs can be inserted by service role
DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;
CREATE POLICY "Service role can insert email logs"
  ON email_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure email_verification_tokens can be inserted by service role
DROP POLICY IF EXISTS "Service role can insert verification tokens" ON email_verification_tokens;
CREATE POLICY "Service role can insert verification tokens"
  ON email_verification_tokens FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Verify the policies were created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('app_users', 'applications', 'user_roles', 'auth_logs', 'email_logs', 'email_verification_tokens')
  AND roles @> ARRAY['service_role']
ORDER BY tablename, policyname;