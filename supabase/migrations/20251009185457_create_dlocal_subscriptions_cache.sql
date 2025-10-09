/*
  # Create dLocal Subscriptions Cache Table

  1. New Tables
    - `dlocal_subscriptions_cache`
      - Stores raw subscription data from dLocal API
      - Used to track all subscriptions before syncing to subscriptions table
      - Prevents duplicate processing

  2. Security
    - Enable RLS on `dlocal_subscriptions_cache` table
    - Add policy for service role access only
*/

-- Create dlocal_subscriptions_cache table
CREATE TABLE IF NOT EXISTS dlocal_subscriptions_cache (
  id bigint PRIMARY KEY,
  subscription_token text UNIQUE NOT NULL,
  plan_id bigint NOT NULL REFERENCES dlocal_plans_cache(id),
  status text NOT NULL,
  payment_method_code text,
  client_id text NOT NULL,
  client_first_name text,
  client_last_name text,
  client_document_type text,
  client_document text,
  client_email text NOT NULL,
  language text,
  card_token text,
  dlocal_account_type text,
  scheduled_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  country text,
  dlocal_created_at timestamptz,
  dlocal_updated_at timestamptz,
  raw_data jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dlocal_subs_cache_email ON dlocal_subscriptions_cache(client_email);
CREATE INDEX IF NOT EXISTS idx_dlocal_subs_cache_token ON dlocal_subscriptions_cache(subscription_token);
CREATE INDEX IF NOT EXISTS idx_dlocal_subs_cache_plan ON dlocal_subscriptions_cache(plan_id);
CREATE INDEX IF NOT EXISTS idx_dlocal_subs_cache_status ON dlocal_subscriptions_cache(status, active);

-- Enable RLS
ALTER TABLE dlocal_subscriptions_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only (cron jobs)
CREATE POLICY "Service role can manage dlocal subscriptions cache"
  ON dlocal_subscriptions_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
