-- Verificar la API key y la aplicación
-- Application ID: app_a6f840c5-bd1
-- API Key: ak_production_042a5f866c7e35630a9340bd224cbdda

-- 1. Verificar si existe la aplicación
SELECT
  id,
  name,
  description,
  is_active,
  created_at
FROM applications
WHERE id = 'app_a6f840c5-bd1';

-- 2. Verificar si existe la API key
SELECT
  id,
  application_id,
  key,
  environment,
  is_active,
  created_at
FROM api_keys
WHERE key = 'ak_production_042a5f866c7e35630a9340bd224cbdda';

-- 3. Verificar la combinación completa (lo que hace la Edge Function)
SELECT
  ak.id,
  ak.application_id,
  ak.key,
  ak.environment,
  ak.is_active,
  app.name as application_name,
  app.is_active as application_is_active
FROM api_keys ak
LEFT JOIN applications app ON app.id = ak.application_id
WHERE ak.key = 'ak_production_042a5f866c7e35630a9340bd224cbdda'
  AND ak.application_id = 'app_a6f840c5-bd1'
  AND ak.is_active = true;

-- 4. Verificar todos los API keys de esta aplicación
SELECT
  id,
  key,
  environment,
  is_active,
  created_at
FROM api_keys
WHERE application_id = 'app_a6f840c5-bd1'
ORDER BY created_at DESC;

-- 5. Verificar si hay usuarios en app_users para esta aplicación
SELECT
  COUNT(*) as total_users
FROM app_users
WHERE application_id = 'app_a6f840c5-bd1';
