/*
  # Add registration fields to application_roles

  1. Changes
    - Add `available_for_registration` column (boolean) - indicates if role can be selected during registration
    - Add `is_active` column (boolean) - indicates if role is currently active
    - Set default values for existing roles
    - Update is_default roles to be available for registration

  2. Notes
    - All existing roles will be set as active
    - Default roles will be available for registration
*/

-- Add the new columns
ALTER TABLE application_roles
ADD COLUMN IF NOT EXISTS available_for_registration boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Set default roles to be available for registration
UPDATE application_roles
SET available_for_registration = true
WHERE is_default = true;

-- Make all roles active by default
UPDATE application_roles
SET is_active = true
WHERE is_active IS NULL;
