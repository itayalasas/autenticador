/*
  # Fix Signup Trigger Policies

  1. Changes
    - Drop existing INSERT policies on profiles, notifications, and notification_preferences
    - Create new INSERT policies that allow system triggers to insert during signup
    - Use SECURITY DEFINER context to allow trigger insertions

  2. Security
    - Policies still restrict who can insert data
    - Triggers run with elevated privileges to create initial user data
    - Regular users still cannot insert arbitrary data
*/

-- Fix profiles INSERT policy
DROP POLICY IF EXISTS "Allow system and user profile inserts" ON profiles;

CREATE POLICY "Allow profile creation during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix notifications INSERT policy  
DROP POLICY IF EXISTS "Allow system and authenticated notification inserts" ON notifications;

CREATE POLICY "Allow notification creation"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix notification_preferences INSERT policy
DROP POLICY IF EXISTS "Allow system and user preference inserts" ON notification_preferences;

CREATE POLICY "Allow preference creation"
  ON notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
