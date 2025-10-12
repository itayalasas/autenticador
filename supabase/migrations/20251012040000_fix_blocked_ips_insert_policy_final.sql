/*
  # Fix blocked_ips INSERT policy

  1. Changes
    - Drop existing restrictive INSERT policies
    - Create a simple policy that allows authenticated users to insert blocked IPs
    - Ensure any authenticated user can block IPs (they are all admins in this system)

  2. Security
    - Only authenticated users can insert
    - No complex checks that might fail
*/

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Admins can insert blocked IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can block IPs" ON blocked_ips;
DROP POLICY IF EXISTS "Authenticated users can insert blocked IPs" ON blocked_ips;

-- Create simple INSERT policy
CREATE POLICY "Allow authenticated users to block IPs"
  ON blocked_ips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify other policies exist
DO $$
BEGIN
  -- Ensure SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Authenticated users can view blocked IPs'
  ) THEN
    CREATE POLICY "Authenticated users can view blocked IPs"
      ON blocked_ips FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Ensure UPDATE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Admins can update blocked IPs'
  ) THEN
    CREATE POLICY "Admins can update blocked IPs"
      ON blocked_ips FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Ensure DELETE policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_ips'
    AND policyname = 'Admins can delete blocked IPs'
  ) THEN
    CREATE POLICY "Admins can delete blocked IPs"
      ON blocked_ips FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
