-- 🔍 DIAGNÓSTICO RÁPIDO DEL PROBLEMA

-- 1. Ver la aplicación
SELECT 
  '1️⃣ APLICACIÓN' as paso,
  id as uuid_interno,
  application_id as uuid_publico,
  name,
  domain
FROM applications
WHERE application_id = '3acde27f-74d3-465e-aaec-94ad46faa881';

-- 2. Ver el API key
SELECT 
  '2️⃣ API KEY' as paso,
  key_hash,
  key_preview,
  application_id as apunta_a_uuid,
  is_active,
  environment
FROM api_keys
WHERE key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def';

-- 3. ¿Coinciden?
SELECT 
  '3️⃣ COMPARACIÓN' as paso,
  ak.application_id as api_key_uuid,
  a.id as app_uuid_interno,
  a.application_id as app_uuid_publico,
  CASE
    WHEN ak.application_id = a.id THEN '✅ COINCIDEN (CORRECTO)'
    WHEN ak.application_id::text = a.application_id::text THEN '❌ API key usa UUID público (INCORRECTO)'
    ELSE '❌ NO COINCIDEN EN ABSOLUTO (ERROR GRAVE)'
  END as diagnostico
FROM api_keys ak
CROSS JOIN applications a
WHERE ak.key_hash = 'ak_production_2eacaaf5a2d7385d09f7c134ac4c7def'
  AND a.application_id = '3acde27f-74d3-465e-aaec-94ad46faa881';
