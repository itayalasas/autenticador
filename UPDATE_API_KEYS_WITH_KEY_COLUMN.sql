-- =============================================
-- SOLUCIÓN DEFINITIVA: Agregar columna 'key' para almacenar API keys en texto plano
-- =============================================
-- La API key NO debe estar hasheada porque necesitamos compararla directamente
-- El hashing es para passwords, no para API keys
-- =============================================

-- 1. Agregar columna 'key' si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN key text;
    RAISE NOTICE '✅ Columna "key" agregada';
  ELSE
    RAISE NOTICE '⚠️  Columna "key" ya existe';
  END IF;
END $$;

-- 2. Crear índice único para la columna 'key'
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_unique ON api_keys(key) WHERE key IS NOT NULL;

-- 3. Ver todas tus aplicaciones
SELECT 
  '🔍 PASO 1: TUS APLICACIONES' as info,
  id as application_id,
  name,
  description,
  created_at
FROM applications
ORDER BY created_at DESC;

-- 4. Ver todas tus API keys
SELECT 
  '🔑 PASO 2: TUS API KEYS' as info,
  id as api_key_id,
  application_id,
  name,
  key as api_key_texto_plano,
  key_hash,
  key_preview,
  environment,
  is_active,
  created_at
FROM api_keys
ORDER BY created_at DESC;

-- =============================================
-- PASO 3: ACTUALIZAR TU API KEY
-- =============================================
-- Descomenta y ejecuta esto después de ver los resultados de arriba
-- Reemplaza los valores con los tuyos:

/*
UPDATE api_keys
SET key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
WHERE id = 'TU_API_KEY_ID_AQUI';

-- Verificar que funcionó
SELECT 
  '✅ VERIFICACIÓN' as resultado,
  id,
  application_id,
  name,
  key,
  environment,
  is_active
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda';
*/

-- =============================================
-- PASO 4 (OPCIONAL): Crear datos de prueba si no tienes
-- =============================================
/*
-- Crear una aplicación
INSERT INTO applications (name, description)
VALUES ('Mi Aplicación de Prueba', 'Aplicación para testing')
RETURNING id as nuevo_application_id, name;

-- Crear API key (reemplaza TU_APP_ID con el UUID de arriba)
INSERT INTO api_keys (
  application_id,
  name,
  key,
  key_hash,
  key_preview,
  environment,
  is_active
)
VALUES (
  'TU_APP_ID',
  'Production API Key',
  'ak_production_042a5f866c7e35630a9340bd224cbdda',
  '$2a$10$hash_placeholder',
  'ak_prod...bdda',
  'production',
  true
)
RETURNING id, application_id, key, environment;

-- Crear usuario de prueba
INSERT INTO app_users (
  application_id,
  email,
  full_name,
  password_hash,
  is_active
)
VALUES (
  'TU_APP_ID',
  'juan@example.com',
  'Juan Pérez',
  '$2a$10$hash_placeholder',
  true
)
RETURNING id, email, full_name;
*/
