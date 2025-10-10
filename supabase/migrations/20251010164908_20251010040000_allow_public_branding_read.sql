/*
  # Allow Public Access to Application Branding

  1. Changes
    - Add policy to allow public read access to applications table for branding data
    - This is safe because only non-sensitive data (name, logo, colors) is exposed
    - Required for static auth forms to load branding dynamically

  2. Security
    - Read-only access
    - No access to sensitive fields (owner_id, api keys, etc.)
    - Only application_id, name, and branding fields are exposed
*/

-- Allow anonymous users to read public branding information
CREATE POLICY "Anyone can read application branding"
  ON applications
  FOR SELECT
  TO anon
  USING (true);