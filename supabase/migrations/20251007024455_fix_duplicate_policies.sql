/*
  # Fix Duplicate Policy Errors
  
  This migration resolves duplicate policy errors by:
  1. Dropping existing duplicate policies if they exist
  2. Recreating them with proper IF NOT EXISTS checks
  
  ## Changes
  - Drops and recreates policies for profiles table
  - Ensures idempotent policy creation
  
  ## Security
  - Maintains existing RLS policies
  - No changes to access control logic
*/

-- Drop existing policies on profiles table if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Recreate policies for profiles table
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);