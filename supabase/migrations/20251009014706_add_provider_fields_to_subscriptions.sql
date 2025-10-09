/*
  # Add Provider Fields to Subscriptions

  1. Changes
    - Add `provider` column to track payment provider (dlocal, stripe, etc.)
    - Add `provider_subscription_id` column to store external subscription ID
    - Add `provider_plan_id` column to store external plan ID reference
    
  2. Notes
    - These fields complement the existing dlocal_subscription_id
    - Migrate existing dlocal_subscription_id values to provider_subscription_id
    - Add indexes for better query performance
*/

-- Add provider columns to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_plan_id text;
  END IF;
END $$;

-- Migrate existing dlocal_subscription_id to provider fields
UPDATE subscriptions 
SET 
  provider = 'dlocal',
  provider_subscription_id = dlocal_subscription_id
WHERE dlocal_subscription_id IS NOT NULL 
  AND provider_subscription_id IS NULL;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider 
  ON subscriptions(provider) 
  WHERE provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id 
  ON subscriptions(provider_subscription_id) 
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_plan_id 
  ON subscriptions(provider_plan_id) 
  WHERE provider_plan_id IS NOT NULL;