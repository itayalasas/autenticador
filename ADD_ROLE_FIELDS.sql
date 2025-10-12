-- =====================================================
-- EJECUTA ESTE SQL EN SUPABASE SQL EDITOR
-- =====================================================
-- Esto agregará los campos necesarios para el selector
-- de roles en el formulario de registro
-- =====================================================

-- Agregar columnas si no existen
ALTER TABLE application_roles
ADD COLUMN IF NOT EXISTS available_for_registration boolean DEFAULT false;

ALTER TABLE application_roles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Hacer que todos los roles existentes estén activos
UPDATE application_roles
SET is_active = true
WHERE is_active IS NULL;

-- Hacer que los roles por defecto estén disponibles para registro
UPDATE application_roles
SET available_for_registration = true
WHERE is_default = true;

-- Verificar los cambios
SELECT
  id,
  name,
  display_name,
  is_default,
  available_for_registration,
  is_active
FROM application_roles
ORDER BY application_id, name;
