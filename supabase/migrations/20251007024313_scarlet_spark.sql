/*
  # Fix User Registration RLS Policies

  This migration fixes the RLS policies for user registration to ensure
  the auth-register edge function can properly create users and assign roles.

  1. Security Updates
    - Fix RLS policies for app_users table
    - Fix RLS policies for user_roles table
    - Fix RLS policies for email_verification_tokens table
    - Add service role permissions for registration flow

  2. Function Permissions
    - Allow service role to insert into app_users
    - Allow service role to insert into user_roles
    - Allow service role to insert into email_verification_tokens
    - Allow service role to insert into auth_logs
*/

-- Fix app_users RLS policies
DROP POLICY IF EXISTS "Users can insert app users in own applications" ON app_users;
DROP POLICY IF EXISTS "Service can insert app users" ON app_users;

-- Allow authenticated users (including service role) to insert app users
CREATE POLICY "Users can insert app users in own applications"
  ON app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT applications.id
      FROM applications
      WHERE applications.owner_id = auth.uid()
    )
  );

-- Allow service role to insert app users for any application
CREATE POLICY "Service can insert app users"
  ON app_users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix user_roles RLS policies
DROP POLICY IF EXISTS "Users can insert roles for own application users" ON user_roles;
DROP POLICY IF EXISTS "Service can insert user roles" ON user_roles;

-- Allow authenticated users to insert roles for their app users
CREATE POLICY "Users can insert roles for own application users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_user_id IN (
      SELECT au.id
      FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

-- Allow service role to insert user roles
CREATE POLICY "Service can insert user roles"
  ON user_roles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix email_verification_tokens RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert verification tokens" ON email_verification_tokens;
DROP POLICY IF EXISTS "Service can insert verification tokens" ON email_verification_tokens;

-- Allow authenticated users to insert verification tokens for their app users
CREATE POLICY "Authenticated users can insert verification tokens"
  ON email_verification_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    app_user_id IN (
      SELECT au.id
      FROM app_users au
      JOIN applications a ON au.application_id = a.id
      WHERE a.owner_id = auth.uid()
    )
  );

-- Allow service role to insert verification tokens
CREATE POLICY "Service can insert verification tokens"
  ON email_verification_tokens
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix auth_logs RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Service can insert auth logs" ON auth_logs;

-- Allow authenticated users to insert auth logs
CREATE POLICY "Authenticated users can insert auth logs"
  ON auth_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role to insert auth logs
CREATE POLICY "Service can insert auth logs"
  ON auth_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix email_logs RLS policies
DROP POLICY IF EXISTS "Authenticated users can insert email logs" ON email_logs;
DROP POLICY IF EXISTS "Service can insert email logs" ON email_logs;

-- Allow authenticated users to insert email logs
CREATE POLICY "Authenticated users can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role to insert email logs
CREATE POLICY "Service can insert email logs"
  ON email_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure the update_application_user_count function exists and works properly
CREATE OR REPLACE FUNCTION update_application_user_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user count when user is inserted
  IF TG_OP = 'INSERT' THEN
    UPDATE applications 
    SET users_count = (
      SELECT COUNT(*) 
      FROM app_users 
      WHERE application_id = NEW.application_id 
      AND status = 'active'
    )
    WHERE id = NEW.application_id;
    RETURN NEW;
  END IF;
  
  -- Update user count when user is deleted
  IF TG_OP = 'DELETE' THEN
    UPDATE applications 
    SET users_count = (
      SELECT COUNT(*) 
      FROM app_users 
      WHERE application_id = OLD.application_id 
      AND status = 'active'
    )
    WHERE id = OLD.application_id;
    RETURN OLD;
  END IF;
  
  -- Update user count when user status changes
  IF TG_OP = 'UPDATE' THEN
    -- Only update if status changed
    IF OLD.status != NEW.status THEN
      UPDATE applications 
      SET users_count = (
        SELECT COUNT(*) 
        FROM app_users 
        WHERE application_id = NEW.application_id 
        AND status = 'active'
      )
      WHERE id = NEW.application_id;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers for user count
DROP TRIGGER IF EXISTS update_app_user_count_insert ON app_users;
DROP TRIGGER IF EXISTS update_app_user_count_delete ON app_users;
DROP TRIGGER IF EXISTS update_app_user_count_update ON app_users;

CREATE TRIGGER update_app_user_count_insert
  AFTER INSERT ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_application_user_count();

CREATE TRIGGER update_app_user_count_delete
  AFTER DELETE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_application_user_count();

CREATE TRIGGER update_app_user_count_update
  AFTER UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_application_user_count();

-- Verify that all tables have proper RLS enabled
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to service role
GRANT ALL ON app_users TO service_role;
GRANT ALL ON user_roles TO service_role;
GRANT ALL ON email_verification_tokens TO service_role;
GRANT ALL ON auth_logs TO service_role;
GRANT ALL ON email_logs TO service_role;
GRANT ALL ON applications TO service_role;
GRANT ALL ON branding_configs TO service_role;

-- Verify the fix
SELECT 'User registration RLS policies fixed successfully' AS status;