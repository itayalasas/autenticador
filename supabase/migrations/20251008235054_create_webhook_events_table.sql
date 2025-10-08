/*
  # Create Webhook Events Table

  1. New Tables
    - `webhook_events`
      - `id` (uuid, primary key)
      - `provider` (text) - Provider name (dlocal, stripe, etc.)
      - `event_type` (text) - Type of webhook event
      - `event_data` (jsonb) - Complete webhook payload
      - `processed` (boolean) - Whether the event has been processed
      - `processed_at` (timestamptz) - When the event was processed
      - `processing_result` (jsonb) - Result of processing
      - `received_at` (timestamptz) - When the webhook was received
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `webhook_events` table
    - Add policies for system access only (service role)
    - Regular users cannot access webhook events directly

  3. Indexes
    - Index on provider and event_type for faster queries
    - Index on processed status for filtering
    - Index on received_at for chronological queries
*/

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  processing_result jsonb,
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type
  ON webhook_events(provider, event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
  ON webhook_events(processed);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON webhook_events(received_at DESC);

-- Add policy for service role only (webhooks are system-level events)
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add policy for authenticated admins to view webhook events (read-only)
CREATE POLICY "Admins can view webhook events"
  ON webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role_name = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE webhook_events IS 'Stores webhook events from payment providers and other external services';
