/*
  # Add metadata column to applications table

  1. Changes
    - Add `metadata` column to `applications` table as JSONB type
    - Set default value to empty JSON object
    - Update existing records to have empty metadata object

  2. Security
    - No RLS changes needed as existing policies will cover the new column
*/

-- Add metadata column to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing records to have empty metadata object if null
UPDATE applications 
SET metadata = '{}'::jsonb 
WHERE metadata IS NULL;