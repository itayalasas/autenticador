/*
  # Allow Public Read Access to Application Roles

  ## Changes
  - Add a new SELECT policy for `application_roles` table that allows public (anon) users to read roles
  - This is required for public registration forms to display available user roles
  
  ## Security
  - Policy is restrictive: ONLY allows SELECT (read) operations
  - Only applies to anonymous users accessing public registration forms
  - Does NOT allow insert, update, or delete operations
  - Existing authenticated user policies remain unchanged

  ## Notes
  - Public registration forms need to display role options to new users
  - Roles are not sensitive data and are safe to display publicly
  - Users still cannot modify roles without authentication
*/

-- Drop policy if it exists (to make migration idempotent)
DROP POLICY IF EXISTS "Allow public read access to application roles" ON application_roles;

-- Create policy to allow anonymous users to read application roles
CREATE POLICY "Allow public read access to application roles"
  ON application_roles
  FOR SELECT
  TO anon
  USING (true);
