/*
  # Create Deployment Snapshots Table

  ## Description
  This migration creates a system to track deployment snapshots that can be used for rollback operations.
  Each snapshot represents a stable deployment state with its git commit information.

  ## New Tables
  
  ### `deployment_snapshots`
  Stores stable deployment snapshots for rollback purposes
  - `id` (uuid, primary key) - Unique identifier for the snapshot
  - `application_id` (uuid, foreign key) - Reference to the application
  - `commit_hash` (text) - Git commit SHA hash
  - `commit_message` (text) - Commit message for identification
  - `branch` (text) - Git branch name
  - `deployment_url` (text) - URL of the deployed version
  - `status` (text) - Status: 'stable', 'unstable', 'rolled_back'
  - `deployed_at` (timestamptz) - When this version was deployed
  - `marked_stable_at` (timestamptz) - When marked as stable
  - `marked_stable_by` (uuid) - User who marked it as stable
  - `metadata` (jsonb) - Additional deployment metadata (env vars, build info, etc)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on `deployment_snapshots` table
  - Only app owners can manage snapshots

  ## Indexes
  - Index on application_id for faster queries
  - Index on commit_hash for quick lookups
  - Index on status for filtering stable deployments
*/

-- Create deployment_snapshots table
CREATE TABLE IF NOT EXISTS deployment_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  commit_hash text NOT NULL,
  commit_message text DEFAULT '',
  branch text DEFAULT 'main',
  deployment_url text,
  status text NOT NULL DEFAULT 'stable' CHECK (status IN ('stable', 'unstable', 'rolled_back')),
  deployed_at timestamptz DEFAULT now(),
  marked_stable_at timestamptz,
  marked_stable_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_application_id ON deployment_snapshots(application_id);
CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_commit_hash ON deployment_snapshots(commit_hash);
CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_status ON deployment_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_deployed_at ON deployment_snapshots(deployed_at DESC);

-- Enable RLS
ALTER TABLE deployment_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only app owners can manage snapshots

CREATE POLICY "App owners can read deployment snapshots"
  ON deployment_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = deployment_snapshots.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "App owners can create deployment snapshots"
  ON deployment_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = deployment_snapshots.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "App owners can update deployment snapshots"
  ON deployment_snapshots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = deployment_snapshots.application_id
      AND applications.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = deployment_snapshots.application_id
      AND applications.owner_id = auth.uid()
    )
  );

CREATE POLICY "App owners can delete deployment snapshots"
  ON deployment_snapshots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = deployment_snapshots.application_id
      AND applications.owner_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deployment_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_deployment_snapshots_updated_at_trigger ON deployment_snapshots;
CREATE TRIGGER update_deployment_snapshots_updated_at_trigger
  BEFORE UPDATE ON deployment_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_deployment_snapshots_updated_at();