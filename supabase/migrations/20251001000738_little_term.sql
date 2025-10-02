/*
  # Create application roles system

  1. New Tables
    - `application_roles`
      - `id` (uuid, primary key)
      - `application_id` (uuid, foreign key to applications)
      - `name` (text, role identifier like 'admin', 'editor')
      - `display_name` (text, human readable name)
      - `description` (text, role description)
      - `permissions` (jsonb, array of permissions)
      - `is_default` (boolean, if this role is assigned by default)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `application_roles` table
    - Add policy for users to manage roles of own applications

  3. Changes
    - Ensure only one default role per application
    - Add unique constraint on application_id + name
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

-- Create default roles for existing applications
DO $$
DECLARE
  app_record RECORD;
BEGIN
  FOR app_record IN SELECT id FROM applications LOOP
    -- Insert default user role
    INSERT INTO application_roles (application_id, name, display_name, description, permissions, is_default)
    VALUES (
      app_record.id,
      'user',
      'Usuario',
      'Usuario estándar con permisos básicos',
      '["read"]'::jsonb,
      true
    ) ON CONFLICT (application_id, name) DO NOTHING;
    
    -- Insert admin role
    INSERT INTO application_roles (application_id, name, display_name, description, permissions, is_default)
    VALUES (
      app_record.id,
      'admin',
      'Administrador',
      'Administrador con acceso completo',
      '["read", "write", "delete", "admin"]'::jsonb,
      false
    ) ON CONFLICT (application_id, name) DO NOTHING;
  END LOOP;
END $$;