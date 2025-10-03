/*
  # Add metadata column to environments table

  1. New Columns
    - `metadata` (jsonb, nullable)
      - Stores additional configuration and generated URLs
      - Default value: empty JSON object

  2. Changes
    - Add metadata column to environments table
    - Update existing records to have empty metadata object
*/

-- Add metadata column to environments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'environments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE environments ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Update existing records to have empty metadata if null
UPDATE environments 
SET metadata = '{}' 
WHERE metadata IS NULL;