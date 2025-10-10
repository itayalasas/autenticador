/*
  # Add DELETE policy to deployment_logs table

  1. Security Changes
    - Add policy for users to delete their own deployment logs
    - Only the owner of the log can delete it
    
  2. Important Notes
    - This allows users to manage their deployment history
    - Deletion is permanent and cannot be undone
    - Only authenticated users who own the log can delete it
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Users can delete own deployment logs" ON deployment_logs;

-- Policy: Users can delete their own deployment logs
CREATE POLICY "Users can delete own deployment logs"
  ON deployment_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);