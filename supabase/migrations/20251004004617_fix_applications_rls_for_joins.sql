/*
  # Fix applications RLS policies for JOIN queries
  
  1. Changes
    - Drop existing SELECT policy on applications
    - Create new SELECT policy that allows authenticated users to view all applications
    - Keep other policies restrictive for security
    
  2. Security
    - Users can view all applications (needed for JOIN queries in logs)
    - Users can only modify applications they own
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can read own applications" ON applications;

-- Create new SELECT policy that allows viewing all applications
CREATE POLICY "Authenticated users can view applications"
  ON applications
  FOR SELECT
  TO authenticated
  USING (true);
