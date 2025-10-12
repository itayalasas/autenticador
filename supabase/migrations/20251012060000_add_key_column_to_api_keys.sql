/*
  # Add 'key' column to api_keys table

  1. Changes
    - Add 'key' column to api_keys table to store the plaintext API key
    - Add unique constraint on 'key' column
    - Add index on 'key' column for fast lookups

  2. Security Notes
    - The 'key' column stores the API key in plaintext for validation
    - This is necessary for API key authentication
    - key_hash can be used for additional security if needed
    - Ensure RLS policies protect this table appropriately
*/

-- Add 'key' column to api_keys table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys
    ADD COLUMN key text UNIQUE;

    -- Add index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

    -- Add comment
    COMMENT ON COLUMN api_keys.key IS 'API key in plaintext for validation';
  END IF;
END $$;
