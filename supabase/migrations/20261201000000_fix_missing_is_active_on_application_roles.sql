/*
  # Fix missing role status columns

  Asegura que application_roles tenga las columnas requeridas por la UI de Roles:
  - is_active
  - available_for_registration
*/

ALTER TABLE application_roles
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE application_roles
  ADD COLUMN IF NOT EXISTS available_for_registration boolean DEFAULT true;

UPDATE application_roles
SET is_active = true
WHERE is_active IS NULL;

UPDATE application_roles
SET available_for_registration = true
WHERE available_for_registration IS NULL;

ALTER TABLE application_roles
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE application_roles
  ALTER COLUMN available_for_registration SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_application_roles_is_active
  ON application_roles(application_id, is_active)
  WHERE is_active = true;
