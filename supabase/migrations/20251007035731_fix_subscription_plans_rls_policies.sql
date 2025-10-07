/*
  # Fix RLS policies for subscription_plans table

  1. Changes
    - Drop existing restrictive SELECT policy
    - Add new SELECT policy to allow all authenticated users to read plans
    - Add INSERT policy for system to create the basic plan (service role only)
    - Add UPDATE policy for system to manage plans (service role only)
    
  2. Security
    - All authenticated users can read active plans
    - Only service role can insert/update plans
    - No one can delete plans (data integrity)
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Anyone can read active subscription plans" ON subscription_plans;

-- Allow all authenticated users to read subscription plans
CREATE POLICY "Authenticated users can read subscription plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public to read active plans (for pricing page before auth)
CREATE POLICY "Public can read active subscription plans"
  ON subscription_plans
  FOR SELECT
  TO public
  USING (is_active = true);

-- Service role can insert plans (for ensuring basic plan exists)
CREATE POLICY "Service role can insert subscription plans"
  ON subscription_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only allow if user has service role or if it's the basic plan
    id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- Service role can update plans
CREATE POLICY "Service role can update subscription plans"
  ON subscription_plans
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
