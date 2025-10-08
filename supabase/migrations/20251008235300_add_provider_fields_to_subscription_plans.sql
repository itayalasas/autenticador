/*
  # Add Provider Fields to Subscription Plans

  1. Changes
    - Add `provider` column (dlocal, stripe, etc.)
    - Add `provider_plan_id` to store external plan token/ID
    - Add index for fast lookups by provider_plan_id

  2. Notes
    - Allows linking internal plans to external payment provider plans
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider text DEFAULT 'dlocal';
  END IF;

  -- Add provider_plan_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider_plan_id text;
  END IF;
END $$;

-- Create unique index on provider + provider_plan_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_provider_plan_id
  ON subscription_plans(provider, provider_plan_id)
  WHERE provider_plan_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN subscription_plans.provider IS 'Payment provider (dlocal, stripe, etc.)';
COMMENT ON COLUMN subscription_plans.provider_plan_id IS 'External plan ID/token from payment provider';
