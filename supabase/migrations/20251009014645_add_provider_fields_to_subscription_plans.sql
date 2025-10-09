/*
  # Add Provider Fields to Subscription Plans

  1. Changes
    - Add `provider` column to track payment provider (dlocal, stripe, etc.)
    - Add `provider_plan_id` column to store external plan ID from provider
    - Add `provider_metadata` column for additional provider-specific data
    
  2. Notes
    - These fields are optional to maintain backward compatibility
    - Existing plans will have NULL values for these fields
*/

-- Add provider columns to subscription_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider_plan_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'provider_metadata'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN provider_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for faster lookups by provider
CREATE INDEX IF NOT EXISTS idx_subscription_plans_provider 
  ON subscription_plans(provider) 
  WHERE provider IS NOT NULL;

-- Add index for provider_plan_id lookups
CREATE INDEX IF NOT EXISTS idx_subscription_plans_provider_plan_id 
  ON subscription_plans(provider_plan_id) 
  WHERE provider_plan_id IS NOT NULL;