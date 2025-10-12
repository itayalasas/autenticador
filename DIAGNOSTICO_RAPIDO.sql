-- =============================================
-- DIAGNÓSTICO RÁPIDO Y SIMPLE
-- =============================================

-- PASO 1: Ver estructura de la tabla applications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'applications'
ORDER BY ordinal_position;

-- PASO 2: Ver estructura de la tabla api_keys
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

-- PASO 3: Ver la aplicación específica
SELECT *
FROM applications
WHERE id = 'app_a6f840c5-bd1';

-- PASO 4: Ver todas las API keys de esa aplicación
SELECT *
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1';

-- PASO 5: Buscar si existe la API key por key_preview
SELECT *
FROM api_keys
WHERE key_preview LIKE '%042a5f866c7e35630a9340bd224cbdda%';

-- PASO 6: Ver todos los usuarios de la aplicación
SELECT COUNT(*) as total_usuarios
FROM app_users
WHERE application_id = 'app_a6f840c5-bd1';

-- PASO 7: Ver usuarios con nombre "juan"
SELECT id, email, full_name, role_id
FROM app_users
WHERE application_id = 'app_a6f840c5-bd1'
  AND (full_name ILIKE '%juan%' OR email ILIKE '%juan%')
LIMIT 5;
