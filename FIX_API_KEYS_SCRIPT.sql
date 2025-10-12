/*
  # Fix API Keys Application ID

  ## Problem:
  API keys were created with application_id pointing to the PUBLIC UUID
  (applications.application_id) instead of the INTERNAL UUID (applications.id).

  This causes "API Key does not belong to this application" errors.

  ## Solution:
  Update all api_keys to point to the correct internal application ID.
*/

-- Step 1: Show the problem
SELECT
  '🔍 PROBLEMA ACTUAL' as status,
  ak.key_hash,
  ak.key_preview,
  ak.application_id as api_key_apunta_a,
  a.id as deberia_apuntar_a,
  a.application_id as app_public_id,
  a.name as app_name,
  CASE
    WHEN ak.application_id = a.id THEN '✅ CORRECTO'
    ELSE '❌ INCORRECTO - Apunta al UUID público'
  END as validation
FROM api_keys ak
LEFT JOIN applications a ON a.application_id = ak.application_id::text;

-- Step 2: Fix ALL api_keys
UPDATE api_keys ak
SET application_id = a.id
FROM applications a
WHERE a.application_id::text = ak.application_id::text
  AND ak.application_id != a.id;

-- Step 3: Verify the fix
SELECT
  '✅ DESPUÉS DE LA CORRECCIÓN' as status,
  ak.key_hash,
  ak.key_preview,
  ak.application_id as api_key_app_id,
  a.id as app_internal_id,
  a.name as app_name,
  CASE
    WHEN ak.application_id = a.id THEN '✅ CORRECTO'
    ELSE '❌ AÚN INCORRECTO'
  END as validation
FROM api_keys ak
JOIN applications a ON ak.application_id = a.id;

-- Step 4: Count fixed records
SELECT
  COUNT(*) as total_api_keys_corregidos
FROM api_keys ak
JOIN applications a ON ak.application_id = a.id;
