-- =============================================
-- SCRIPT PARA ARREGLAR API KEYS
-- =============================================
-- Este script:
-- 1. Agrega la columna 'key' a la tabla api_keys
-- 2. Actualiza tu API key específica
-- 3. Verifica que todo esté correcto
-- =============================================

-- PASO 1: Agregar columna 'key' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN key text;
    RAISE NOTICE 'Columna "key" agregada exitosamente';
  ELSE
    RAISE NOTICE 'Columna "key" ya existe';
  END IF;
END $$;

-- PASO 2: Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);

-- PASO 3: Actualizar tu API key específica
-- IMPORTANTE: Ajusta el WHERE clause según tu aplicación
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE application_id = 'app_a6f840c5-bd1'
  AND key_preview LIKE '%042a5f866c7e35630a9340bd224cbdda%';

-- PASO 4: Verificar que se actualizó correctamente
SELECT 
  id,
  application_id,
  name,
  key,
  key_preview,
  environment
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1';

-- PASO 5 (OPCIONAL): Hacer la columna UNIQUE
-- Solo ejecuta esto después de actualizar TODAS tus API keys
-- ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_unique UNIQUE (key);

-- PASO 6: Verificar la consulta que hace la Edge Function
SELECT
  id,
  application_id,
  environment
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
  AND application_id = 'app_a6f840c5-bd1';
