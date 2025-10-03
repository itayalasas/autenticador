/*
  # Add custom_texts column to branding_configs table

  1. Changes
    - Add `custom_texts` column to `branding_configs` table
    - Column type: JSONB with default empty object
    - Allows storing customizable text configurations for authentication forms

  2. Security
    - No changes to RLS policies needed
    - Existing policies will cover the new column
*/

-- Add custom_texts column to branding_configs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branding_configs' AND column_name = 'custom_texts'
  ) THEN
    ALTER TABLE branding_configs ADD COLUMN custom_texts jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;