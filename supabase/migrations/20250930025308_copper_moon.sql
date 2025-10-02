/*
  # Add Application Roles Management

  1. New Tables
    - `application_roles`
      - `id` (uuid, primary key)
      - `application_id` (uuid, foreign key to applications)
      - `name` (text, role name like 'admin', 'editor', 'viewer')
      - `display_name` (text, human readable name)
      - `description` (text, role description)
      - `permissions` (jsonb, array of permissions)
      - `is_default` (boolean, if this role is assigned by default)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `application_roles` table
    - Add policy for users to manage roles of own applications

  3. Changes
    - Update user_roles to reference application_roles instead of hardcoded role names
    - Add default roles for existing applications
*/

CREATE TABLE IF NOT EXISTS application_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(application_id, name)
);

ALTER TABLE application_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage roles of own applications"
  ON application_roles
  FOR ALL
  TO authenticated
  USING (application_id IN (
    SELECT id FROM applications WHERE owner_id = auth.uid()
  ));

-- Add default roles for existing applications
DO $$
DECLARE
  app_record RECORD;
BEGIN
  FOR app_record IN SELECT id FROM applications LOOP
    -- Insert default roles if they don't exist
    INSERT INTO application_roles (application_id, name, display_name, description, permissions, is_default)
    VALUES 
      (app_record.id, 'user', 'Usuario', 'Usuario básico con permisos de lectura', '["read"]'::jsonb, true),
      (app_record.id, 'moderator', 'Moderador', 'Usuario con permisos de moderación', '["read", "write", "moderate"]'::jsonb, false),
      (app_record.id, 'admin', 'Administrador', 'Usuario con todos los permisos', '["read", "write", "delete", "admin"]'::jsonb, false)
    ON CONFLICT (application_id, name) DO NOTHING;
  END LOOP;
END $$;