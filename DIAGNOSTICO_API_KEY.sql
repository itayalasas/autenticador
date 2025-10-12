-- =============================================
-- DIAGNÓSTICO COMPLETO DE API KEY
-- =============================================
-- Application ID: app_a6f840c5-bd1
-- API Key: ak_production_042a5f866c7e35630a9340bd224cbdda

-- =============================================
-- 1. VERIFICAR APLICACIÓN
-- =============================================
SELECT
  '1. APLICACIÓN' as seccion,
  id,
  name,
  description,
  is_active,
  created_at
FROM applications
WHERE id = 'app_a6f840c5-bd1';

-- =============================================
-- 2. BUSCAR API KEY POR CLAVE
-- =============================================
SELECT
  '2. API KEY (por clave)' as seccion,
  id,
  application_id,
  name,
  key,
  environment,
  is_active,
  created_at
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda';

-- =============================================
-- 3. BUSCAR TODAS LAS API KEYS DE LA APLICACIÓN
-- =============================================
SELECT
  '3. TODAS LAS API KEYS' as seccion,
  id,
  name,
  key,
  environment,
  is_active,
  created_at
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1'
ORDER BY created_at DESC;

-- =============================================
-- 4. VERIFICAR COMBINACIÓN EXACTA
-- =============================================
SELECT
  '4. COMBINACIÓN EXACTA' as seccion,
  ak.id,
  ak.application_id,
  ak.key,
  ak.environment,
  ak.is_active as api_key_is_active,
  app.name as application_name,
  app.is_active as application_is_active
FROM api_keys ak
INNER JOIN applications app ON app.id = ak.application_id
WHERE ak.key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
  AND ak.application_id = 'app_a6f840c5-bd1';

-- =============================================
-- 5. VERIFICAR POLÍTICAS RLS EN api_keys
-- =============================================
SELECT
  '5. POLÍTICAS RLS' as seccion,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'api_keys';

-- =============================================
-- 6. VERIFICAR SI RLS ESTÁ HABILITADO
-- =============================================
SELECT
  '6. RLS HABILITADO' as seccion,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'api_keys';

-- =============================================
-- 7. CONTAR USUARIOS EN LA APLICACIÓN
-- =============================================
SELECT
  '7. USUARIOS EN APLICACIÓN' as seccion,
  COUNT(*) as total_users,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_users
FROM app_users
WHERE application_id = 'app_a6f840c5-bd1';

-- =============================================
-- 8. BUSCAR USUARIOS CON NOMBRE "JUAN"
-- =============================================
SELECT
  '8. BÚSQUEDA "JUAN"' as seccion,
  id,
  email,
  full_name,
  role_id,
  is_active
FROM app_users
WHERE application_id = 'app_a6f840c5-bd1'
  AND (full_name ILIKE '%juan%' OR email ILIKE '%juan%')
LIMIT 5;
