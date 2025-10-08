/*
  # Create deployment_logs table

  1. New Tables
    - `deployment_logs`
      - `id` (uuid, primary key)
      - `environment_id` (uuid, foreign key to environments)
      - `application_id` (uuid, foreign key to applications)
      - `user_id` (uuid, foreign key to auth.users)
      - `deployment_type` (text) - Type of deployment (deploy, test, validate)
      - `status` (text) - Status (success, failed, partial)
      - `logs` (jsonb) - Array of log entries with timestamp, level, message
      - `test_results` (jsonb) - Test results from the deployment
      - `metadata` (jsonb) - Additional metadata (api_key, urls, etc)
      - `started_at` (timestamptz) - When deployment started
      - `completed_at` (timestamptz) - When deployment completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `deployment_logs` table
    - Add policies for users to:
      - View their own deployment logs
      - Create deployment logs for their applications
*/

-- Create deployment_logs table
CREATE TABLE IF NOT EXISTS deployment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  deployment_type text NOT NULL DEFAULT 'deploy',
  status text NOT NULL DEFAULT 'running',
  logs jsonb DEFAULT '[]'::jsonb,
  test_results jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deployment_logs_environment_id ON deployment_logs(environment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_application_id ON deployment_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_user_id ON deployment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Users can create deployment logs" ON deployment_logs;
DROP POLICY IF EXISTS "Users can update own deployment logs" ON deployment_logs;

-- Policy: Users can view their own deployment logs
CREATE POLICY "Users can view own deployment logs"
  ON deployment_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create deployment logs for their applications
CREATE POLICY "Users can create deployment logs"
  ON deployment_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own deployment logs
CREATE POLICY "Users can update own deployment logs"
  ON deployment_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
