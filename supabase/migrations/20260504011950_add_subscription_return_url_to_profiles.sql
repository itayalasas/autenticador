/*
  # Add subscription return URL to profiles

  1. Changes
    - Adds `subscription_return_url` (text) to `profiles` table.
    - Tenants (account owners) configure this URL so DLocal can redirect
      their users back to their own web after a successful subscription
      payment (e.g. https://commhub.netlify.app/suscripcion/ok).

  2. Notes
    - Nullable — if empty we fall back to the dashboard's default success
      route.
    - No RLS changes needed: existing policies on `profiles` already allow
      owners to update their own row.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'subscription_return_url'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN subscription_return_url text;
  END IF;
END $$;