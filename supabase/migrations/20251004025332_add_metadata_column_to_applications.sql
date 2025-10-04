/*
  # Add metadata column to applications table

  1. Changes
    - Add `metadata` column to `applications` table
      - Type: jsonb
      - Default: empty object '{}'
      - Stores application-specific configuration settings

  2. Notes
    - This column stores authentication settings and other configuration
    - Used by AuthenticationSettings component to save/load settings
*/

-- Add metadata column to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN applications.metadata IS 'Application-specific configuration settings including auth policies, CORS, callbacks, etc.';