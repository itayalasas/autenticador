/*
  # Add Provider Fields to Subscriptions

  1. Changes
    - Add `provider` column (dlocal, stripe, etc.)
    - Add `provider_subscription_id` as generic field
    - Add `provider_plan_id` to link to external plan
    - Add `payment_failed` status to status check
    - Update indexes for better performance

  2. Notes
    - Keeps backward compatibility with dlocal_subscription_id
    - Allows multiple payment providers in the future
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider text DEFAULT 'dlocal';
  END IF;

  -- Add provider_subscription_id column (generic version)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_subscription_id text;
  END IF;

  -- Add provider_plan_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'provider_plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN provider_plan_id text;
  END IF;
END $$;

-- Migrate existing dlocal_subscription_id to provider_subscription_id
UPDATE subscriptions
SET provider_subscription_id = dlocal_subscription_id,
    provider = 'dlocal'
WHERE dlocal_subscription_id IS NOT NULL
AND provider_subscription_id IS NULL;

-- Drop old CHECK constraint if it exists
DO $$
BEGIN
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new CHECK constraint with payment_failed status
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN ('pending', 'active', 'trialing', 'cancelled', 'expired', 'payment_failed', 'inactive', 'past_due'));

-- Create index on provider_subscription_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON subscriptions(provider_subscription_id);

-- Create index on provider for filtering by payment provider
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider
  ON subscriptions(provider);

-- Add comments
COMMENT ON COLUMN subscriptions.provider IS 'Payment provider (dlocal, stripe, etc.)';
COMMENT ON COLUMN subscriptions.provider_subscription_id IS 'External subscription ID from payment provider';
COMMENT ON COLUMN subscriptions.provider_plan_id IS 'External plan ID from payment provider';
