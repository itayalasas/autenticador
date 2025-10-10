/*
  # Allow Public Access to Branding Configs

  1. Changes
    - Add policy to allow anonymous users to read branding_configs
    - This is safe because branding info (colors, logos) is public by design
    - Required for static auth forms to load branding dynamically

  2. Security
    - Read-only access for anonymous users
    - No write access
    - Only non-sensitive branding data is exposed
*/

-- Allow anonymous users to read branding configurations
CREATE POLICY "Anyone can read branding configs"
  ON branding_configs
  FOR SELECT
  TO anon
  USING (true);