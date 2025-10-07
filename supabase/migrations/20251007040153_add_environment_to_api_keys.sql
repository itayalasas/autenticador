/*
  # Add environment column to api_keys table

  1. Changes
    - Add environment column to api_keys table
    - Set default to 'development'
    - Add check constraint to ensure valid environment values
    
  2. Notes
    - Existing API keys will be set to 'development' by default
    - Valid environments: development, testing, production
*/

-- Add environment column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'environment'
  ) THEN
    ALTER TABLE api_keys 
    ADD COLUMN environment text DEFAULT 'development' NOT NULL;
    
    -- Add check constraint for valid environments
    ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_environment_check 
    CHECK (environment IN ('development', 'testing', 'production'));
  END IF;
END $$;
