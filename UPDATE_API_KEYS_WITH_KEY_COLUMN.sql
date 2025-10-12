-- =============================================
-- ACTUALIZAR API KEYS CON COLUMNA 'key'
-- =============================================

-- PASO 1: Agregar la columna 'key' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN key text;
    RAISE NOTICE 'Columna "key" agregada a api_keys';
  ELSE
    RAISE NOTICE 'Columna "key" ya existe en api_keys';
  END IF;
END $$;

-- PASO 2: Actualizar API keys existentes
-- IMPORTANTE: Debes reemplazar los valores con tus API keys reales
-- Ejemplo de cómo actualizar una API key específica:
-- UPDATE api_keys
-- SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
-- WHERE application_id = 'app_a6f840c5-bd1'
--   AND environment = 'production';

-- PASO 3: Ver todas las API keys que necesitan actualizarse
SELECT
  id,
  application_id,
  name,
  key,
  key_preview,
  environment,
  is_active,
  created_at
FROM api_keys
ORDER BY created_at DESC;

-- PASO 4: Después de actualizar manualmente, hacer la columna NOT NULL y UNIQUE
-- IMPORTANTE: Solo ejecutar después de actualizar todas las API keys
-- ALTER TABLE api_keys ALTER COLUMN key SET NOT NULL;
-- ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_unique UNIQUE (key);
-- CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
