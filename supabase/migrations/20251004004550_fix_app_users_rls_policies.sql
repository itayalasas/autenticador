/*
  # Fix app_users RLS policies for JOIN queries
  
  1. Changes
    - Drop existing restrictive policy on app_users
    - Create new SELECT policy that allows authenticated users to view app_users
    - Create separate policies for INSERT, UPDATE, DELETE that maintain security
    
  2. Security
    - Users can view all app_users (needed for JOIN queries in logs)
    - Users can only modify app_users for applications they own
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage app users of own applications" ON app_users;

-- Create new SELECT policy that allows viewing
CREATE POLICY "Authenticated users can view app users"
  ON app_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Create INSERT policy
CREATE POLICY "Users can create app users for own applications"
  ON app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- Create UPDATE policy
CREATE POLICY "Users can update app users for own applications"
  ON app_users
  FOR UPDATE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );

-- Create DELETE policy
CREATE POLICY "Users can delete app users for own applications"
  ON app_users
  FOR DELETE
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE owner_id = auth.uid()
    )
  );
