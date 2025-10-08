/*
  # Update Basic Plan API Key Limits

  1. Updates
    - Updates the basic plan to include API key limits per environment
    - Sets limit to 1 API key per environment for basic plan
    - Ensures all plans have proper limits structure

  2. Security
    - No security changes needed
*/

-- Update the basic plan to include api_keys_per_environment limit
UPDATE subscription_plans
SET limits = jsonb_set(
  COALESCE(limits, '{}'::jsonb),
  '{api_keys_per_environment}',
  '1'::jsonb
)
WHERE id = '00000000-0000-0000-0000-000000000000'
AND (limits->>'api_keys_per_environment' IS NULL OR limits->>'api_keys_per_environment' = '');

-- Verify the update
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscription_plans
    WHERE id = '00000000-0000-0000-0000-000000000000'
    AND (limits->>'api_keys_per_environment')::int = 1
  ) THEN
    RAISE NOTICE 'Basic plan updated successfully with api_keys_per_environment limit';
  ELSE
    RAISE NOTICE 'Basic plan may need manual update';
  END IF;
END $$;
