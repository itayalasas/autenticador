/*
  # Create dLocal Plans Cache Table

  1. New Tables
    - `dlocal_plans_cache`
      - `id` (bigint, primary key) - dLocal plan ID
      - `merchant_id` (bigint) - Merchant ID
      - `name` (text) - Plan name
      - `description` (text) - Plan description
      - `country` (text) - Country code
      - `currency` (text) - Currency code
      - `amount` (numeric) - Plan amount
      - `frequency_type` (text) - MONTHLY or YEARLY
      - `frequency_value` (integer) - Frequency value
      - `active` (boolean) - Whether plan is active
      - `free_trial_days` (integer) - Free trial days
      - `plan_token` (text, unique) - Plan token for subscriptions
      - `subscribe_url` (text) - Checkout URL
      - `dlocal_created_at` (timestamptz) - When plan was created in dLocal
      - `dlocal_updated_at` (timestamptz) - When plan was updated in dLocal
      - `synced_at` (timestamptz) - When this record was last synced
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `dlocal_plans_cache` table
    - Add policy for authenticated users to read plans
    - Add policy for service role to manage plans

  3. Indexes
    - Index on `plan_token` for fast lookups
    - Index on `active` for filtering active plans
    - Index on `synced_at` for cache invalidation
*/

CREATE TABLE IF NOT EXISTS dlocal_plans_cache (
  id bigint PRIMARY KEY,
  merchant_id bigint NOT NULL,
  name text NOT NULL,
  description text,
  country text NOT NULL,
  currency text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  frequency_type text NOT NULL CHECK (frequency_type IN ('MONTHLY', 'YEARLY')),
  frequency_value integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  free_trial_days integer NOT NULL DEFAULT 0,
  plan_token text UNIQUE NOT NULL,
  subscribe_url text NOT NULL,
  dlocal_created_at timestamptz,
  dlocal_updated_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_plan_token ON dlocal_plans_cache(plan_token);
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_active ON dlocal_plans_cache(active);
CREATE INDEX IF NOT EXISTS idx_dlocal_plans_cache_synced_at ON dlocal_plans_cache(synced_at);

-- Enable RLS
ALTER TABLE dlocal_plans_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read active plans
CREATE POLICY "Authenticated users can read active plans"
  ON dlocal_plans_cache
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policy: Service role can read all plans
CREATE POLICY "Service role can read all plans"
  ON dlocal_plans_cache
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Service role can insert plans
CREATE POLICY "Service role can insert plans"
  ON dlocal_plans_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can update plans
CREATE POLICY "Service role can update plans"
  ON dlocal_plans_cache
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can delete plans
CREATE POLICY "Service role can delete plans"
  ON dlocal_plans_cache
  FOR DELETE
  TO service_role
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dlocal_plans_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dlocal_plans_cache_updated_at_trigger ON dlocal_plans_cache;
CREATE TRIGGER update_dlocal_plans_cache_updated_at_trigger
  BEFORE UPDATE ON dlocal_plans_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_dlocal_plans_cache_updated_at();
