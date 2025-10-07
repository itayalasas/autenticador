/*
  # Fix Signup Trigger RLS Policies

  ## Problem
  When a new user signs up, triggers attempt to create profile, notification, and preferences records.
  However, RLS policies block these inserts because:
  - auth.uid() returns NULL during signup (user not yet authenticated)
  - Triggers run with SECURITY DEFINER but policies still check auth.uid()

  ## Solution
  1. Drop existing restrictive INSERT policies on profiles, notifications, and notification_preferences
  2. Create new INSERT policies that allow system/trigger inserts by checking for NULL auth.uid()
  3. Maintain security by only allowing authenticated users OR system (NULL uid) to insert

  ## Changes
  - profiles: Allow system inserts during user creation
  - notifications: Allow system inserts for welcome notifications
  - notification_preferences: Allow system inserts for default preferences
*/

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own preferences" ON notification_preferences;

-- Create new INSERT policy for profiles
-- Allows: system inserts (auth.uid() IS NULL) OR authenticated user inserting own profile
CREATE POLICY "Allow system and user profile inserts"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- Create new INSERT policy for notifications  
-- Allows: system inserts (auth.uid() IS NULL) OR authenticated user (for any notification)
CREATE POLICY "Allow system and authenticated notification inserts"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NULL OR auth.role() = 'authenticated'
  );

-- Create new INSERT policy for notification_preferences
-- Allows: system inserts (auth.uid() IS NULL) OR authenticated user inserting own preferences
CREATE POLICY "Allow system and user preference inserts"
  ON notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = user_id
  );
